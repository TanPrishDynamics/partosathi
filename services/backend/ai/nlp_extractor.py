"""
e-Partogram Clinical NLP Extractor
Converts spoken obstetric sentences → validated structured JSON
"""
import re
from typing import Optional

# -------------------------------------------------------------------
# Word-to-number mapping
# -------------------------------------------------------------------
WORD_TO_NUM = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
    "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18,
    "nineteen": 19, "twenty": 20, "thirty": 30, "forty": 40,
    "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90,
    "hundred": 100, "minus": -1
}

def _words_to_float(text: str) -> Optional[float]:
    """
    Converts spoken number phrase to a float.
    Handles: "five point five", "minus two", "forty", "3"
    """
    text = text.strip().lower()

    # Direct numeric parse first
    try:
        return float(text)
    except ValueError:
        pass

    # Handle "point" decimals: "five point five" → 5.5
    point_match = re.match(r"^(.+?)\s+point\s+(.+)$", text)
    if point_match:
        integer_part = _words_to_float(point_match.group(1))
        decimal_part = _words_to_float(point_match.group(2))
        if integer_part is not None and decimal_part is not None:
            sign = -1 if integer_part < 0 else 1
            return integer_part + sign * (decimal_part / 10)

    # Handle minus: "minus two"
    if text.startswith("minus "):
        rest = _words_to_float(text[6:])
        if rest is not None:
            return -abs(rest)

    # Word number accumulation
    total = 0
    current = 0
    tokens = text.strip().split()
    for token in tokens:
        val = WORD_TO_NUM.get(token)
        if val is None:
            try:
                val = float(token)
            except ValueError:
                continue
        if val == 100:
            current = current * 100 if current > 0 else 100
        elif val >= 20:
            total += val
        else:
            current += val
    total += current
    return float(total) if total != 0 else None


