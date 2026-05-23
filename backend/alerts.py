"""
Clinical Decision Support Engine for the e-Partogram.
Evaluates a new observation against clinical rules and returns alert objects.
"""
from datetime import datetime, timezone


# ---------------------------------------------------------------------------
# Rule definitions
# ---------------------------------------------------------------------------

def _fhr_rules(obs, all_observations):
    """Fetal Heart Rate rules — threshold + 3-reading rising trend."""
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

    # 3-reading rising trend — early warning even when within normal range
    # all_observations is pre-sorted by evaluate_observation
    if fhr <= 160:  # only check trend if not already tachycardia
        with_fhr = [o for o in all_observations if o.fetal_heart_rate is not None]
        if len(with_fhr) >= 3:
            r = with_fhr[-3:]
            # Fire only on the most recent observation
            if r[-1].id == obs.id:
                if r[0].fetal_heart_rate < r[1].fetal_heart_rate < r[2].fetal_heart_rate:
                    results.append({
                        "alert_type": "FHR_RISING_TREND",
                        "severity": "yellow",
                        "message": (
                            f"⚡ FHR RISING TREND: "
                            f"{r[0].fetal_heart_rate} → {r[1].fetal_heart_rate} → {r[2].fetal_heart_rate} bpm "
                            f"(3 consecutive readings increasing). Early warning of possible fetal distress."
                        ),
                    })
    return results


def _cervical_progress_rules(obs, all_observations):
    """
    Cervical dilation progress rules.
    Alert line: 1 cm/hr from active phase start (4 cm), clamped at 10 cm.
    Action line: alert line shifted +4 hours right, clamped at 10 cm.
    Returns a list of alert dicts.
    """
    results = []
    dilation = obs.cervical_dilation
    if dilation is None:
        return results

    # Clamp dilation — never compare beyond 10 cm
    dilation = min(10.0, dilation)

    # all_observations is pre-sorted by evaluate_observation; filter without re-sorting
    prev_obs = [o for o in all_observations if o.cervical_dilation is not None and o.id != obs.id]

    # Rate checks — compute once, evaluate both thresholds
    if len(prev_obs) >= 1:
        latest_prev = prev_obs[-1]
        hours_elapsed = (obs.timestamp - latest_prev.timestamp).total_seconds() / 3600
        if hours_elapsed > 0 and dilation >= 4.0:
            rate = (dilation - min(10.0, latest_prev.cervical_dilation)) / hours_elapsed
            if rate < 1.0:
                results.append({
                    "alert_type": "SLOW_LABOR_PROGRESS",
                    "severity": "yellow",
                    "message": f"⚡ SLOW PROGRESS: Cervical dilation rate is {rate:.2f} cm/hr (expected ≥1 cm/hr in active phase). Monitor closely and consider augmentation.",
                })
            elif rate > 2.0:
                results.append({
                    "alert_type": "RAPID_LABOUR",
                    "severity": "yellow",
                    "message": f"⚡ RAPID LABOUR: Cervical dilation rate is {rate:.2f} cm/hr (> 2 cm/hr). Risks: uterine rupture, fetal distress. Close monitoring required.",
                })

    # Alert line and Action line crossing — reuse already-sorted prev_obs to find active start
    active_start = next(
        (o for o in prev_obs if o.cervical_dilation and o.cervical_dilation >= 4.0),
        None,
    )
    if active_start and obs.cervical_dilation is not None:
        hours_from_active = (obs.timestamp - active_start.timestamp).total_seconds() / 3600

        # Alert line: 4 + (hours_from_active * 1), clamped at 10
        alert_line_dilation  = min(10.0, 4.0 + (1.0 * hours_from_active))
        # Action line: 4 + (hours_from_active - 4) * 1, only valid after 4h, clamped at 10
        action_line_dilation = min(10.0, 4.0 + (1.0 * max(0.0, hours_from_active - 4.0)))

        # Action line: fires only after 4 h from active start AND only if action line > 4
        if hours_from_active > 4 and dilation < action_line_dilation:
            results.append({
                "alert_type": "ACTION_LINE_CROSSED",
                "severity": "red",
                "message": (
                    f"🚨 ACTION LINE CROSSED: Dilation {dilation} cm is below action line "
                    f"({action_line_dilation:.1f} cm at {hours_from_active:.1f}h from active phase start). "
                    f"Urgent obstetric review — prepare for operative delivery."
                ),
            })
        # Alert line: fires from active start, but NOT when action line has already fired
        elif hours_from_active > 0 and dilation < alert_line_dilation:
            results.append({
                "alert_type": "ALERT_LINE_CROSSED",
                "severity": "yellow",
                "message": (
                    f"⚠️ ALERT LINE: Dilation {dilation} cm is below alert line "
                    f"({alert_line_dilation:.1f} cm expected at {hours_from_active:.1f}h). "
                    f"Consider augmentation if no progress within 1 hour."
                ),
            })

    return results


def _inadequate_contractions_rules(obs):
    """WHO: Adequate active-phase contractions = ≥3/10 min AND ≥40 s."""
    results = []
    dilation = obs.cervical_dilation
    freq = obs.contraction_freq
    duration = obs.contraction_duration

    if dilation is None or dilation < 4.0:
        return results
    if freq is None or duration is None:
        return results

    if freq < 3 or duration < 40:
        results.append({
            "alert_type": "INADEQUATE_UTERINE_ACTIVITY",
            "severity": "yellow",
            "message": (
                f"⚡ INADEQUATE UTERINE ACTIVITY: {freq}/10 min, {duration}s. "
                f"WHO standard: ≥3 contractions/10 min, ≥40 s in active phase. "
                f"Consider oxytocin augmentation."
            ),
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
    # Note: BP 130-139 / 80-89 is NOT flagged — WHO hypertension threshold is ≥140/90

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
    # Sort once here; pass to every rule that needs time-ordered observations
    sorted_obs = sorted(all_observations, key=lambda o: o.timestamp)
    raw_alerts = []
    raw_alerts.extend(_fhr_rules(obs, sorted_obs))
    raw_alerts.extend(_cervical_progress_rules(obs, sorted_obs))
    raw_alerts.extend(_inadequate_contractions_rules(obs))
    raw_alerts.extend(_contraction_descent_rules(obs, sorted_obs))
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
