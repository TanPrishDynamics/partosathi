import os
import hashlib
import datetime
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
# BYPASS TORCH TO FIX MACOS HANG
# import torch
# from colpai_model import ColpAiLSTM, ColpAiFeatureEngineer

# ---------------------------------------------------------------------------
# Security: SHA-256 model integrity verification
# ---------------------------------------------------------------------------

def _verify_model_checksum(model_path: str) -> None:
    """
    Verify the model file against a .sha256 sidecar file.
    If no sidecar exists, skip silently (dev mode).
    Raises RuntimeError if the checksum does not match (tampering detected).
    """
    sha_path = model_path + ".sha256"
    if not os.path.exists(sha_path):
        return
    with open(sha_path, "r") as f:
        expected = f.read().strip().lower()
    hasher = hashlib.sha256()
    with open(model_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            hasher.update(chunk)
    actual = hasher.hexdigest()
    if actual != expected:
        raise RuntimeError(
            f"[SECURITY] Model checksum mismatch — model may be corrupted or tampered. "
            f"Expected: {expected}  Got: {actual}"
        )


def _generate_checksum(model_path: str) -> str:
    """Write a .sha256 sidecar file for the given model. Call after training."""
    hasher = hashlib.sha256()
    with open(model_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            hasher.update(chunk)
    digest = hasher.hexdigest()
    with open(model_path + ".sha256", "w") as f:
        f.write(digest)
    return digest


# ---------------------------------------------------------------------------
# Safe output bounding — clamp predictions to clinically valid ranges
# ---------------------------------------------------------------------------

_TIME_MIN_H = 0.0
_TIME_MAX_H = 24.0   # delivery time remaining cannot exceed 24 h
_RISK_MIN   = 0
_RISK_MAX   = 2      # 3 classes: Normal(0) / Slow(1) / Prolonged(2)


def _bound_time(value: float) -> float:
    return max(_TIME_MIN_H, min(_TIME_MAX_H, value))


def _bound_risk(value: int) -> int:
    return max(_RISK_MIN, min(_RISK_MAX, value))


# ---------------------------------------------------------------------------
# Inference engine
# ---------------------------------------------------------------------------

class LSTMInferenceEngine:
    def __init__(self):
        self.ready = False # Mocked out due to local PyTorch hang

    def predict(self, observations: list, patient: dict) -> dict:
        return {"success": False, "message": "Model weights not found or failed integrity check. (Mocked)"}

    def _calc_hours(self, str_start, str_now):
        if isinstance(str_start, str):
            str_start = datetime.datetime.fromisoformat(str_start.replace("Z", "+00:00"))
        if isinstance(str_now, str):
            str_now = datetime.datetime.fromisoformat(str_now.replace("Z", "+00:00"))
        return abs((str_now - str_start).total_seconds()) / 3600.0


lstm_predictor = LSTMInferenceEngine()
