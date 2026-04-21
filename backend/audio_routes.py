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

# ── M-2: Audio magic-byte signatures (no external library needed) ─────────────
# Maps first-N-bytes patterns to accepted MIME types.
# File pointer is always reset after reading so downstream processing is unaffected.
_AUDIO_SIGNATURES = [
    (b'RIFF',         'audio/wav'),         # WAV
    (b'ID3',          'audio/mpeg'),         # MP3 with ID3 tag
    (b'\xff\xfb',    'audio/mpeg'),         # MP3 frame sync
    (b'\xff\xf3',    'audio/mpeg'),         # MP3 frame sync
    (b'\xff\xf2',    'audio/mpeg'),         # MP3 frame sync
    (b'fLaC',         'audio/flac'),         # FLAC
    (b'OggS',         'audio/ogg'),          # OGG / Opus
    (b'\x1aE\xdf\xa3', 'audio/webm'),      # WebM audio
    (b'\x00\x00\x00', 'audio/mp4'),         # M4A / AAC (partial)
]

_MAX_AUDIO_BYTES = 10 * 1024 * 1024  # 10 MB hard limit


def _validate_audio_signature(file_obj):
    """
    Reads up to 12 bytes from file_obj, checks against known audio magic bytes,
    then resets the file pointer back to 0.
    Returns (is_valid: bool, detected_type: str | None).
    """
    header = file_obj.read(12)
    file_obj.seek(0)   # always reset — downstream code re-reads from start
    for sig, mime in _AUDIO_SIGNATURES:
        if header[:len(sig)] == sig:
            return True, mime
    return False, None


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

        # M-2: Size guard — reject before any disk write
        audio_file.stream.seek(0, 2)          # seek to end
        file_size = audio_file.stream.tell()
        audio_file.stream.seek(0)             # reset to start
        if file_size > _MAX_AUDIO_BYTES:
            return jsonify({
                "success": False,
                "error": f"Audio file too large. Maximum allowed size is {_MAX_AUDIO_BYTES // (1024*1024)} MB."
            }), 413

        # M-2: Magic-byte signature check — rejects disguised files (seek(0) is done inside)
        is_valid, detected_mime = _validate_audio_signature(audio_file.stream)
        if not is_valid:
            return jsonify({
                "success": False,
                "error": "Invalid audio file. Only WAV, MP3, OGG, FLAC, WebM, and M4A formats are accepted."
            }), 400

        suffix = ".webm" if "webm" in (detected_mime or "") else ".wav"
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
