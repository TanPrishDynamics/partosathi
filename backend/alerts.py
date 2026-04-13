"""
Clinical Decision Support Engine for the e-Partogram.
Evaluates a new observation against clinical rules and returns alert objects.
"""
from datetime import datetime, timezone


# ---------------------------------------------------------------------------
# Rule definitions
# ---------------------------------------------------------------------------

def _fhr_rules(obs):
    """Fetal Heart Rate rules."""
    results = []
    fhr = obs.fetal_heart_rate
    if fhr is None:
        return results

    if fhr < 110:
        results.append({
            "alert_type": "FETAL_BRADYCARDIA",
            "severity": "red",
            "message": f"⚠️ FETAL DISTRESS: Fetal heart rate is critically low ({fhr} bpm). Normal range: 110–160 bpm. Immediate intervention required.",
        })
    elif fhr > 160:
        results.append({
            "alert_type": "FETAL_TACHYCARDIA",
            "severity": "red",
            "message": f"⚠️ FETAL DISTRESS: Fetal heart rate is critically high ({fhr} bpm). Normal range: 110–160 bpm. Immediate assessment required.",
        })
    elif fhr < 120 or fhr > 150:
        results.append({
            "alert_type": "FHR_BORDERLINE",
            "severity": "yellow",
            "message": f"⚡ FHR BORDERLINE: Fetal heart rate ({fhr} bpm) is outside optimal range (120–150 bpm). Continue close monitoring.",
        })
    return results


def _cervical_progress_rules(obs, all_observations):
    """
    Cervical dilation progress rules.
    Alert line: 1 cm/hr from active phase start (4 cm).
    Action line: 4 hours right of alert line.
    Returns a list of alert dicts.
    """
    results = []
    dilation = obs.cervical_dilation
    if dilation is None:
        return results

    # Find previous observations with dilation recorded, sorted by time
    prev_obs = sorted(
        [o for o in all_observations if o.cervical_dilation is not None and o.id != obs.id],
        key=lambda o: o.timestamp,
    )

    if len(prev_obs) >= 1:
        latest_prev = prev_obs[-1]
        hours_elapsed = (obs.timestamp - latest_prev.timestamp).total_seconds() / 3600
        if hours_elapsed > 0:
            rate = (dilation - latest_prev.cervical_dilation) / hours_elapsed
            if rate < 1.0 and dilation >= 4.0 and hours_elapsed <= 4.0:
                results.append({
                    "alert_type": "SLOW_LABOR_PROGRESS",
                    "severity": "yellow",
                    "message": f"⚡ SLOW PROGRESS: Cervical dilation rate is {rate:.1f} cm/hr (expected ≥1 cm/hr in active phase). Monitor closely.",
                })

    # Alert line and Action line check (relative to active phase start)
    active_start = next(
        (o for o in sorted(all_observations, key=lambda o: o.timestamp) if o.cervical_dilation and o.cervical_dilation >= 4.0),
        None,
    )
    if active_start and obs.cervical_dilation is not None:
        hours_from_active = (obs.timestamp - active_start.timestamp).total_seconds() / 3600
        alert_line_dilation = 4.0 + (1.0 * hours_from_active)   # 1 cm/hr slope
        action_line_dilation = 4.0 + (1.0 * max(0, hours_from_active - 4.0))  # 4 hrs right

        if obs.cervical_dilation < action_line_dilation and hours_from_active > 4:
            results.append({
                "alert_type": "ACTION_LINE_CROSSED",
                "severity": "red",
                "message": f"🚨 ACTION LINE CROSSED: Labor has deviated beyond the action line. Cervical dilation ({obs.cervical_dilation} cm) is significantly below expected ({action_line_dilation:.1f} cm). Urgent obstetric review needed.",
            })
        elif obs.cervical_dilation < alert_line_dilation and hours_from_active > 0:
            results.append({
                "alert_type": "ALERT_LINE_CROSSED",
                "severity": "yellow",
                "message": f"⚠️ ALERT LINE: Labor is crossing the alert line. Dilation ({obs.cervical_dilation} cm) is below expected ({alert_line_dilation:.1f} cm). Consider augmentation.",
            })

    return results


def _contraction_descent_rules(obs, all_observations):
    """Strong contractions but no head descent → possible obstruction."""
    results = []
    freq = obs.contraction_freq
    duration = obs.contraction_duration
    station = obs.head_station

    if freq is None or duration is None or station is None:
        return results

    strong_contractions = freq >= 4 and duration >= 45

    if strong_contractions:
        prev_obs_with_station = sorted(
            [o for o in all_observations if o.head_station is not None and o.id != obs.id],
            key=lambda o: o.timestamp,
        )
        no_descent = True
        if len(prev_obs_with_station) >= 1:
            prev_station = prev_obs_with_station[-1].head_station
            if station > prev_station:  # lower station number = higher head
                no_descent = True
            else:
                no_descent = False

        if no_descent and len(prev_obs_with_station) >= 1:
            results.append({
                "alert_type": "POSSIBLE_OBSTRUCTION",
                "severity": "red",
                "message": f"🚨 POSSIBLE OBSTRUCTION: Strong contractions ({freq}/10 min, {duration}s) with no fetal head descent (station: {station:+g}). Rule out cephalopelvic disproportion.",
            })

    return results


