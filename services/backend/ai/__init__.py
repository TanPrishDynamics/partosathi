"""
services/backend/ai/__init__.py

AI/ML inference layer for e-Partogram.

Providers:
    pytorch/    — PyTorch LSTM inference (colpai_model, inference)
    tensorflow/ — TensorFlow/Keras LSTM production pipeline

Shared:
    llm_summary     — Gemini/Google AI clinical narrative generation
    nlp_extractor   — spaCy-based NLP entity extraction from voice input

Models:
    models/lstm_model.pth      — PyTorch model weights (SHA256 verified)
    models/lstm_model.h5       — TensorFlow/Keras model weights
"""
