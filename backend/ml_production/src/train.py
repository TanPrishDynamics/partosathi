import os
import numpy as np
import pandas as pd
import json
import tensorflow as tf
from sklearn.model_selection import train_test_split
from .model import build_model, get_callbacks
from .preprocessing import preprocess_pipeline

def load_data(raw_data_path):
    """
    Placeholder for loading actual dataset. 
    In production, this would read from CSV/Database.
    """
    if not os.path.exists(raw_data_path):
        # Generate synthetic data if not found to ensure readiness
        print(f"Raw data not found at {raw_data_path}. Generating synthetic dataset for training.")
        return generate_synthetic_data(num_samples=500)
    
    # Logic to load and parse raw CSV would go here
    return None 

def generate_synthetic_data(num_samples=500):
    """
    Generates plausible clinical labor data for initial training.
    """
    X = []
    y_time = []
    y_risk = []
    
    for _ in range(num_samples):
        # 10 timesteps, 6 features
        time_elapsed = np.linspace(0, 10, 10)
        dilation = np.sort(np.random.uniform(2, 10, 10))
        contractions = np.random.uniform(0, 5, 10)
        fhr = np.random.uniform(110, 160, 10)
        pulse = np.random.uniform(60, 110, 10)
        bp = np.random.uniform(100, 150, 10)
        
        sample = np.column_stack([dilation, contractions, fhr, pulse, bp, time_elapsed])
        X.append(sample)
        
        # Targets
        delivery_time = np.random.uniform(0, 12)
        risk = np.zeros(3)
        risk[np.random.randint(0, 3)] = 1
        
        y_time.append(delivery_time)
        y_risk.append(risk)
        
    return np.array(X), np.array(y_time), np.array(y_risk)

def train_model():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    model_path = os.path.join(base_dir, 'models', 'lstm_model.h5')
    scaler_path = os.path.join(base_dir, 'data', 'scalers', 'scaler.pkl')
    logs_path = os.path.join(base_dir, 'models', 'training_logs.json')
    
    # 1. Load data
    X_raw, y_time, y_risk = generate_synthetic_data(500)
    
    # 2. Preprocess (Fit scaler)
    X_processed = preprocess_pipeline(X_raw, scaler_path, is_training=True)
    
    # 3. Split
    X_train, X_val, y_time_train, y_time_val, y_risk_train, y_risk_val = train_test_split(
        X_processed, y_time, y_risk, test_size=0.2, random_state=42
    )
    
    # 4. Build and Train
    model = build_model()
    
    # Safeguard: Terminate on NaN
    class TerminateOnNaN(tf.keras.callbacks.Callback):
        def on_batch_end(self, batch, logs=None):
            if logs is not None:
                loss = logs.get('loss')
                if loss is not None and np.isnan(loss):
                    print(f"Batch {batch}: Invalid loss (NaN), terminating training.")
                    self.model.stop_training = True

    callbacks = get_callbacks(model_path)
    callbacks.append(TerminateOnNaN())
    
    print("Starting training...")
    history = model.fit(
        X_train, 
        {'time_output': y_time_train, 'risk_output': y_risk_train},
        validation_data=(X_val, {'time_output': y_time_val, 'risk_output': y_risk_val}),
        epochs=50,
        batch_size=16,
        callbacks=callbacks,
        verbose=1
    )
    
    # 5. Save Logs
    with open(logs_path, 'w') as f:
        json.dump(history.history, f)
    
    print(f"Model and Scaler saved. Training Logs saved to {logs_path}")

if __name__ == "__main__":
    train_model()
