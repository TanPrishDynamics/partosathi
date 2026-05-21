"""
tests/test_who_cases.py
────────────────────────
WHO-standard clinical validation tests for the e-Partogram alert engine.

Tests verify that evaluate_observation() produces the correct alert types
for each of the 5 test scenarios (no DB or Flask app required — pure logic).

Run from the project root:
    pytest tests/test_who_cases.py -v
"""

import sys
import os
from datetime import datetime, timedelta
from unittest.mock import MagicMock

# Make the backend importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from alerts import evaluate_observation


# ──────────────────────────────────────────────────────────────────────────────
# Observation factory — builds a mock Observation-like object
# ──────────────────────────────────────────────────────────────────────────────

def make_obs(
    obs_id,
    timestamp,
    dilation=None,
    fhr=None,
    contractions=None,
    contraction_duration=35,
    station=None,
    pulse=None,
    bp_sys=None,
    bp_dia=None,
    temp=36.8,
    amniotic_fluid="clear",
    moulding="0",
    urine_protein="nil",
    urine_ketones="nil",
    urine_volume=150,
):
    """Return a mock Observation with the given field values."""
    o = MagicMock()
    o.id = obs_id
    o.timestamp = timestamp
    o.cervical_dilation = dilation
    o.fetal_heart_rate = fhr
    o.contraction_freq = contractions
    o.contraction_duration = contraction_duration
    o.head_station = station
    o.maternal_pulse = pulse
    o.bp_systolic = bp_sys
    o.bp_diastolic = bp_dia
    o.temperature = temp
    o.amniotic_fluid = amniotic_fluid
    o.moulding = moulding
    o.urine_protein = urine_protein
    o.urine_ketones = urine_ketones
    o.urine_volume = urine_volume
    return o


def alert_types(alerts):
    return {a["alert_type"] for a in alerts}


def severities(alerts):
    return {a["severity"] for a in alerts}


# ──────────────────────────────────────────────────────────────────────────────
# Case 1 — Sita Devi: Normal Labour (ideal WHO pattern)
# Expected: No action-line / alert-line alerts (progress ≥1 cm/hr)
# ──────────────────────────────────────────────────────────────────────────────

class TestCase1NormalLabour:
    BASE = datetime(2026, 4, 21, 8, 0, 0)

    @classmethod
    def _build_series(cls):
        """6-point series: 4 → 5 → 6 → 7 → 9 → 10 cm over 9.5 h."""
        raw = [
            (0.0,  4,  140, 2, -2, 82,  120, 80),
            (2.0,  5,  138, 3, -1, 84,  118, 78),
            (4.0,  6,  142, 3,  0, 86,  120, 80),
            (6.0,  7,  145, 4,  1, 88,  122, 82),
            (8.0,  9,  148, 4,  2, 90,  120, 80),
            (9.5, 10,  150, 5,  3, 92,  118, 80),
        ]
        return [
            make_obs(i + 1, cls.BASE + timedelta(hours=h), dilation=d, fhr=f,
                     contractions=c, station=s, pulse=p, bp_sys=bs, bp_dia=bd)
            for i, (h, d, f, c, s, p, bs, bd) in enumerate(raw)
        ]

    def test_no_action_line_alert(self):
        series = self._build_series()
        for obs in series:
            alerts = evaluate_observation(obs, series)
            assert "ACTION_LINE_CROSSED" not in alert_types(alerts), (
                f"Unexpected ACTION_LINE_CROSSED at dilation={obs.cervical_dilation}"
            )

    def test_no_fetal_distress(self):
        series = self._build_series()
        for obs in series:
            alerts = evaluate_observation(obs, series)
            assert "FETAL_BRADYCARDIA" not in alert_types(alerts)
            assert "FETAL_TACHYCARDIA" not in alert_types(alerts)

    def test_fhr_within_normal_range(self):
        """All FHR readings (138–150) should be inside 110–160, no red alerts."""
        series = self._build_series()
        for obs in series:
            alerts = evaluate_observation(obs, series)
            red_alerts = [a for a in alerts if a["severity"] == "red"]
            assert red_alerts == [], (
                f"Unexpected red alert at obs {obs.id}: {red_alerts}"
            )

    def test_full_dilation_reached(self):
        """Last observation should have dilation == 10."""
        series = self._build_series()
        assert series[-1].cervical_dilation == 10


