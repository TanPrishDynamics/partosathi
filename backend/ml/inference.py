import torch
import os
import datetime
import sys

# Add ml dir to path so we can import models
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from colpai_model import ColpAiLSTM, ColpAiFeatureEngineer

class LSTMInferenceEngine:
    def __init__(self):
        self.engineer = ColpAiFeatureEngineer()
        self.model = ColpAiLSTM(input_size=14, hidden_size=64, num_layers=2)
        
        # Load weights
        model_path = os.path.join(os.path.dirname(__file__), 'lstm_model.pth')
        if os.path.exists(model_path):
            self.model.load_state_dict(torch.load(model_path))
            self.model.eval()
            self.ready = True
        else:
            self.ready = False
            
    def predict(self, observations: list, patient: dict) -> dict:
        if not self.ready:
            return {"success": False, "message": "Model weights not found."}
            
        if not observations:
            return {"success": False, "message": "No observation data."}
            
        # Convert list of db observations to the format expected by our engineer
        # Add patient metadata to each step for the engineer
        formatted_steps = []
        for obs in observations:
            # We map the database schema fields to the fields expected by our Data Generator spec
            step = {
                'time_hours': self._calc_hours(observations[0]['timestamp'], obs['timestamp']),
                'cervical_dilation_cm': obs.get('cervical_dilation') or 0,
                'fetal_head_station': obs.get('head_station') or 0,
                'contraction_frequency': obs.get('contraction_freq') or 0,
                'contraction_duration': obs.get('contraction_duration') or 0,
                'parity': patient.get('parity', 0),
                'gravida': patient.get('gravida', 1),
                'age': patient.get('age', 25),
                'fetal_heart_rate': obs.get('fetal_heart_rate') or 140,
                'maternal_pulse': obs.get('maternal_pulse') or 80,
                'membrane_status': 'intact' # Defaulting for prediction wrapper since we don't store it tightly
            }
            formatted_steps.append(step)
            
        # Filter for active phase only (>= 4cm)
        active_steps = [s for s in formatted_steps if s['cervical_dilation_cm'] >= 4.0]
        if not active_steps:
            return {"success": False, "message": "Latent phase. Awaiting active labor."}
            
        # Feature extraction
        try:
            tensor_seq = self.engineer.extract_features(active_steps)
            # Add batch dimension
            tensor_seq = tensor_seq.unsqueeze(0)
            
            with torch.no_grad():
                time_preds, risk_preds = self.model(tensor_seq)
                
            time_remaining = max(0.0, time_preds.item())
            
            # Risk Classification (0: Normal, 1: Slow, 2: Prolonged)
            _, predicted_class = torch.max(risk_preds.data, 1)
            risk_idx = predicted_class.item()
            
            risk_map = {0: "Normal", 1: "Slow Progress", 2: "Prolonged Labor"}
            risk_status = risk_map.get(risk_idx, "Unknown")
            
            # Explainability
            explanations = self.engineer.generate_explanation(active_steps)
            
            # Calculate final payload
            last_timestamp = observations[-1]['timestamp']
            if isinstance(last_timestamp, str):
                last_timestamp = datetime.datetime.fromisoformat(last_timestamp.replace("Z", "+00:00"))
                
            est_delivery = last_timestamp + datetime.timedelta(hours=time_remaining)
            
            # Additional metadata for banner UI
            # Recalculate basic rate for UI context
            rate = 0.0
            if len(active_steps) >= 2:
                dt = active_steps[-1]['time_hours'] - active_steps[0]['time_hours']
                if dt > 0:
                    rate = (active_steps[-1]['cervical_dilation_cm'] - active_steps[0]['cervical_dilation_cm']) / dt
            
            return {
                "success": True,
                "estimated_time_to_full_dilation_hours": round(time_remaining, 2),
                "estimated_delivery_time": est_delivery.isoformat(),
                "risk_status": risk_status,
                "recommendation": "Review explainable metrics and consult senior practitioner." if risk_idx > 0 else "Continue tracking.",
                "explanations": explanations,
                "current_rate_cm_per_hr": round(rate, 2)
            }
            
        except Exception as e:
            return {"success": False, "message": str(e)}

    def _calc_hours(self, str_start, str_now):
        if isinstance(str_start, str):
            str_start = datetime.datetime.fromisoformat(str_start.replace("Z", "+00:00"))
        if isinstance(str_now, str):
            str_now = datetime.datetime.fromisoformat(str_now.replace("Z", "+00:00"))
        # Using abs defensively, though technically time only flows forwards
        return abs((str_now - str_start).total_seconds()) / 3600.0

lstm_predictor = LSTMInferenceEngine()
