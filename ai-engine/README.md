# AI Engine — e-Partogram LSTM Training Pipeline

Standalone training pipeline for the e-Partogram LSTM labor progression model.

> **Note**: This is the *training* pipeline. The production *inference* layer lives at
> `services/backend/ai/` and is served by the Flask API.

## Structure

```
ai-engine/
├── src/
│   ├── model.py          — LSTM architecture definition
│   ├── preprocessing.py  — Feature engineering & normalization
│   ├── train.py          — Training loop & evaluation
│   ├── predict.py        — Batch prediction utilities
│   └── validation.py     — Input data validation
├── models/
│   ├── lstm_model.h5     — Trained Keras model weights
│   └── training_logs.json — Training history & metrics
├── data/
│   └── scalers/          — Fitted MinMaxScaler artifacts
├── app/
│   └── streamlit_app.py  — Interactive monitoring dashboard
└── requirements.txt
```

## Usage

```bash
cd ai-engine
pip install -r requirements.txt

# Train model
python src/train.py

# Run predictions
python src/predict.py

# Interactive dashboard
streamlit run app/streamlit_app.py
```

## Model Architecture

- **Type**: LSTM (Long Short-Term Memory)
- **Input**: Temporal sequence of labor observations (dilation, FHR, contractions, vitals)
- **Output**: Predicted time to delivery + risk classification
- **Framework**: TensorFlow/Keras
- **Training data**: WHO synthetic labor progression dataset

## Deploying Updated Models

After retraining, copy the updated weights to the inference layer:
```bash
cp models/lstm_model.h5 ../services/backend/ai/models/
```

Run the SHA256 hash update:
```bash
sha256sum ../services/backend/ai/models/lstm_model.pth > ../services/backend/ai/models/lstm_model.pth.sha256
```
