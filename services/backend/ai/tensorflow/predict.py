import os
import numpy as np
import tensorflow as tf
from .preprocessing import preprocess_pipeline

class PredictionSystem:
    def __init__(self):
        self.base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.model_path = os.path.join(self.base_dir, 'models', 'lstm_model.h5')
        self.scaler_path = os.path.join(self.base_dir, 'data', 'scalers', 'scaler.pkl')
        self.model = None
        
    def load_model(self):
        if self.model is None:
            if not os.path.exists(self.model_path):
                raise FileNotFoundError(f"Model file not found at {self.model_path}")
            # Load with custom_objects if needed
            self.model = tf.keras.models.load_model(self.model_path)
            
    def predict_patient(self, raw_data):
        """
        Main entry point for clinical prediction.
        raw_data: list of 10 samples, each [dilation, contractions, fhr, pulse, bp, time]
        """
        try:
            # 1. Validation and Preprocessing
            processed_data = preprocess_pipeline(raw_data, self.scaler_path)
            
            # 2. Inference
            self.load_model()
            predictions = self.model.predict(processed_data, verbose=0)
            
            time_to_delivery = float(predictions[0][0][0])
            risk_probs = predictions[1][0]
            
            risk_idx = np.argmax(risk_probs)
            risk_levels = ["Normal", "Prolonged", "Emergency"]
            predicted_risk = risk_levels[risk_idx]
            confidence = float(risk_probs[risk_idx])
            
            # 3. Clinical Safety Overrides (SECTION 8)
            raw_arr = np.array(raw_data)
            last_fhr = raw_arr[-1, 2]
            
            final_risk = predicted_risk
            flags = []
            
            # Rule 1: Fetal Distress
            if last_fhr < 110 or last_fhr > 160:
                final_risk = "Emergency"
                flags.append("FHR ABNORMAL")
            
            # Rule 2: Progression Check
            # Check dilation increase < 1cm in 2 hours
            # We assume time is in hours (index 5)
            # Dilation is index 0
            # Looking at the difference between the 10th and 1st record if it spans 2+ hours
            time_span = raw_arr[-1, 5] - raw_arr[0, 5]
            dilation_increase = raw_arr[-1, 0] - raw_arr[0, 0]
            
            if time_span >= 2.0 and dilation_increase < 1.0:
                if final_risk != "Emergency":
                    final_risk = "Prolonged"
                flags.append("SLOW PROGRESSION")
                
            # Rule 3: Contractions check
            if raw_arr[-1, 1] < 2:
                 flags.append("WEAK LABOR")
                 
            return {
                "delivery_time_hours": round(time_to_delivery, 1),
                "risk_level": final_risk,
                "confidence": round(confidence, 3),
                "flags": flags,
                "disclaimer": "This prediction is AI-assisted and must not replace clinical judgment."
            }
            
        except Exception as e:
            return {
                "error": str(e),
                "risk_level": "Unknown",
                "delivery_time_hours": -1,
                "confidence": 0.0
            }

predictor = PredictionSystem()
