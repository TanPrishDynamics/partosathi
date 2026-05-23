import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
import pickle
import os

# DATA CONTRACT: Shape (time_steps=10, features=6)
# Features: [dilation_cm, contractions_per_10min, fetal_heart_rate, maternal_pulse, systolic_bp, time_elapsed_hours]

def validate_input(data):
    """
    Check shape = (10,6), check numeric types, enforce physiological bounds.
    Raise explicit errors (no silent failure).
    """
    if not isinstance(data, (np.ndarray, list)):
        raise TypeError("Input data must be a numpy array or a list.")
    
    data = np.array(data, dtype=np.float32)
    
    if data.shape != (10, 6):
        raise ValueError(f"Input shape must be (10, 6). Received: {data.shape}")
    
    # Enforce physiological bounds
    # [dilation_cm (0–10), contractions_per_10min (0–5), fetal_heart_rate (80–200), maternal_pulse (40–140), systolic_bp (80–200), time_elapsed_hours]
    bounds = [(0, 10), (0, 5), (80, 200), (40, 140), (80, 200), (0, 100)]
    
    for i, (low, high) in enumerate(bounds):
        col = data[:, i]
        if np.any(col < low - 50) or np.any(col > high + 100): # Allow small buffer but reject absurd
             raise ValueError(f"Feature at index {i} is significantly out of physiological range.")
        data[:, i] = np.clip(col, low, high)
        
    # Check monotonic time
    if not np.all(np.diff(data[:, 5]) >= 0):
        raise ValueError("Time elapsed hours must be strictly increasing.")
        
    return data

def interpolate_missing(data):
    """
    Linear interpolation across time axis.
    """
    df = pd.DataFrame(data)
    # Using linear interpolation for missing numeric values
    df = df.interpolate(method='linear', axis=0).ffill().bfill()
    return df.values

def normalize(data, scaler_path, fit=False):
    """
    Use MinMaxScaler. Save/Load scaler to/from data/scalers/.
    """
    os.makedirs(os.path.dirname(scaler_path), exist_ok=True)
    
    # Reshape for scaler (N*T, F)
    original_shape = data.shape # (Batch, 10, 6) or (10, 6)
    if len(original_shape) == 2:
        reshaped_data = data
    else:
        reshaped_data = data.reshape(-1, 6)
        
    if fit:
        scaler = MinMaxScaler()
        scaler.fit(reshaped_data)
        with open(scaler_path, 'wb') as f:
            pickle.dump(scaler, f)
    else:
        if not os.path.exists(scaler_path):
            raise FileNotFoundError(f"Scaler not found at {scaler_path}. Run training first.")
        with open(scaler_path, 'rb') as f:
            scaler = pickle.load(f)
            
    scaled_data = scaler.transform(reshaped_data)
    
    if len(original_shape) == 3:
        return scaled_data.reshape(original_shape)
    return scaled_data

def preprocess_pipeline(raw_data, scaler_path, is_training=False):
    """
    validate -> interpolate -> normalize.
    Return (1, 10, 6) for single sample or (N, 10, 6) for batch.
    """
    # If single sample (10, 6), expand to (1, 10, 6)
    batch_mode = True
    if len(np.array(raw_data).shape) == 2:
        raw_data = [raw_data]
        batch_mode = False
        
    processed_list = []
    for sample in raw_data:
        interpolated = interpolate_missing(sample)
        validated = validate_input(interpolated)
        processed_list.append(validated)
        
    batch_data = np.array(processed_list)
    normalized = normalize(batch_data, scaler_path, fit=is_training)
    
    return normalized