def extract_clinical_data(transcript: str) -> dict:
    """
    Main extraction function. Takes a raw spoken transcript and returns
    a structured clinical dict matching the partogram input schema.

    Input:  "Patient at 4 hours, dilation 5.5 cm, contractions 3 in 10 minutes
             lasting 40 seconds, head at minus 2 station, FHR 140 bpm"
    Output: {"time_hours": 4, "cervical_dilation_cm": 5.5, ...}
    """
    text = transcript.lower().strip()
    data = {}
    confidence_hits = 0
    possible_fields = 8  # Total extractable fields

    # ── TIME ────────────────────────────────────────────────────────
    # Accept many spoken forms: "time 2 hour", "before 5 hour", "before 5 hour early", "at 4 hours", etc.
    patterns_time = [
        # "time 2 hour" or "at 4 hour" – capture the number before the word hour
        r"(?:at|time)\s+(\d+(?:\.\d+)?)\s*hour",
        # "before 5 hour" – optional leading word before the number
        r"(?:before)\s+(\d+(?:\.\d+)?)\s*hour",
        # Existing generic pattern for "4 hours" etc.
        r"(?:at|hour|hours?|time)\s+([\w\s.]+?)\s*(?:hour|hr|hrs?|,|$)",
        r"([\w\s.]+?)\s+hour[s]?\s+since",
    ]
    for p in patterns_time:
        m = re.search(p, text)
        if m:
            # The first capturing group contains the number (or phrase) we need
            val = _words_to_float(m.group(1).strip())
            if val is not None:
                data["time_hours"] = val
                confidence_hits += 1
                break

    # ── ADMISSION BEFORE ────────────────────────────────────────────
    # Detect phrases indicating time before admission and store as negative hours
    patterns_before_admission = [
        r"(\d+(?:\.\d+)?)\s*hour\s+before\s+(?:the\s+)?admission",
        r"before\s+(?:the\s+)?admission\s+(\d+(?:\.\d+)?)\s*hour",
    ]
    for p in patterns_before_admission:
        m = re.search(p, text)
        if m:
            val = _words_to_float(m.group(1).strip())
            if val is not None:
                data["time_hours"] = -abs(val)  # negative relative to admission
                data["admission_status"] = "before"
                confidence_hits += 1
                break

    # ── CERVICAL DILATION ───────────────────────────────────────────
    patterns_dil = [
        r"dilat\w*\s+(?:is\s+|of\s+)?([\w\s.]+?)\s*(?:cm|centimeters?|,|$)",
        r"([\w\s.]+?)\s*cm\s+dilat\w*",
        r"cervix\s+(?:at\s+)?([\w\s.]+?)\s*cm",
    ]
    for p in patterns_dil:
        m = re.search(p, text)
        if m:
            val = _words_to_float(m.group(1).strip())
            if val is not None and 0 <= val <= 10:
                data["cervical_dilation_cm"] = val
                confidence_hits += 1
                break

    # ── FETAL HEAD STATION ──────────────────────────────────────────
    # Look for the sign word separately from the numeric part
    station_sign_match = re.search(
        r"(?:head\s+at|station|head\s+station)\s+(minus|negative|plus|positive)?\s*([\w\s.]+?)(?:\s+station)?(?:,|$|\s+fhr|\s+contraction|\s+pulse|\s+membrane)",
        text
    )
    if station_sign_match:
        sign_word = station_sign_match.group(1)
        num_str = station_sign_match.group(2).strip()
        val = _words_to_float(num_str)
        if val is not None and 0 <= abs(val) <= 5:
            if sign_word in ("minus", "negative"):
                val = -abs(val)
            data["fetal_head_station"] = int(val)
            confidence_hits += 1

    # ── CONTRACTIONS FREQUENCY ──────────────────────────────────────
    patterns_contra = [
        r"contractions?\s+([\w\s]+?)\s+(?:in|per)\s+(?:ten|10)\s+min",
        r"([\w\s]+?)\s+contractions?\s+(?:in|per)\s+(?:ten|10)\s+min",
        r"([\w]+)\s+in\s+ten\s+minutes?",
    ]
    for p in patterns_contra:
        m = re.search(p, text)
        if m:
            val = _words_to_float(m.group(1).strip())
            if val is not None and 0 <= val <= 10:
                data["contraction_frequency_per_10min"] = int(val)
                confidence_hits += 1
                break

    # ── CONTRACTIONS DURATION ───────────────────────────────────────
    patterns_dur = [
        r"lasting\s+([\w\s]+?)\s*(?:seconds?|secs?|s\b)",
        r"([\w\s]+?)\s*(?:seconds?|secs?)\s+(?:duration|long|each)",
        r"duration\s+(?:of\s+)?([\w\s]+?)\s*(?:seconds?|secs?)",
    ]
    for p in patterns_dur:
        m = re.search(p, text)
        if m:
            val = _words_to_float(m.group(1).strip())
            if val is not None and 0 <= val <= 120:
                data["contraction_duration_sec"] = int(val)
                confidence_hits += 1
                break

    # ── FETAL HEART RATE ────────────────────────────────────────────
    patterns_fhr = [
        r"fhr\s+(?:is\s+)?([\w\s]+?)\s*(?:bpm|beats?)",
        r"fetal\s+heart\s+rate\s+(?:is\s+)?([\w\s]+?)\s*(?:bpm|beats?)",
        r"heart\s+rate\s+(?:is\s+)?([\w\s]+?)\s*bpm",
    ]
    for p in patterns_fhr:
        m = re.search(p, text)
        if m:
            val = _words_to_float(m.group(1).strip())
            if val is not None and 50 <= val <= 220:
                data["fetal_heart_rate"] = int(val)
                confidence_hits += 1
                break

    # ── MATERNAL PULSE ──────────────────────────────────────────────
    patterns_pulse = [
        r"(?:maternal\s+)?pulse\s+(?:is\s+)?([\w\s]+?)\s*(?:bpm|beats?)",
        r"maternal\s+heart\s+rate\s+([\w\s]+?)\s*bpm",
    ]
    for p in patterns_pulse:
        m = re.search(p, text)
        if m:
            val = _words_to_float(m.group(1).strip())
            if val is not None and 40 <= val <= 180:
                data["maternal_pulse"] = int(val)
                confidence_hits += 1
                break

    # ── MEMBRANE STATUS ─────────────────────────────────────────────
    if re.search(r"membranes?\s+ruptured|ruptured\s+membranes?|waters?\s+(?:have\s+)?broken", text):
        data["membrane_status"] = "ruptured"
        confidence_hits += 1
    elif re.search(r"membranes?\s+intact|intact\s+membranes?", text):
        data["membrane_status"] = "intact"
        confidence_hits += 1

    # ── CONFIDENCE SCORE ────────────────────────────────────────────
    confidence_score = round(confidence_hits / possible_fields, 2)

    return {
        "extracted_data": data,
        "raw_transcript": transcript,
        "confidence_score": confidence_score,
        "fields_extracted": confidence_hits,
        "success": len(data) > 0
    }


def transcribe_audio_file(audio_path: str) -> str:
    """
    Transcribes a local audio file (wav/webm) using SpeechRecognition
    with Google's free Web Speech API.
    """
    import speech_recognition as sr
    from pydub import AudioSegment
    import os
    import tempfile

    recognizer = sr.Recognizer()

    # Convert to WAV if needed (e.g., webm from browser)
    if not audio_path.endswith(".wav"):
        sound = AudioSegment.from_file(audio_path)
        tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        sound.export(tmp.name, format="wav")
        audio_path = tmp.name

    with sr.AudioFile(audio_path) as source:
        audio_data = recognizer.record(source)

    # Use Google Web Speech API (free tier, no API key required)
    transcript = recognizer.recognize_google(audio_data)
    return transcript


# ── SELF-TEST ─────────────────────────────────────────────────────
if __name__ == "__main__":
    samples = [
        "Patient at 4 hours, dilation 5.5 cm, contractions 3 in 10 minutes lasting 40 seconds, head at minus 2 station, FHR 140 bpm",
        "Time two hours, cervical dilation is three centimeters, contractions two in ten minutes lasting thirty seconds",
        "Dilation five point five cm at six hours, FHR one hundred forty bpm, head station minus three, contractions four in ten minutes lasting forty five seconds, membranes ruptured",
        "Eight hours, seven cm dilated, pulse 88, station minus one, three contractions in 10 min lasting fifty seconds",
    ]

    for s in samples:
        print(f"\n>> Input: {s}")
        result = extract_clinical_data(s)
        print(f"   Extracted: {result['extracted_data']}")
        print(f"   Confidence: {result['confidence_score']} ({result['fields_extracted']} fields)")
