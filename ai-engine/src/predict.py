import os
import numpy as np
import tensorflow as tf
from .preprocessing import preprocess_pipeline

# Cache model and scaler paths
MODEL_PATH = "models/lstm_model.h5"
SCALER_PATH = "data/scalers/scaler.pkl"

class Predictor:
    def __init__(self):
        self.model = None

    def load_resources(self):
        if self.model is None:
            if not os.path.exists(MODEL_PATH):
                raise FileNotFoundError(f"Model not found at {MODEL_PATH}. Train the model first.")
            self.model = tf.keras.models.load_model(MODEL_PATH)
            
    def predict_patient(self, data):
        """
        Runs the full prediction pipeline.
        data must be a list/array of shape (10, 6)
        """
        # 1. Clinical Safety Override (Rule-based)
        # Features: [dilation, contractions, fhr, pulse, bp, time]
        try:
            data_arr = np.array(data, dtype=np.float32)
            if data_arr.shape != (10, 6):
                raise ValueError(f"Input must be shape (10, 6), got {data_arr.shape}")
        except Exception as e:
            return {"error": f"Invalid input format: {e}"}
            
        fhr_values = data_arr[:, 2]
        if np.any(fhr_values < 110) or np.any(fhr_values > 160):
            override_risk = "Emergency"
            override_reason = "FHR out of bounds (110-160)."
        else:
            # Check dilation progression over last 2 hours
            # Assuming time is at index 5 and dilation at 0
            recent_time = data_arr[-1, 5]
            past_idx = np.where(data_arr[:, 5] <= recent_time - 2)[0]
            override_risk = None
            if len(past_idx) > 0:
                past_dilation = data_arr[past_idx[-1], 0]
                current_dilation = data_arr[-1, 0]
                if (current_dilation - past_dilation) < 1.0:
                    override_risk = "Prolonged"
                    override_reason = "Dilation < 1cm in 2 hours."
                    
        # 2. Preprocess
        try:
            processed = preprocess_pipeline(data_arr, scaler_path=SCALER_PATH, is_training=False)
        except Exception as e:
            return {"error": f"Preprocessing failed: {e}"}
            
        # 3. Model Inference
        self.load_resources()
        predictions = self.model.predict(processed, verbose=0)
        
        time_pred = float(predictions[0][0][0])
        risk_probs = predictions[1][0]
        
        risk_classes = ["Normal", "Prolonged", "Emergency"]
        predicted_risk_idx = int(np.argmax(risk_probs))
        predicted_risk = risk_classes[predicted_risk_idx]
        confidence = float(risk_probs[predicted_risk_idx])
        
        # Apply clinical override
        final_risk = override_risk if override_risk else predicted_risk
        
        warnings = []
        if override_risk:
            warnings.append(f"AI prediction overridden by clinical rule: {override_reason}")
            
        if np.mean(data_arr[:, 1]) < 2:
            warnings.append("Weak labor: Contractions < 2 per 10min on average.")
            
        return {
            "delivery_time_hours": max(0.0, round(time_pred, 1)),
            "risk_level": final_risk,
            "confidence": round(confidence, 3),
            "warnings": warnings,
            "disclaimer": "This prediction is AI-assisted and must not replace clinical judgment."
        }

predictor_instance = Predictor()

def predict_patient(data):
    return predictor_instance.predict_patient(data)