# ──────────────────────────────────────────────────────────────────────────────
# Case 2 — Meena Kumari: Slow Progress (crosses alert line)
# Expected: ALERT_LINE_CROSSED (yellow), SLOW_LABOR_PROGRESS (yellow)
#           No ACTION_LINE (first 4 h of active phase; crosses later)
# ──────────────────────────────────────────────────────────────────────────────

class TestCase2SlowProgress:
    BASE = datetime(2026, 4, 21, 9, 0, 0)

    @classmethod
    def _build_series(cls):
        raw = [
            (0.0,  4, 142, 2, -3, 80, 116, 76),
            (2.0,  4, 140, 2, -3, 82, 118, 78),
            (4.0,  5, 138, 2, -2, 84, 116, 76),
            (6.0,  5, 136, 3, -2, 86, 120, 80),
            (8.0,  6, 135, 3, -1, 88, 118, 78),
            (10.0, 6, 134, 3, -1, 90, 120, 80),
        ]
        return [
            make_obs(i + 1, cls.BASE + timedelta(hours=h), dilation=d, fhr=f,
                     contractions=c, station=s, pulse=p, bp_sys=bs, bp_dia=bd)
            for i, (h, d, f, c, s, p, bs, bd) in enumerate(raw)
        ]

    def test_alert_line_crossed_detected(self):
        """After 4+ hours with <1 cm/hr progress, ALERT_LINE_CROSSED must fire."""
        series = self._build_series()
        all_alert_types = set()
        for obs in series:
            all_alert_types |= alert_types(evaluate_observation(obs, series))
        assert "ALERT_LINE_CROSSED" in all_alert_types, (
            "Expected ALERT_LINE_CROSSED for slow-progress case."
        )

    def test_alert_line_is_yellow_not_red(self):
        """Alert-line crossing is a warning (yellow), not emergency (red)."""
        series = self._build_series()
        for obs in series:
            alerts = evaluate_observation(obs, series)
            for a in alerts:
                if a["alert_type"] == "ALERT_LINE_CROSSED":
                    assert a["severity"] == "yellow"

    def test_slow_progress_alert_fired(self):
        series = self._build_series()
        all_types = set()
        for obs in series:
            all_types |= alert_types(evaluate_observation(obs, series))
        assert "SLOW_LABOR_PROGRESS" in all_types

    def test_inadequate_contractions_detected(self):
        """2/10 min contractions in active phase should trigger INADEQUATE_UTERINE_ACTIVITY."""
        series = self._build_series()
        all_types = set()
        for obs in series:
            all_types |= alert_types(evaluate_observation(obs, series))
        assert "INADEQUATE_UTERINE_ACTIVITY" in all_types


# ──────────────────────────────────────────────────────────────────────────────
# Case 3 — Rekha Singh: Danger (action line crossed + rising FHR)
# Expected: ACTION_LINE_CROSSED (red), FETAL_TACHYCARDIA (red)
# ──────────────────────────────────────────────────────────────────────────────

class TestCase3DangerZone:
    BASE = datetime(2026, 4, 21, 8, 0, 0)

    @classmethod
    def _build_series(cls):
        raw = [
            (0.0,  4, 150, 2, -3, 80, 118, 76),
            (2.0,  4, 152, 2, -3, 82, 120, 78),
            (4.0,  5, 155, 2, -2, 84, 118, 76),
            (6.0,  5, 158, 2, -2, 86, 122, 80),
            (8.0,  6, 160, 2, -1, 88, 120, 80),
            (10.0, 6, 165, 2, -1, 92, 124, 82),
        ]
        return [
            make_obs(i + 1, cls.BASE + timedelta(hours=h), dilation=d, fhr=f,
                     contractions=c, station=s, pulse=p, bp_sys=bs, bp_dia=bd)
            for i, (h, d, f, c, s, p, bs, bd) in enumerate(raw)
        ]

    def test_action_line_crossed_detected(self):
        """After 4+ hours in active phase with < required dilation, ACTION_LINE must fire."""
        series = self._build_series()
        all_types = set()
        for obs in series:
            all_types |= alert_types(evaluate_observation(obs, series))
        assert "ACTION_LINE_CROSSED" in all_types, (
            "Expected ACTION_LINE_CROSSED for danger-zone case."
        )

    def test_action_line_is_red(self):
        series = self._build_series()
        for obs in series:
            alerts = evaluate_observation(obs, series)
            for a in alerts:
                if a["alert_type"] == "ACTION_LINE_CROSSED":
                    assert a["severity"] == "red"

    def test_fetal_tachycardia_on_last_obs(self):
        """FHR 165 on last observation must trigger FETAL_TACHYCARDIA."""
        series = self._build_series()
        last_obs = series[-1]
        alerts = evaluate_observation(last_obs, series)
        assert "FETAL_TACHYCARDIA" in alert_types(alerts), (
            f"Expected FETAL_TACHYCARDIA for FHR={last_obs.fetal_heart_rate}"
        )

    def test_danger_zone_has_red_alerts(self):
        """At least one red-severity alert must appear across the entire series."""
        series = self._build_series()
        any_red = False
        for obs in series:
            if any(a["severity"] == "red" for a in evaluate_observation(obs, series)):
                any_red = True
                break
        assert any_red, "Expected at least one red-severity alert in Case 3."


