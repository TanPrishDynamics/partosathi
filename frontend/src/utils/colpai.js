/**
 * ColpAI — Client-Side WHO Partogram Rule Engine v2
 * Strictly enforces WHO (2020) Labour Care Guidelines.
 *
 * KEY DESIGN PRINCIPLE (v2):
 *   graph_status  — derived purely from dilation curve vs alert/action lines
 *   clinical_status — derived from all other parameters (FHR, contractions, BP, etc.)
 *   overall status  — worst of graph_status and clinical_status
 *
 *   "Left of alert line" = NORMAL graph progress — NEVER call this "Borderline".
 *   Clinical factors can independently elevate the final classification.
 */

// ─── WHO Constants ────────────────────────────────────────────────────────────
const ACTIVE_PHASE_CM   = 4;     // cm — WHO active phase threshold
const ALERT_SLOPE       = 1;     // cm/hr
const ACTION_OFFSET_HRS = 4;     // hrs right-shift for action line
const FHR_MIN           = 110;   // bpm
const FHR_MAX           = 160;   // bpm
const ADEQUATE_FREQ     = 3;     // contractions/10 min
const ADEQUATE_DUR_SEC  = 40;    // seconds
const BP_SYS_HT         = 140;   // mmHg — WHO hypertension threshold (NOT 130)
const BP_DIA_HT         = 90;    // mmHg
const TEMP_FEVER        = 38.0;  // °C
const PULSE_TACHY       = 100;   // bpm
const MAX_TIME_GAP_HRS  = 2;     // hours — flag large gaps
const MAX_STATION_JUMP  = 2;     // station levels — flag impossible jumps

// ─── Line Geometry Helpers ───────────────────────────────────────────────────

/**
 * Alert line dilation at a given time.
 * Formula: alert_y = 4 + (time - active_start_time)
 * Returns null if before active phase.
 */
export function alertLineDilationAt(timeHours, timeAt4cm) {
  if (timeAt4cm === null || timeHours < timeAt4cm) return null;
  return Math.min(10, ACTIVE_PHASE_CM + ALERT_SLOPE * (timeHours - timeAt4cm));
}

/**
 * Action line dilation at a given time.
 * Formula: action_y = 4 + (time - (active_start_time + 4))
 * Returns null before action line begins.
 */
export function actionLineDilationAt(timeHours, timeAt4cm) {
  if (timeAt4cm === null) return null;
  const actionStart = timeAt4cm + ACTION_OFFSET_HRS;
  if (timeHours < actionStart) return null;
  return Math.min(10, ACTIVE_PHASE_CM + ALERT_SLOPE * (timeHours - actionStart));
}

/**
 * Build alert-line dataset for Chart.js.
 * Anchored exactly at (timeAt4cm, 4 cm).
 */
export function buildAlertLine(timeAt4cm, maxHours) {
  if (timeAt4cm === null) return [];
  const points = [];
  for (let t = timeAt4cm; t <= timeAt4cm + 6.1; t += 0.5) {
    if (t > maxHours + 1) break;
    const y = ACTIVE_PHASE_CM + ALERT_SLOPE * (t - timeAt4cm);
    if (y > 10.01) break;
    points.push({ x: +t.toFixed(2), y: +Math.min(10, y).toFixed(2) });
  }
  return points;
}

/**
 * Build action-line dataset for Chart.js.
 * Anchored exactly at (timeAt4cm + 4, 4 cm).
 */
export function buildActionLine(timeAt4cm, maxHours) {
  if (timeAt4cm === null) return [];
  const actionStart = timeAt4cm + ACTION_OFFSET_HRS;
  const points = [];
  for (let t = actionStart; t <= actionStart + 6.1; t += 0.5) {
    if (t > maxHours + 1) break;
    const y = ACTIVE_PHASE_CM + ALERT_SLOPE * (t - actionStart);
    if (y > 10.01) break;
    points.push({ x: +t.toFixed(2), y: +Math.min(10, y).toFixed(2) });
  }
  return points;
}

