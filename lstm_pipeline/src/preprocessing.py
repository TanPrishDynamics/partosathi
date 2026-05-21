import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
import pickle
import os

# Features: [dilation_cm, contractions_per_10min, fetal_heart_rate, maternal_pulse, systolic_bp, time_elapsed_hours]

def validate_input(data):
    """
    Check shape = (10,6), check numeric types, enforce physiological bounds.
    """
    if not isinstance(data, (list, np.ndarray, pd.DataFrame)):
        raise ValueError("Data must be a list, numpy array, or pandas DataFrame.")
    
    data = np.array(data, dtype=np.float32)
    
    if data.shape != (10, 6):
        raise ValueError(f"Invalid shape: expected (10, 6), got {data.shape}")
        
    if np.isnan(data).any():
        raise ValueError("Missing values found during validation. Ensure interpolate_missing is called.")
        
    # Check physiological bounds (clamping outliers if they are mildly off, but reject absurd ones)
    for i in range(10):
        if not (0 <= data[i, 0] <= 10):
            data[i, 0] = np.clip(data[i, 0], 0, 10)
        if not (0 <= data[i, 1] <= 6):
            data[i, 1] = np.clip(data[i, 1], 0, 5)
        if not (0 <= data[i, 2] <= 300):
            raise ValueError(f"Fetal heart rate {data[i, 2]} is out of realistic physiological bounds.")
        else:
            data[i, 2] = np.clip(data[i, 2], 80, 200)
        
        if not (0 <= data[i, 3] <= 250):
            raise ValueError(f"Maternal pulse {data[i, 3]} is out of bounds.")
        else:
            data[i, 3] = np.clip(data[i, 3], 40, 140)
            
        if not (0 <= data[i, 4] <= 300):
            raise ValueError(f"Systolic BP {data[i, 4]} is out of bounds.")
        else:
            data[i, 4] = np.clip(data[i, 4], 80, 200)
            
    # Check monotonic time
    time_diffs = np.diff(data[:, 5])
    if (time_diffs < 0).any():
        raise ValueError("Time elapsed must be monotonically increasing.")
        
    return data

def interpolate_missing(data):
    """
    Linear interpolation across time axis for missing values.
    """
    df = pd.DataFrame(data)
    df = df.interpolate(method='linear', axis=0).bfill().ffill()
    return df.values

def normalize(data, scaler_path, fit=False):
    """
    Use MinMaxScaler, save/load scaler.
    """
    os.makedirs(os.path.dirname(scaler_path), exist_ok=True)
    
    if fit:
        scaler = MinMaxScaler()
        # Reshape to 2D for fitting
        flat_data = data.reshape(-1, 6)
        scaler.fit(flat_data)
        with open(scaler_path, 'wb') as f:
            pickle.dump(scaler, f)
    else:
        if not os.path.exists(scaler_path):
            raise FileNotFoundError(f"Scaler not found at {scaler_path}")
        with open(scaler_path, 'rb') as f:
            scaler = pickle.load(f)
            
    original_shape = data.shape
    flat_data = data.reshape(-1, 6)
    scaled_data = scaler.transform(flat_data)
    return scaled_data.reshape(original_shape)

def preprocess_pipeline(raw_data, scaler_path="data/scalers/scaler.pkl", is_training=False):
    """
    validate -> interpolate -> normalize.
    Returns shape (1, 10, 6) if single sample, else (N, 10, 6).
    """
    raw_data = np.array(raw_data)
    
    # Handle single sample vs batch
    if len(raw_data.shape) == 2:
        raw_data = np.expand_dims(raw_data, axis=0)
        
    processed_samples = []
    for sample in raw_data:
        interpolated = interpolate_missing(sample)
        validated = validate_input(interpolated)
        processed_samples.append(validated)
        
    processed_samples = np.array(processed_samples)
    
    # Normalize
    normalized = normalize(processed_samples, scaler_path, fit=is_training)
    
    return normalized