# ──────────────────────────────────────────────────────────────────────────────
# Case 4 — Fetal Distress (tachycardia ≥161 bpm)
# Expected: FETAL_TACHYCARDIA (red) on every observation
# ──────────────────────────────────────────────────────────────────────────────

class TestCase4FetalDistress:
    BASE = datetime(2026, 4, 21, 10, 0, 0)

    @classmethod
    def _build_series(cls):
        raw = [
            (0.0,  6, 170, 3, -1, 88, 118, 76),
            (0.5,  6, 172, 3, -1, 90, 120, 78),
            (1.0,  7, 175, 4,  0, 92, 118, 76),
        ]
        return [
            make_obs(i + 1, cls.BASE + timedelta(hours=h), dilation=d, fhr=f,
                     contractions=c, station=s, pulse=p, bp_sys=bs, bp_dia=bd)
            for i, (h, d, f, c, s, p, bs, bd) in enumerate(raw)
        ]

    def test_fetal_tachycardia_on_all_obs(self):
        series = self._build_series()
        for obs in series:
            alerts = evaluate_observation(obs, series)
            assert "FETAL_TACHYCARDIA" in alert_types(alerts), (
                f"FETAL_TACHYCARDIA expected for FHR={obs.fetal_heart_rate}"
            )

    def test_fetal_tachycardia_severity_is_red(self):
        series = self._build_series()
        for obs in series:
            alerts = evaluate_observation(obs, series)
            for a in alerts:
                if a["alert_type"] == "FETAL_TACHYCARDIA":
                    assert a["severity"] == "red"

    def test_no_bradycardia_false_positive(self):
        series = self._build_series()
        for obs in series:
            alerts = evaluate_observation(obs, series)
            assert "FETAL_BRADYCARDIA" not in alert_types(alerts)


# ──────────────────────────────────────────────────────────────────────────────
# Case 5 — Hyperactive Labour (>2 cm/hr — precipitous delivery)
# Expected: Rapid rate should NOT trigger "slow progress" alerts;
#           FHR stays within normal range.
# ──────────────────────────────────────────────────────────────────────────────

class TestCase5HyperactiveLab:
    BASE = datetime(2026, 4, 21, 8, 0, 0)

    @classmethod
    def _build_series(cls):
        raw = [
            (0.0,  4,  142, 4, -2, 85, 118, 76, 50),
            (1.0,  6,  148, 5, -1, 90, 120, 78, 55),
            (2.0,  8,  152, 5,  0, 92, 118, 76, 55),
            (3.0, 10,  156, 6,  2, 96, 122, 80, 60),
        ]
        return [
            make_obs(i + 1, cls.BASE + timedelta(hours=h), dilation=d, fhr=f,
                     contractions=c, station=s, pulse=p, bp_sys=bs, bp_dia=bd,
                     contraction_duration=dur)
            for i, (h, d, f, c, s, p, bs, bd, dur) in enumerate(raw)
        ]

    def test_no_slow_progress_alert(self):
        """2 cm/hr rate should NOT trigger slow-progress or alert-line alerts."""
        series = self._build_series()
        all_types = set()
        for obs in series:
            all_types |= alert_types(evaluate_observation(obs, series))
        assert "SLOW_LABOR_PROGRESS" not in all_types
        assert "ALERT_LINE_CROSSED" not in all_types
        assert "ACTION_LINE_CROSSED" not in all_types

    def test_full_dilation_in_3_hours(self):
        """Last observation dilation should reach 10 cm within 3 hours."""
        series = self._build_series()
        assert series[-1].cervical_dilation == 10
        time_span = (series[-1].timestamp - series[0].timestamp).total_seconds() / 3600
        assert time_span <= 3.0

    def test_fhr_in_acceptable_range(self):
        """FHR 142–156 should not trigger tachycardia (threshold >160)."""
        series = self._build_series()
        for obs in series:
            alerts = evaluate_observation(obs, series)
            assert "FETAL_TACHYCARDIA" not in alert_types(alerts)
            assert "FETAL_BRADYCARDIA" not in alert_types(alerts)