// ─── Data Validation Layer ───────────────────────────────────────────────────

/**
 * Validates the observation sequence for data integrity issues.
 * Returns array of warning strings (empty = clean data).
 */
export function validateObservationSequence(parsedObs) {
  const warnings = [];
  const dilObs = parsedObs.filter(o => o.cervical_dilation !== null);

  for (let i = 1; i < parsedObs.length; i++) {
    const prev = parsedObs[i - 1];
    const curr = parsedObs[i];
    const dt = curr.hourOffset - prev.hourOffset;

    // Time gap > 2 hours
    if (dt > MAX_TIME_GAP_HRS) {
      warnings.push(`Data gap: ${dt.toFixed(1)}h between observations at ${prev.hourOffset.toFixed(1)}h and ${curr.hourOffset.toFixed(1)}h`);
    }
  }

  // Non-monotonic dilation (regression without clinical justification)
  for (let i = 1; i < dilObs.length; i++) {
    const prev = dilObs[i - 1];
    const curr = dilObs[i];
    if (curr.cervical_dilation < prev.cervical_dilation - 0.5) {
      warnings.push(
        `Non-monotonic dilation: dropped from ${prev.cervical_dilation} cm to ${curr.cervical_dilation} cm at hour ${curr.hourOffset.toFixed(1)}`
      );
    }
  }

  // Invalid station jumps (> 2 levels)
  const stObs = parsedObs.filter(o => o.head_station !== null);
  for (let i = 1; i < stObs.length; i++) {
    const jump = Math.abs(stObs[i].head_station - stObs[i - 1].head_station);
    if (jump > MAX_STATION_JUMP) {
      warnings.push(
        `Implausible station jump: ${stObs[i-1].head_station >= 0 ? '+' : ''}${stObs[i-1].head_station} → ` +
        `${stObs[i].head_station >= 0 ? '+' : ''}${stObs[i].head_station} at hour ${stObs[i].hourOffset.toFixed(1)}`
      );
    }
  }

  return warnings;
}

// ─── Main Classification Engine ──────────────────────────────────────────────

/**
 * Computes the full WHO classification with separate graph vs. clinical status.
 *
 * @param {Array}        parsedObs   — sorted observations with hourOffset
 * @param {number|null}  timeAt4cm   — hour when dilation first reached 4 cm
 *
 * @returns {{
 *   status:         'NORMAL'|'BORDERLINE'|'ABNORMAL',  // overall (worst)
 *   graph_status:   'NORMAL'|'BORDERLINE'|'ABNORMAL',  // purely from dilation curve
 *   clinical_status:'NORMAL'|'BORDERLINE'|'ABNORMAL',  // from all other params
 *   clinical_flags: string[],
 *   graph_flags:    string[],
 *   dilation_rate:  string,            // e.g. "1.0 cm/hr"
 *   dilationRate:   number|null,
 *   insight:        string,
 *   recommendation: string,
 *   lineStatus:     'normal'|'alert'|'action',
 *   dataWarnings:   string[],
 * }}
 */
