# e-Partogram Clinical AI Predictor

This is a production-grade prediction system for labor monitoring.

## Features
- **Deterministic Preprocessing**: Validates input against physiological boundaries.
- **Dual-Output LSTM**: Predicts time-to-delivery and risk level simultaneously.
- **Hybrid Safety System**: Neural network predictions are overridden by hardcoded clinical rules for absolute safety (e.g., fetal distress).

## Structure
- `src/`: Core logic (preprocessing, model, training, prediction).
- `models/`: Serialized Keras models.
- `data/scalers/`: Serialized scikit-learn scalers.
- `app/`: Streamlit dashboard for manual verification.

## Usage
1. Install dependencies: `pip install -r requirements.txt`
2. Train model: `python -m src.train`
3. Run validation: `python -m src.validation`
4. Run Streamlit: `streamlit run app/streamlit_app.py`