# ──────────────────────────────────────────────────────────────────────────────
# Bonus — Dilation Rate Classification
# ──────────────────────────────────────────────────────────────────────────────

class TestDilationRateClassification:
    """Validate the three labour-speed categories mentioned in the dataset."""

    def _rate_category(self, cm_per_hour):
        if cm_per_hour >= 2.0:
            return "fast"
        if cm_per_hour >= 1.0:
            return "normal"
        return "slow"

    def test_normal_rate(self):
        assert self._rate_category(1.0) == "normal"
        assert self._rate_category(1.5) == "normal"

    def test_slow_rate(self):
        assert self._rate_category(0.5) == "slow"
        assert self._rate_category(0.3) == "slow"

    def test_fast_rate(self):
        assert self._rate_category(2.0) == "fast"
        assert self._rate_category(3.0) == "fast"


# ──────────────────────────────────────────────────────────────────────────────
# Edge-case guard tests
# ──────────────────────────────────────────────────────────────────────────────

class TestEdgeCases:

    def test_fhr_exactly_110_no_bradycardia(self):
        """FHR exactly 110 is the lower edge of normal — no bradycardia alert."""
        BASE = datetime(2026, 4, 21, 8, 0)
        obs = make_obs(1, BASE, dilation=5, fhr=110, contractions=3)
        alerts = evaluate_observation(obs, [obs])
        assert "FETAL_BRADYCARDIA" not in alert_types(alerts)

    def test_fhr_109_triggers_bradycardia(self):
        BASE = datetime(2026, 4, 21, 8, 0)
        obs = make_obs(1, BASE, dilation=5, fhr=109, contractions=3)
        alerts = evaluate_observation(obs, [obs])
        assert "FETAL_BRADYCARDIA" in alert_types(alerts)

    def test_fhr_161_triggers_tachycardia(self):
        BASE = datetime(2026, 4, 21, 8, 0)
        obs = make_obs(1, BASE, dilation=5, fhr=161, contractions=3)
        alerts = evaluate_observation(obs, [obs])
        assert "FETAL_TACHYCARDIA" in alert_types(alerts)

    def test_fhr_160_no_tachycardia(self):
        """FHR exactly 160 is the upper edge of normal — no tachycardia alert."""
        BASE = datetime(2026, 4, 21, 8, 0)
        obs = make_obs(1, BASE, dilation=5, fhr=160, contractions=3)
        alerts = evaluate_observation(obs, [obs])
        assert "FETAL_TACHYCARDIA" not in alert_types(alerts)

    def test_bp_140_90_without_proteinuria_triggers_hypertension(self):
        BASE = datetime(2026, 4, 21, 8, 0)
        obs = make_obs(1, BASE, dilation=5, fhr=135, bp_sys=140, bp_dia=90, urine_protein="nil")
        alerts = evaluate_observation(obs, [obs])
        assert "SEVERE_HYPERTENSION" in alert_types(alerts)

    def test_bp_140_90_with_proteinuria_triggers_preeclampsia(self):
        BASE = datetime(2026, 4, 21, 8, 0)
        obs = make_obs(1, BASE, dilation=5, fhr=135, bp_sys=140, bp_dia=90, urine_protein="+")
        alerts = evaluate_observation(obs, [obs])
        assert "PRE_ECLAMPSIA_RISK" in alert_types(alerts)

    def test_meconium_fluid_alert(self):
        BASE = datetime(2026, 4, 21, 8, 0)
        obs = make_obs(1, BASE, dilation=6, fhr=138, amniotic_fluid="meconium")
        alerts = evaluate_observation(obs, [obs])
        assert "MECONIUM_STAINED_FLUID" in alert_types(alerts)

    def test_no_alerts_missing_vitals(self):
        """Observation with no vitals should produce no alerts (graceful nulls)."""
        BASE = datetime(2026, 4, 21, 8, 0)
        obs = make_obs(1, BASE)  # all None defaults
        alerts = evaluate_observation(obs, [obs])
        assert alerts == []