export function computeWHOClassification(parsedObs, timeAt4cm) {
  // ── Data Validation ────────────────────────────────────────────────────────
  const dataWarnings = validateObservationSequence(parsedObs);

  const activeObs = parsedObs.filter(
    o => o.cervical_dilation !== null && o.cervical_dilation >= ACTIVE_PHASE_CM
  );

  // ── 1. GRAPH STATUS — ONLY line crossings, never dilation rate ───────────
  // WHO rule: graph is NORMAL as long as the curve stays LEFT of the alert line.
  // Slow dilation rate alone does NOT make graph BORDERLINE.
  let graphLevel = 0; // 0=normal, 1=borderline (alert crossed), 2=abnormal (action crossed)
  let lineStatus = 'normal';
  const graphFlags = [];

  // Overall active-phase dilation rate (first → last active point)
  let dilationRate = null;
  if (activeObs.length >= 2) {
    const first = activeObs[0];
    const last  = activeObs[activeObs.length - 1];
    const dt = last.hourOffset - first.hourOffset;
    if (dt > 0) dilationRate = (last.cervical_dilation - first.cervical_dilation) / dt;
  }

  // Rolling rate: last 2 active points — most recent trend
  let rollingRate = null;
  if (activeObs.length >= 2) {
    const p1 = activeObs[activeObs.length - 2];
    const p2 = activeObs[activeObs.length - 1];
    const dt = p2.hourOffset - p1.hourOffset;
    if (dt > 0) rollingRate = (p2.cervical_dilation - p1.cervical_dilation) / dt;
  }

  // Check each active observation against alert/action lines
  if (timeAt4cm !== null) {
    let actionCrossed = false;
    let alertCrossed  = false;

    for (const obs of activeObs) {
      // Clamp to 10 before comparing — never compare beyond full dilation
      const dil     = Math.min(10, obs.cervical_dilation);
      const alertY  = alertLineDilationAt(obs.hourOffset, timeAt4cm); // already clamped
      const actionY = actionLineDilationAt(obs.hourOffset, timeAt4cm);

      // Action line: only fires after 4 h from active start
      if (actionY !== null && dil < actionY) {
        if (!actionCrossed) {
          graphFlags.push(
            `Action line crossed — dilation ${dil} cm vs expected ${actionY.toFixed(1)} cm at ${obs.hourOffset.toFixed(1)}h`
          );
          actionCrossed = true;
        }
        lineStatus = 'action';
        graphLevel = 2;
      }
      // Alert line: fires immediately from active start
      else if (alertY !== null && dil < alertY) {
        if (!alertCrossed) {
          graphFlags.push(
            `Alert line crossed — dilation ${dil} cm vs expected ${alertY.toFixed(1)} cm at ${obs.hourOffset.toFixed(1)}h`
          );
          alertCrossed = true;
        }
        if (lineStatus !== 'action') lineStatus = 'alert';
        if (graphLevel < 1) graphLevel = 1;
      }
    }
    // ── KEY FIX: slow rate does NOT touch graphLevel ──────────────────────
    // Slow rate is a clinical flag (see below). Never a graph classification.
  }

  const graphStatusMap = ['NORMAL', 'BORDERLINE', 'ABNORMAL'];
  const graph_status = graphStatusMap[graphLevel];

  // ── 2. CLINICAL STATUS (all non-graph parameters) ─────────────────────────
  let clinLevel = 0;
  const clinicalFlags = [];
  const bumpClin = (level) => { if (level > clinLevel) clinLevel = level; };

  // Slow dilation rate — clinical flag, NOT a graph classification
  if (activeObs.length >= 2 && dilationRate !== null && dilationRate < ALERT_SLOPE) {
    const rateStr = rollingRate !== null
      ? `overall ${dilationRate.toFixed(2)} cm/hr, recent ${rollingRate.toFixed(2)} cm/hr`
      : `${dilationRate.toFixed(2)} cm/hr`;
    clinicalFlags.push(`Slow dilation rate — ${rateStr} (WHO standard ≥ 1 cm/hr in active phase). Consider oxytocin augmentation.`);
    bumpClin(1);
  }

  // Rapid labour (> 2 cm/hr) — precipitous delivery risk
  if (dilationRate !== null && dilationRate > 2.0) {
    clinicalFlags.push(`Rapid labour — ${dilationRate.toFixed(2)} cm/hr (> 2 cm/hr). Risk: uterine rupture / fetal distress.`);
    bumpClin(1);
  }

  // FHR — threshold alerts (bradycardia / tachycardia)
  const fhrObs = parsedObs.filter(o => o.fetal_heart_rate != null);
  let fhrFlagged = false;
  for (const obs of fhrObs) {
    const fhr = obs.fetal_heart_rate;
    if (fhr < FHR_MIN || fhr > FHR_MAX) {
      const label = fhr < FHR_MIN ? 'Bradycardia' : 'Tachycardia';
      clinicalFlags.push(`Fetal ${label} — FHR ${fhr} bpm (normal 110–160 bpm). Immediate assessment required.`);
      bumpClin(2);
      fhrFlagged = true;
      break;
    }
  }

  // FHR rising trend: 3 consecutive readings each higher — early warning
  if (!fhrFlagged && fhrObs.length >= 3) {
    const r = fhrObs.slice(-3);
    if (r[0].fetal_heart_rate < r[1].fetal_heart_rate &&
        r[1].fetal_heart_rate < r[2].fetal_heart_rate) {
      clinicalFlags.push(
        `FHR rising trend — ${r[0].fetal_heart_rate} → ${r[1].fetal_heart_rate} → ${r[2].fetal_heart_rate} bpm ` +
        `(3 consecutive readings rising — early warning of potential distress)`
      );
      bumpClin(1);
    }
  }

  // Contraction adequacy — count consecutive inadequate readings
  if (activeObs.length > 0) {
    let consecutiveInadequate = 0;
    let maxConsecutive = 0;
    const inadequateReadings = [];

    for (const o of activeObs) {
      const isInadequate = (o.contraction_freq != null && o.contraction_freq < ADEQUATE_FREQ) ||
                           (o.contraction_duration != null && o.contraction_duration < ADEQUATE_DUR_SEC);
      if (isInadequate) {
        consecutiveInadequate++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveInadequate);
        inadequateReadings.push(o);
      } else {
        consecutiveInadequate = 0;
      }
    }

    if (maxConsecutive > 0) {
      const details = inadequateReadings.map(o =>
        `${o.contraction_freq ?? '?'}/10min × ${o.contraction_duration ?? '?'}s at ${o.hourOffset.toFixed(0)}h`
      ).slice(0, 3).join(', ');
      
      const prefix = maxConsecutive >= 2 ? `CONSECUTIVE (${maxConsecutive}) ` : "";
      clinicalFlags.push(
        `${prefix}Inadequate uterine activity: ${details}`
      );
      bumpClin(1);
    }
  }

  // Blood pressure — ONLY flag at ≥ 140/90 (WHO hypertension threshold)
  for (const obs of parsedObs) {
    const sys = obs.bp_systolic, dia = obs.bp_diastolic;
    if (sys == null || dia == null) continue;
    if (sys >= BP_SYS_HT || dia >= BP_DIA_HT) {
      clinicalFlags.push(`Hypertension — BP ${sys}/${dia} mmHg (WHO threshold ≥ 140/90)`);
      bumpClin(1);
      break;
    }
    // 130–139 / 80–89 = no flag (normal for laboring patients)
  }

  // Temperature
  for (const obs of parsedObs) {
    if (obs.temperature != null && obs.temperature >= TEMP_FEVER) {
      clinicalFlags.push(`Maternal fever — ${obs.temperature}°C (≥ 38°C — possible chorioamnionitis)`);
      bumpClin(1);
      break;
    }
  }

  // Pulse
  for (const obs of parsedObs) {
    if (obs.maternal_pulse != null && obs.maternal_pulse > PULSE_TACHY) {
      clinicalFlags.push(`Tachycardia — pulse ${obs.maternal_pulse} bpm (> 100)`);
      bumpClin(1);
      break;
    }
  }

  // No head descent in late active phase
  const lateObs = activeObs.filter(o => o.cervical_dilation >= 7);
  if (lateObs.length >= 2) {
    const firstSt = lateObs[0].head_station;
    const lastSt  = lateObs[lateObs.length - 1].head_station;
    if (firstSt != null && lastSt != null && lastSt <= firstSt) {
      clinicalFlags.push(
        `No fetal head descent at advanced dilation — station ${lastSt >= 0 ? '+' : ''}${lastSt} (unchanged from ${firstSt >= 0 ? '+' : ''}${firstSt})`
      );
      bumpClin(2);
    }
  }

  const clinical_status = graphStatusMap[clinLevel];

  // ── 3. OVERALL STATUS (worst of graph + clinical) ─────────────────────────
  const overallLevel = Math.max(graphLevel, clinLevel);
  const status = graphStatusMap[overallLevel];

  // ── 4. Dilation rate string ───────────────────────────────────────────────
  const dilation_rate = dilationRate !== null
    ? `${dilationRate.toFixed(1)} cm/hr`
    : activeObs.length === 0 ? 'Latent phase' : 'Insufficient data';

  // ── 5. Narrative insight + recommendation ────────────────────────────────
  const { insight, recommendation } = generateNarrative(
    status, graph_status, clinical_status,
    graphFlags, clinicalFlags, dilationRate, activeObs
  );

  return {
    status,
    graph_status,
    clinical_status,
    clinical_flags: clinicalFlags,
    graph_flags:    graphFlags,
    dilation_rate,
    dilationRate,
    rollingRate,
    insight,
    recommendation,
    lineStatus,
    dataWarnings,
  };
}