def _bp_rules(obs):
    """Blood pressure and pre-eclampsia rules."""
    results = []
    sys = obs.bp_systolic
    dia = obs.bp_diastolic
    protein = obs.urine_protein

    if sys is None or dia is None:
        return results

    has_proteinuria = protein not in (None, "", "nil", "0", "negative")

    if sys >= 140 or dia >= 90:
        if has_proteinuria:
            results.append({
                "alert_type": "PRE_ECLAMPSIA_RISK",
                "severity": "red",
                "message": f"🚨 PRE-ECLAMPSIA RISK: BP {sys}/{dia} mmHg with proteinuria ({protein}). Immediate review — consider MgSO₄ prophylaxis and antihypertensive therapy.",
            })
        else:
            results.append({
                "alert_type": "SEVERE_HYPERTENSION",
                "severity": "red",
                "message": f"🚨 SEVERE HYPERTENSION: BP {sys}/{dia} mmHg. Antihypertensive therapy required. Assess for pre-eclampsia.",
            })
    elif sys >= 130 or dia >= 80:
        results.append({
            "alert_type": "ELEVATED_BP",
            "severity": "yellow",
            "message": f"⚡ ELEVATED BP: BP {sys}/{dia} mmHg is above normal range. Continue monitoring every 30 minutes.",
        })

    return results


def _temperature_rules(obs):
    """Maternal fever rules."""
    results = []
    temp = obs.temperature
    if temp is None:
        return results

    if temp >= 38.5:
        results.append({
            "alert_type": "HIGH_FEVER",
            "severity": "red",
            "message": f"🚨 HIGH FEVER: Temperature {temp}°C. Assess for chorioamnionitis and initiate antibiotic therapy.",
        })
    elif temp >= 38.0:
        results.append({
            "alert_type": "MATERNAL_FEVER",
            "severity": "yellow",
            "message": f"⚡ MATERNAL FEVER: Temperature {temp}°C. Rule out infection — check WBC and consider antibiotics.",
        })

    return results


def _amniotic_fluid_rules(obs):
    """Amniotic fluid rules."""
    results = []
    fluid = obs.amniotic_fluid
    if not fluid:
        return results

    if fluid.lower() in ("meconium", "thick meconium"):
        results.append({
            "alert_type": "MECONIUM_STAINED_FLUID",
            "severity": "yellow",
            "message": "⚡ MECONIUM-STAINED FLUID: Amniotic fluid is meconium-stained. Continuous fetal monitoring required. Prepare NICU.",
        })
    elif fluid.lower() == "blood":
        results.append({
            "alert_type": "BLOOD_STAINED_FLUID",
            "severity": "red",
            "message": "🚨 BLOOD-STAINED FLUID: Possible placental abruption or vasa praevia. Immediate obstetric assessment required.",
        })

    return results


def _pulse_rules(obs):
    """Maternal pulse rules."""
    results = []
    pulse = obs.maternal_pulse
    if pulse is None:
        return results

    if pulse > 120:
        results.append({
            "alert_type": "TACHYCARDIA",
            "severity": "red",
            "message": f"🚨 MATERNAL TACHYCARDIA: Pulse {pulse} bpm. Assess for haemorrhage, sepsis, or pulmonary embolism.",
        })
    elif pulse > 100:
        results.append({
            "alert_type": "ELEVATED_PULSE",
            "severity": "yellow",
            "message": f"⚡ ELEVATED PULSE: Pulse {pulse} bpm. Monitor for dehydration, infection, or anxiety.",
        })

    return results


# ---------------------------------------------------------------------------
# Main evaluation entry point
# ---------------------------------------------------------------------------

def evaluate_observation(obs, all_observations):
    """
    Evaluate a new Observation against all clinical rules.
    Returns a list of alert dicts ready to be persisted as Alert model instances.
    Each dict: { alert_type, severity, message }
    """
    raw_alerts = []
    raw_alerts.extend(_fhr_rules(obs))
    raw_alerts.extend(_cervical_progress_rules(obs, all_observations))
    raw_alerts.extend(_contraction_descent_rules(obs, all_observations))
    raw_alerts.extend(_bp_rules(obs))
    raw_alerts.extend(_temperature_rules(obs))
    raw_alerts.extend(_amniotic_fluid_rules(obs))
    raw_alerts.extend(_pulse_rules(obs))

    # De-duplicate within same observation (same type)
    seen = set()
    unique_alerts = []
    for a in raw_alerts:
        key = a["alert_type"]
        if key not in seen:
            seen.add(key)
            unique_alerts.append(a)

    return unique_alerts
