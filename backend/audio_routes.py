"""
e-Partogram Voice Input Routes
Handles audio upload, transcription, NLP extraction, and AI prediction.
"""
import os
import tempfile
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'ml'))
from nlp_extractor import extract_clinical_data, transcribe_audio_file

audio_bp = Blueprint('audio', __name__)


@audio_bp.route("/api/cds/voice-input", methods=["POST"])
@jwt_required()
def voice_input():
    """
    POST /api/cds/voice-input
    Accepts:
      - An audio file (wav/webm) as multipart/form-data under key 'audio'
      - OR a raw transcript string under JSON key 'transcript' (for testing)
    Returns:
      - extracted_data: structured clinical JSON
      - transcript: raw speech-to-text result
      - confidence_score: 0–1
      - ai_prediction: LSTM-based delivery prediction
    """
    transcript = None

    # ── Mode A: Pre-transcribed text (for frontend Web Speech API) ──
    if request.is_json:
        body = request.get_json()
        transcript = body.get("transcript", "").strip()

    # ── Mode B: Audio file blob ──────────────────────────────────────
    elif "audio" in request.files:
        audio_file = request.files["audio"]
        suffix = ".webm" if "webm" in audio_file.mimetype else ".wav"

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            audio_file.save(tmp.name)
            tmp_path = tmp.name

        try:
            transcript = transcribe_audio_file(tmp_path)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error("Audio transcription error: %s", e, exc_info=True)
            return jsonify({
                "success": False,
                "error": "Transcription failed. Ensure audio is clear and try again."
            }), 422
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    else:
        return jsonify({
            "success": False,
            "error": "No audio file or transcript provided."
        }), 400

    if not transcript:
        return jsonify({"success": False, "error": "Empty transcript."}), 400

    # ── NLP Extraction ───────────────────────────────────────────────
    result = extract_clinical_data(transcript)

    return jsonify({
        "success": result["success"],
        "input_mode": "voice",
        "transcript": transcript,
        "extracted_data": result["extracted_data"],
        "confidence_score": result["confidence_score"],
        "fields_extracted": result["fields_extracted"],
    }), 200


@audio_bp.route("/api/cds/extract-text", methods=["POST"])
@jwt_required()
def extract_text():
    """
    POST /api/cds/extract-text
    Lightweight endpoint that only processes a pre-transcribed string
    (used when the browser's Web Speech API does the transcription natively).
    Body: { "transcript": "dilation 5 cm at hour 4, contractions 3..." }
    """
    body = request.get_json()
    if not body or "transcript" not in body:
        return jsonify({"success": False, "error": "Missing 'transcript' field."}), 400

    transcript = body["transcript"].strip()
    if not transcript:
        return jsonify({"success": False, "error": "Empty transcript."}), 400

    result = extract_clinical_data(transcript)

    return jsonify({
        "success": result["success"],
        "input_mode": "voice",
        "transcript": transcript,
        "extracted_data": result["extracted_data"],
        "confidence_score": result["confidence_score"],
        "fields_extracted": result["fields_extracted"],
    }), 200