// ─── Delivery Prediction Engine ──────────────────────────────────────────────

/**
 * Simple linear regression — returns { slope, intercept }.
 * slope = cm/hr; intercept = cm at time=0.
 */
function linearRegression(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den;
  const intercept = meanY - slope * meanX;
  return { slope, intercept };
}

/**
 * computeDeliveryPrediction
 *
 * @param {Array}  parsedObs  — sorted observations with hourOffset (same format as computeWHOClassification)
 * @param {Object} whoResult  — result from computeWHOClassification (for safety override check)
 *
 * @returns {{
 *   available:                    boolean,
 *   unavailableReason:            string|null,
 *   expected_time_remaining_hours: number|null,
 *   estimated_delivery_window:    string|null,
 *   confidence:                   'HIGH'|'MEDIUM'|'LOW'|null,
 *   dilation_rate_cmhr:           number|null,
 *   current_dilation_cm:          number|null,
 *   progress_pct:                 number,      // 0–100, from 4 cm active start
 *   clinical_flags:               string[],
 *   explanation:                  string,
 * }}
 */
export function computeDeliveryPrediction(parsedObs, whoResult) {
  const NA = (reason) => ({
    available: false,
    unavailableReason: reason,
    expected_time_remaining_hours: null,
    estimated_delivery_window: null,
    confidence: null,
    dilation_rate_cmhr: null,
    current_dilation_cm: null,
    progress_pct: 0,
    clinical_flags: [],
    explanation: reason,
    urgentWarning: null,
  });

  // ── Collect urgent warnings (do NOT block prediction — still compute) ────────
  let urgentWarning = null;
  if (whoResult) {
    const hasFoetalDistress = whoResult.clinical_flags.some(f =>
      f.toLowerCase().includes('fetal distress')
    );
    if (whoResult.lineStatus === 'action' && hasFoetalDistress) {
      urgentWarning = 'Action line crossed + Fetal distress detected — urgent obstetric review required';
    } else if (whoResult.lineStatus === 'action') {
      urgentWarning = 'Action line crossed — senior obstetric review required';
    } else if (hasFoetalDistress) {
      urgentWarning = 'Fetal distress detected — immediate clinical evaluation required';
    }
  }

  // ── Active-phase data ──────────────────────────────────────────────────────
  const activeObs = parsedObs.filter(
    o => o.cervical_dilation !== null && o.cervical_dilation >= ACTIVE_PHASE_CM
  );

  if (activeObs.length === 0) {
    return NA('Prediction unavailable — patient not yet in active phase (< 4 cm)');
  }

  const currentDilation = activeObs[activeObs.length - 1].cervical_dilation;

  if (currentDilation >= 10) {
    return NA('Full dilation (10 cm) already reached');
  }

  // ── Dilation rate ──────────────────────────────────────────────────────────
  let dilationRate = null;
  const xs = activeObs.map(o => o.hourOffset);
  const ys = activeObs.map(o => o.cervical_dilation);

  if (activeObs.length >= 3) {
    // Prefer linear regression with ≥3 points
    const reg = linearRegression(xs, ys);
    if (reg) dilationRate = reg.slope;
  } else if (activeObs.length >= 2) {
    // Simple two-point fallback
    const dt = xs[xs.length - 1] - xs[0];
    if (dt > 0) dilationRate = (ys[ys.length - 1] - ys[0]) / dt;
  }

  if (dilationRate === null || dilationRate <= 0) {
    return NA('Prediction unavailable — insufficient or inconsistent data (no positive dilation trend)');
  }

  // ── Base time remaining ────────────────────────────────────────────────────
  const remainingDilation = 10 - currentDilation;
  let timeRemaining = remainingDilation / dilationRate;

  // ── Clinical adjustment layer ──────────────────────────────────────────────
  const flags = [];

  // 3.1 — Contraction adequacy (most recent observation)
  const lastObs = activeObs[activeObs.length - 1];
  const freq     = lastObs.contraction_freq;
  const duration = lastObs.contraction_duration;
  if ((freq != null && freq < ADEQUATE_FREQ) || (duration != null && duration < ADEQUATE_DUR_SEC)) {
    timeRemaining *= 1.3;
    flags.push('Inadequate uterine activity');
  }

  // 3.2 — Fetal descent: no improvement over last 3 station readings
  const stationObs = activeObs.filter(o => o.head_station !== null);
  if (stationObs.length >= 3) {
    const recent = stationObs.slice(-3);
    const firstSt = recent[0].head_station;
    const lastSt  = recent[recent.length - 1].head_station;
    // Station should increase (move positive = descent). No change or ascent = arrested.
    if (lastSt <= firstSt) {
      timeRemaining *= 1.5;
      flags.push('No fetal head descent');
    }
  }

  // 3.3 — Labor speed modifier
  if (dilationRate < 1) {
    timeRemaining *= 1.4;
    flags.push('Slow labor progress (< 1 cm/hr)');
  } else if (dilationRate > 1.5) {
    timeRemaining *= 0.85;
    flags.push('Rapid labor progress (> 1.5 cm/hr)');
  }

  // Sanity guard — cap at 24 hours
  if (!isFinite(timeRemaining) || timeRemaining > 24) {
    return NA('Prediction unavailable — insufficient or inconsistent data');
  }

  // ── Confidence ────────────────────────────────────────────────────────────
  // Check for consistent intervals (max gap ≤ 2 hours)
  let consistentIntervals = true;
  for (let i = 1; i < activeObs.length; i++) {
    if (activeObs[i].hourOffset - activeObs[i - 1].hourOffset > MAX_TIME_GAP_HRS) {
      consistentIntervals = false;
      break;
    }
  }

  let confidence;
  if (activeObs.length >= 4 && consistentIntervals) confidence = 'HIGH';
  else if (activeObs.length >= 3)                   confidence = 'MEDIUM';
  else                                              confidence = 'LOW';

  // ── Delivery window string ────────────────────────────────────────────────
  const lo = Math.max(0, timeRemaining - 0.5);
  const hi = timeRemaining + 0.5;
  const fmtHrs = (h) => {
    if (h < 1) return `${Math.round(h * 60)} min`;
    const whole = Math.floor(h);
    const mins  = Math.round((h - whole) * 60);
    return mins > 0 ? `${whole}h ${mins}min` : `${whole}h`;
  };
  const window = `${fmtHrs(lo)} – ${fmtHrs(hi)}`;

  // ── Progress % (4 cm → 10 cm) ─────────────────────────────────────────────
  const progress_pct = Math.min(100, Math.max(0,
    ((currentDilation - ACTIVE_PHASE_CM) / (10 - ACTIVE_PHASE_CM)) * 100
  ));

  // ── Explanation ───────────────────────────────────────────────────────────
  let explanation = `Based on dilation rate of ${dilationRate.toFixed(2)} cm/hr`;
  if (flags.length > 0) {
    explanation += ` with adjustments for: ${flags.join(', ')}`;
  } else {
    explanation += ' — no adverse clinical factors detected';
  }

  return {
    available: true,
    unavailableReason: null,
    expected_time_remaining_hours: +timeRemaining.toFixed(2),
    estimated_delivery_window:     window,
    confidence,
    dilation_rate_cmhr:            +dilationRate.toFixed(2),
    current_dilation_cm:           currentDilation,
    progress_pct:                  +progress_pct.toFixed(1),
    clinical_flags:                flags,
    explanation,
    urgentWarning,
  };
}

