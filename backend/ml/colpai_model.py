import torch
import torch.nn as nn
import numpy as np
import pandas as pd

class ColpAiLSTM(nn.Module):
    """
    e-Partogram Multi-Task LSTM:
    Predicts both continuous remaining delivery time AND categorical risk class.
    """
    def __init__(self, input_size, hidden_size=64, num_layers=2, dropout_rate=0.2):
        super(ColpAiLSTM, self).__init__()
        
        # LSTM Layer for time-series extraction
        self.lstm = nn.LSTM(
            input_size=input_size, 
            hidden_size=hidden_size, 
            num_layers=num_layers, 
            batch_first=True, 
            dropout=dropout_rate if num_layers > 1 else 0
        )
        
        # Multi-Task Learning Heads
        
        # 1. Regression head (Time to full dilation)
        self.time_head = nn.Sequential(
            nn.Linear(hidden_size, 32),
            nn.BatchNorm1d(32),
            nn.ReLU(),
            nn.Dropout(dropout_rate),
            nn.Linear(32, 1),
            nn.ReLU() # Time remaining must be >= 0
        )
        
        # 2. Classification head (Risk level: Normal, Slow, Prolonged)
        self.risk_head = nn.Sequential(
            nn.Linear(hidden_size, 32),
            nn.BatchNorm1d(32),
            nn.ReLU(),
            nn.Dropout(dropout_rate),
            nn.Linear(32, 3) # 3 Classes
        )
        
    def forward(self, x):
        """
        x shape: (batch_size, sequence_length, features)
        """
        lstm_out, (hn, cn) = self.lstm(x)
        
        # We only care about the output from the final timestep for prediction
        last_timestep_out = lstm_out[:, -1, :]
        
        time_pred = self.time_head(last_timestep_out)
        risk_pred = self.risk_head(last_timestep_out)
        
        return time_pred, risk_pred

class ColpAiFeatureEngineer:
    """
    Handles clinical time-series standardization and derivation, 
    forming the WHO-compliant feature matrix for LSTM injection.
    """
    def __init__(self):
        # We will hardcode scaling metrics from the generator for simplicity in MVP, 
        # but in production these would be fitted scalars from sklearn.
        self.scaling = {
            'time_hours': (0, 24),
            'cervical_dilation_cm': (0, 10),
            'fetal_head_station': (-5, 5),
            'contraction_frequency': (0, 10),
            'contraction_duration': (0, 90),
            'parity': (0, 5),
            'gravida': (0, 6),
            'age': (15, 45),
            'fetal_heart_rate': (60, 200),
            'maternal_pulse': (50, 150)
        }
        
    def _minmax(self, val, key):
        min_val, max_val = self.scaling[key]
        scaled = (val - min_val) / (max_val - min_val)
        return max(0.0, min(1.0, scaled))
        
    def extract_features(self, step_dict_list):
        """
        Converts a list of step dictionaries into a robust sequential tensor matrix.
        Includes temporal derivations required by the prompt (dilation rate).
        """
        features_seq = []
        
        # Find active phase start
        active_phase_start_time = None
        for step in step_dict_list:
            if step['cervical_dilation_cm'] >= 4.0:
                active_phase_start_time = step['time_hours']
                break
                
        for i, step in enumerate(step_dict_list):
            # Derive temporal features
            current_time = step['time_hours']
            current_dilation = step['cervical_dilation_cm']
            
            # Slope/Dilation rate since last hour
            if i > 0:
                prev_step = step_dict_list[i-1]
                time_diff = current_time - prev_step['time_hours']
                dil_diff = current_dilation - prev_step['cervical_dilation_cm']
                dilation_rate = dil_diff / time_diff if time_diff > 0 else 0
            else:
                dilation_rate = 0.0 # Baseline at start
                
            # Distance from Alert/Action Lines
            if active_phase_start_time is not None and current_time >= active_phase_start_time:
                time_in_active = current_time - active_phase_start_time
                alert_y = min(10.0, 4.0 + time_in_active)
                action_y = min(10.0, 4.0 + max(0.0, time_in_active - 4.0))
                
                dist_alert = alert_y - current_dilation
                dist_action = action_y - current_dilation
            else:
                dist_alert = 0.0
                dist_action = 0.0
                
            # Build normalized feature vector
            vector = [
                self._minmax(step['time_hours'], 'time_hours'),
                self._minmax(step['cervical_dilation_cm'], 'cervical_dilation_cm'),
                self._minmax(step['fetal_head_station'], 'fetal_head_station'),
                self._minmax(step['contraction_frequency'], 'contraction_frequency'),
                self._minmax(step['contraction_duration'], 'contraction_duration'),
                self._minmax(step['parity'], 'parity'),
                self._minmax(step['gravida'], 'gravida'),
                self._minmax(step['age'], 'age'),
                self._minmax(step['fetal_heart_rate'], 'fetal_heart_rate'),
                self._minmax(step['maternal_pulse'], 'maternal_pulse'),
                # Derived clinical features
                min(1.0, max(-1.0, dilation_rate / 3.0)), # Normalized approximate bound
                min(1.0, max(-1.0, dist_alert / 5.0)),
                min(1.0, max(-1.0, dist_action / 5.0)),
                1.0 if step.get('membrane_status') == 'ruptured' else 0.0
            ]
            features_seq.append(vector)
            
        return torch.tensor(features_seq, dtype=torch.float32)
        
    def generate_explanation(self, step_dict_list):
        """
        Explainability Layer (Phase 3 Requirement)
        Generates clinical textual rules explaining what the AI is "paying attention to".
        """
        if not step_dict_list:
            return ["Insufficient data for explanation."]
            
        last_step = step_dict_list[-1]
        cervical_dilation = last_step['cervical_dilation_cm']
        explanations = []
        
        # Calculate recent rate
        if len(step_dict_list) >= 2:
            s1, s2 = step_dict_list[-2], step_dict_list[-1]
            time_diff = s2['time_hours'] - s1['time_hours']
            if time_diff > 0:
                rate = (s2['cervical_dilation_cm'] - s1['cervical_dilation_cm']) / time_diff
                if rate < 0.5 and cervical_dilation >= 4:
                    explanations.append(f"Dilation rate distinctly stalled ({round(rate, 2)} cm/hr).")
                elif rate < 1.0 and cervical_dilation >= 4:
                    explanations.append(f"Dilation rate below optimal WHO standard ({round(rate, 2)} cm/hr).")
        
        if last_step['contraction_frequency'] < 3 and cervical_dilation >= 6:
            explanations.append("Contractions are weak for this stage of active labor.")
            
        if last_step['fetal_head_station'] < -1 and cervical_dilation >= 8:
            explanations.append("Fetal head descent remains high despite advanced dilation.")
            
        if not explanations:
            explanations.append("Labor metrics are tracking within physiological norms.")
            
        return explanations
