# e-Partogram Clinical AI Predictor

A production-grade, LSTM-based machine learning pipeline for predicting expected delivery time and stratifying labor risk levels.

## Architecture

This module is designed with absolute clinical safety and deterministic reliability in mind.
- **Model**: Dual-headed LSTM for simultaneous regression (Time to Delivery) and classification (Risk Level).
- **Clinical Overrides**: Rule-based guardrails ensure that absolute physiological emergencies (e.g., FHR out of bounds) override the neural network output.
- **Data Shape**: `(time_steps=10, features=6)`

## Setup

1. Install requirements:
```bash
pip install -r requirements.txt
```

2. Train the initial model and generate scalers:
```bash
python -m src.train
```

3. Run the validation suite to guarantee mathematical boundaries:
```bash
python -m src.validation
```

4. Launch the Streamlit Clinical Interface:
```bash
streamlit run app/streamlit_app.py
```

## Clinical Safety Disclaimer
This prediction is AI-assisted and must **not** replace professional clinical judgment.
