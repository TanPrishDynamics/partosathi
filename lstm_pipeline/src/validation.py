import numpy as np
from .predict import predict_patient

def test_normal_labor():
    print("Testing Normal Labor...")
    # Simulated normal progression over 10 hours
    data = []
    for i in range(10):
        # Dilation progresses from 2 to 8
        dilation = 2 + (i * 0.6)
        contractions = 3 + (i * 0.1)
        fhr = 140
        pulse = 80
        bp = 120
        time = i * 1.0
        data.append([dilation, contractions, fhr, pulse, bp, time])
        
    result = predict_patient(data)
    print("Result:", result)
    assert result.get("error") is None
    assert result["delivery_time_hours"] >= 0

def test_fetal_distress():
    print("Testing Fetal Distress (FHR Drop)...")
    data = []
    for i in range(10):
        fhr = 140 if i < 8 else 90 # Drop at the end
        data.append([4, 3, fhr, 80, 120, i * 1.0])
        
    result = predict_patient(data)
    print("Result:", result)
    assert result["risk_level"] == "Emergency"
    assert "FHR" in result["warnings"][0]

def test_slow_labor():
    print("Testing Prolonged Labor...")
    data = []
    for i in range(10):
        # Dilation stuck at 4cm
        data.append([4.0, 3, 140, 80, 120, i * 1.0])
        
    result = predict_patient(data)
    print("Result:", result)
    assert result["risk_level"] == "Prolonged"

def test_invalid_shape():
    print("Testing Invalid Shape...")
    # Only 5 timesteps instead of 10
    data = np.zeros((5, 6))
    result = predict_patient(data)
    print("Result:", result)
    assert "error" in result

if __name__ == "__main__":
    test_normal_labor()
    test_fetal_distress()
    test_slow_labor()
    test_invalid_shape()
    print("All tests passed.")
