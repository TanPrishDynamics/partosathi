import numpy as np
from .predict import predictor

def run_validation():
    print("Running Clinical AI Validation Suite...")
    
    # 1. Normal Progression
    # dilation (2->8), contractions (3), fhr (140), pulse (80), bp (120), time (0->9)
    normal_case = np.column_stack([
        np.linspace(2, 8, 10),
        np.full(10, 3),
        np.full(10, 140),
        np.full(10, 80),
        np.full(10, 120),
        np.arange(10)
    ])
    
    # 2. Fetal Distress (FHR Drop)
    distress_case = normal_case.copy()
    distress_case[-1, 2] = 90 # Drop to 90 bpm
    
    # 3. Slow Labor (Static Dilation)
    slow_case = normal_case.copy()
    slow_case[:, 0] = 4.0 # Stuck at 4cm
    
    # 4. Invalid Input (Shape)
    invalid_case = normal_case[:5] # Only 5 steps
    
    test_cases = [
        ("Normal", normal_case),
        ("Fetal Distress", distress_case),
        ("Slow Progress", slow_case),
        ("Invalid Shape", invalid_case)
    ]
    
    for name, data in test_cases:
        res = predictor.predict_patient(data)
        print(f"\n--- Test: {name} ---")
        if "error" in res:
             print(f"Outcome: Handled Error -> {res['error']}")
        else:
             print(f"Outcome: Risk Level = {res['risk_level']}, Time = {res['delivery_time_hours']} hrs")
             # Validate boundaries
             assert res['delivery_time_hours'] >= 0 or res['delivery_time_hours'] == -1
             assert res['risk_level'] in ["Normal", "Prolonged", "Emergency", "Unknown"]
             
             if name == "Fetal Distress":
                  assert res['risk_level'] == "Emergency"
             if name == "Slow Progress":
                  assert res['risk_level'] in ["Prolonged", "Emergency"]

    print("\nValidation Suite Complete.")

if __name__ == "__main__":
    run_validation()
