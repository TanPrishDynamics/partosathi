import os
import json
import numpy as np
import tensorflow as tf
from sklearn.model_selection import train_test_split
from .preprocessing import preprocess_pipeline
from .model import build_model

def load_dummy_data(num_samples=1000):
    """
    Generate synthetic dummy data for demonstration.
    In production, this would load from /data/raw/
    """
    X = []
    y_time = []
    y_risk = []
    for _ in range(num_samples):
        # 10 timesteps, 6 features
        time_elapsed = np.linspace(0, 10, 10)
        dilation = np.linspace(0, np.random.uniform(4, 10), 10)
        contractions = np.random.uniform(0, 5, 10)
        fhr = np.random.uniform(110, 160, 10)
        pulse = np.random.uniform(60, 100, 10)
        bp = np.random.uniform(100, 140, 10)
        
        sample = np.column_stack([dilation, contractions, fhr, pulse, bp, time_elapsed])
        X.append(sample)
        
        # Targets
        y_time.append(np.random.uniform(0, 24))
        
        # Risk (one-hot)
        risk = np.zeros(3)
        risk[np.random.randint(0, 3)] = 1
        y_risk.append(risk)
        
    return np.array(X), np.array(y_time), np.array(y_risk)

class CheckNaNLoss(tf.keras.callbacks.Callback):
    def on_epoch_end(self, epoch, logs=None):
        if logs is None:
            return
        if np.isnan(logs.get('loss')):
            print("NaN loss detected. Stopping training immediately.")
            self.model.stop_training = True

def train(data_path=None, model_save_path="models/lstm_model.h5", scaler_save_path="data/scalers/scaler.pkl"):
    print("Loading dataset...")
    # In a real scenario, load from data_path
    X_raw, y_time, y_risk = load_dummy_data()
    
    print("Preprocessing data...")
    try:
        X_proc = preprocess_pipeline(X_raw, scaler_path=scaler_save_path, is_training=True)
    except Exception as e:
        print(f"Preprocessing failed: {e}")
        return
        
    X_train, X_val, y_time_train, y_time_val, y_risk_train, y_risk_val = train_test_split(
        X_proc, y_time, y_risk, test_size=0.2, random_state=42
    )
    
    print("Building model...")
    model = build_model()
    
    os.makedirs(os.path.dirname(model_save_path), exist_ok=True)
    
    callbacks = [
        tf.keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True, monitor='val_loss'),
        tf.keras.callbacks.ModelCheckpoint(model_save_path, save_best_only=True, monitor='val_loss'),
        CheckNaNLoss()
    ]
    
    print("Training...")
    history = model.fit(
        X_train,
        {'time_output': y_time_train, 'risk_output': y_risk_train},
        validation_data=(X_val, {'time_output': y_time_val, 'risk_output': y_risk_val}),
        epochs=50,
        batch_size=16,
        callbacks=callbacks
    )
    
    # Save training logs
    logs_path = "models/training_logs.json"
    with open(logs_path, 'w') as f:
        # Convert history float32 to float for json compatibility
        history_dict = {k: [float(val) for val in v] for k, v in history.history.items()}
        json.dump(history_dict, f)
        
    print(f"Training complete. Model saved to {model_save_path}")
    print(f"Logs saved to {logs_path}")
    
if __name__ == "__main__":
    train()