// ─── Narrative Generator ─────────────────────────────────────────────────────

function generateNarrative(status, graphStatus, clinStatus, graphFlags, clinFlags, dilationRate, activeObs) {
  if (activeObs.length === 0) {
    return {
      insight: 'Latent phase — awaiting active labor (dilation < 4 cm). No alert or action line applicable yet.',
      recommendation: 'Continue routine monitoring. Re-assess dilation at 2-hour intervals.',
    };
  }

  const rateStr = dilationRate != null ? `${dilationRate.toFixed(1)} cm/hr` : 'not yet calculable';

  // ── ABNORMAL ──
  if (status === 'ABNORMAL') {
    const criticalGraph    = graphFlags.filter(f => f.includes('Action line'));
    const criticalClinical = clinFlags.filter(f => f.includes('Fetal distress') || f.includes('descent'));
    const topFlag = criticalGraph[0] || criticalClinical[0] || clinFlags[0] || graphFlags[0] || 'critical clinical deviation';
    return {
      insight: `ABNORMAL: ${topFlag}. Overall dilation rate: ${rateStr}.`,
      recommendation: 'URGENT — Immediate senior obstetric review. Prepare for operative delivery if no rapid improvement.',
    };
  }

  // ── BORDERLINE ──
  if (status === 'BORDERLINE') {
    // Distinguish: is graph normal but clinical is borderline?
    if (graphStatus === 'NORMAL' && clinStatus === 'BORDERLINE') {
      const clinDetail = clinFlags.slice(0, 2).join('; ');
      return {
        insight: `Graph progress is normal (${rateStr}, left of alert line). Classification elevated to BORDERLINE due to clinical factors: ${clinDetail}.`,
        recommendation: 'Increase monitoring frequency. Address clinical flags. Reassess in 1 hour.',
      };
    }
    // Graph is borderline (touched alert line or rate just below 1 cm/hr)
    const graphDetail = graphFlags.slice(0, 1).join('; ');
    const clinDetail  = clinFlags.length > 0 ? ` Additionally: ${clinFlags.slice(0, 1).join('; ')}.` : '';
    return {
      insight: `BORDERLINE: ${graphDetail}.${clinDetail} Dilation at ${rateStr}.`,
      recommendation: 'Increase monitoring to every 30 minutes. Consider oxytocin augmentation. Senior review if no improvement within 1 hour.',
    };
  }

  // ── NORMAL ──
  if (clinFlags.length === 0 && graphFlags.length === 0) {
    return {
      insight: `Normal active labor — dilation progressing at ${rateStr}, within the WHO 1 cm/hr standard. All maternal and fetal parameters normal.`,
      recommendation: 'Continue routine monitoring every 1–2 hours.',
    };
  }
  // NORMAL overall but minor items noted
  const noted = [...graphFlags, ...clinFlags].slice(0, 2).join('; ');
  return {
    insight: `Normal active labor at ${rateStr}. Minor observations: ${noted}.`,
    recommendation: 'Continue routine monitoring. Document and review at next assessment.',
  };
}
