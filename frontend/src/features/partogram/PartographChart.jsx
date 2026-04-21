import React, { useMemo, useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
  ScatterController,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { differenceInMinutes } from 'date-fns';
import { AlertCircle, Clock, ShieldCheck, ShieldAlert, Zap, Activity } from 'lucide-react';
import api from '../../services/api';
import {
  buildAlertLine,
  buildActionLine,
  computeWHOClassification,
  alertLineDilationAt,
  actionLineDilationAt,
  validateObservationSequence,
} from '../../utils/colpai';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  Filler,
  ScatterController
);

// ─── Classification colour palette ───────────────────────────────────────────
const CLASS_STYLES = {
  NORMAL: {
    bg: 'bg-emerald-500/15 border-emerald-500/40',
    text: 'text-emerald-400',
    icon: ShieldCheck,
    dot: 'bg-emerald-400',
  },
  BORDERLINE: {
    bg: 'bg-amber-500/15 border-amber-500/40',
    text: 'text-amber-400',
    icon: ShieldAlert,
    dot: 'bg-amber-400',
  },
  ABNORMAL: {
    bg: 'bg-red-500/15 border-red-500/40 animate-pulse',
    text: 'text-red-400',
    icon: AlertCircle,
    dot: 'bg-red-400',
  },
};

const LINE_STATUS_LABEL = {
  normal:  { text: 'Left of Alert Line',    color: 'text-emerald-400' },
  alert:   { text: 'Crossed Alert Line',    color: 'text-amber-400'   },
  action:  { text: 'Crossed Action Line',   color: 'text-red-400'     },
};

// ─── Component ───────────────────────────────────────────────────────────────
const PartographChart = ({ patient, observations }) => {
  const [aiData, setAiData] = useState(null);

  useEffect(() => {
    if (patient?.patient_id && observations?.length > 0) {
      // H-2: Use api instance (sends httpOnly cookie automatically)
      api.get(`/api/cds/predict-delivery/${patient.patient_id}`)
        .then(r => { if (r.data.success) setAiData(r.data); })
        .catch(() => {});
    }
  }, [patient?.patient_id, observations]);

  // ── Compute derived data ────────────────────────────────────────────────
  const {
    parsedObs,
    timeAt4cm,
    maxHours,
    latentData,
    activeData,
    stationData,
    alertLine,
    actionLine,
    whoResult,
  } = useMemo(() => {
    if (!patient || !observations || observations.length === 0) return {};

    const admissionTime = new Date(patient.admission_time);

    const parsedObs = observations
      .map(obs => ({
        ...obs,
        // Use precise minute-level offset for accuracy
        hourOffset: differenceInMinutes(new Date(obs.timestamp), admissionTime) / 60,
      }))
      .sort((a, b) => a.hourOffset - b.hourOffset);

    // Find when dilation first reached 4 cm (active phase start)
    const firstActive = parsedObs.find(
      o => o.cervical_dilation !== null && o.cervical_dilation >= 4
    );
    const timeAt4cm = firstActive ? firstActive.hourOffset : null;

    const maxHours = Math.max(
      12,
      (parsedObs[parsedObs.length - 1]?.hourOffset ?? 0) + 2,
      timeAt4cm !== null ? timeAt4cm + 8 : 12
    );

    // Split dilation into latent (< 4 cm) and active (≥ 4 cm)
    // For smooth connection we carry the last latent point into active
    const dilObs = parsedObs.filter(o => o.cervical_dilation !== null);
    const latentPoints = dilObs.filter(o => o.cervical_dilation < 4);
    const activePoints = dilObs.filter(o => o.cervical_dilation >= 4);

    // Carry last latent point into active start for visual continuity
    const lastLatent = latentPoints[latentPoints.length - 1];
    const latentData = latentPoints.map(o => ({ x: o.hourOffset, y: o.cervical_dilation }));
    const activeDataRaw = activePoints.map(o => ({ x: o.hourOffset, y: o.cervical_dilation }));
    const activeData =
      lastLatent && activeDataRaw.length > 0
        ? [{ x: lastLatent.hourOffset, y: lastLatent.cervical_dilation }, ...activeDataRaw]
        : activeDataRaw;

    // Head station — WHO inverts: negative = head high = top of chart
    const stationData = parsedObs
      .filter(o => o.head_station !== null)
      .map(o => ({ x: o.hourOffset, y: o.head_station }));

    const alertLine  = buildAlertLine(timeAt4cm, maxHours);
    const actionLine = buildActionLine(timeAt4cm, maxHours);

    const whoResult = computeWHOClassification(parsedObs, timeAt4cm);

    return { parsedObs, timeAt4cm, maxHours, latentData, activeData, stationData, alertLine, actionLine, whoResult };
  }, [patient, observations]);

  // Must guard AFTER useMemo (hooks must not be conditional)
  if (!patient || !observations || observations.length === 0 || !parsedObs) return null;

  // ── Build Chart.js datasets ────────────────────────────────────────────
  const datasets = [
    // Latent phase — dashed grey
    ...(latentData.length > 0 ? [{
      label: 'Latent Phase',
      data: latentData,
      borderColor: 'rgba(148, 163, 184, 0.6)',
      backgroundColor: 'rgba(148, 163, 184, 0.6)',
      pointStyle: 'circle',
      pointRadius: 5,
      pointHoverRadius: 7,
      borderWidth: 2,
      borderDash: [6, 4],
      tension: 0,
      yAxisID: 'y',
    }] : []),
    // Active phase -- solid teal x markers
    {
      label: 'Cervical Dilation',
      data: activeData,
      borderColor: '#00C9A7',
      backgroundColor: '#00C9A7',
      pointStyle: 'crossRot',
      pointRadius: 8,
      pointHoverRadius: 11,
      borderWidth: 2.5,
      tension: 0,
      yAxisID: 'y',
    },
    // Alert line — yellow dashed — THICK for visibility
    {
      label: 'Alert Line (1 cm/hr)',
      data: alertLine,
      borderColor: 'rgba(250, 204, 21, 1)',
      borderWidth: 3,
      pointRadius: 0,
      borderDash: [12, 5],
      tension: 0,
      yAxisID: 'y',
      order: 0, // draw on top
    },
    // Action line — red dashed
    {
      label: 'Action Line (+4 hrs)',
      data: actionLine,
      borderColor: 'rgba(239, 68, 68, 1)',
      borderWidth: 2.5,
      pointRadius: 0,
      borderDash: [8, 4],
      tension: 0,
      yAxisID: 'y',
    },
    // Head station — circle markers, right axis
    {
      label: 'Head Station',
      data: stationData,
      borderColor: '#94A3B8',
      backgroundColor: '#94A3B8',
      pointStyle: 'circle',
      pointRadius: 6,
      pointHoverRadius: 9,
      borderWidth: 2,
      tension: 0,
      yAxisID: 'y1',
    },
  ];


  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      x: {
        type: 'linear',
        title: {
          display: true,
          text: 'Time from Admission (Hours)',
          color: '#94A3B8',
          font: { size: 11, weight: '600' },
        },
        min: 0,
        max: maxHours + 1,
        ticks: { color: '#94A3B8', stepSize: 1 },
        grid: { color: 'rgba(255,255,255,0.05)' },
      },
      y: {
        type: 'linear',
        title: {
          display: true,
          text: 'Cervical Dilation (cm)',
          color: '#00C9A7',
          font: { size: 11, weight: '700' },
        },
        min: 0,
        max: 10,
        ticks: { color: '#00C9A7', stepSize: 1 },
        grid: { color: 'rgba(255,255,255,0.08)' },
      },
      y1: {
        type: 'linear',
        position: 'right',
        title: {
          display: true,
          text: 'Head Station',
          color: '#94A3B8',
          font: { size: 11, weight: '600' },
        },
        // WHO convention: negative values (head high) at top → reverse axis
        reverse: true,
        min: -5,
        max: 5,
        ticks: {
          color: '#94A3B8',
          stepSize: 1,
          callback: v => v >= 0 ? `+${v}` : `${v}`,
        },
        grid: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(10, 15, 30, 0.97)',
        titleColor: '#E2E8F0',
        bodyColor: '#CBD5E1',
        borderColor: 'rgba(0, 201, 167, 0.3)',
        borderWidth: 1,
        padding: 14,
        callbacks: {
          title: () => '',
          label: () => '',
          afterBody: (tooltipItems) => {
            const item = tooltipItems[0];
            if (!item) return [];
            const hourOffset = item.parsed.x;
            const matchObs = parsedObs.reduce((best, o) =>
              Math.abs(o.hourOffset - hourOffset) < Math.abs(best.hourOffset - hourOffset) ? o : best
            , parsedObs[0]);
            if (!matchObs || Math.abs(matchObs.hourOffset - hourOffset) > 0.6) return [];

            const lines = [
              `Time: ${hourOffset.toFixed(1)}h from admission`,
              matchObs.cervical_dilation != null ? `Dilation: ${matchObs.cervical_dilation} cm` : null,
              matchObs.head_station      != null ? `Station: ${matchObs.head_station >= 0 ? '+' : ''}${matchObs.head_station}` : null,
              matchObs.fetal_heart_rate  != null ? `FHR: ${matchObs.fetal_heart_rate} bpm ${matchObs.fetal_heart_rate < 110 || matchObs.fetal_heart_rate > 160 ? '[!]' : '[OK]'}` : null,
              (matchObs.contraction_freq != null || matchObs.contraction_duration != null)
                ? `Contractions: ${matchObs.contraction_freq ?? '?'}/10 min, ${matchObs.contraction_duration ?? '?'}s ${(matchObs.contraction_freq < 3 || matchObs.contraction_duration < 40) ? '[!]' : '[OK]'}` : null,
              (matchObs.bp_systolic != null && matchObs.bp_diastolic != null)
                ? `BP: ${matchObs.bp_systolic}/${matchObs.bp_diastolic} mmHg ${(matchObs.bp_systolic >= 140 || matchObs.bp_diastolic >= 90) ? '[!]' : '[OK]'}` : null,
              matchObs.maternal_pulse != null ? `Pulse: ${matchObs.maternal_pulse} bpm ${matchObs.maternal_pulse > 100 ? '[!]' : '[OK]'}` : null,
              matchObs.temperature   != null ? `Temp: ${matchObs.temperature}°C ${matchObs.temperature >= 38 ? '[!]' : '[OK]'}` : null,
            ].filter(Boolean);

            // WHO line status at this point
            if (timeAt4cm !== null && matchObs.cervical_dilation >= 4) {
              const alertY  = alertLineDilationAt(hourOffset, timeAt4cm);
              const actionY = actionLineDilationAt(hourOffset, timeAt4cm);
              if (actionY !== null && matchObs.cervical_dilation < actionY)      lines.push('ACTION LINE CROSSED');
              else if (alertY !== null && matchObs.cervical_dilation < alertY)   lines.push('Alert line crossed');
              else if (alertY !== null)                                           lines.push('Left of alert line (normal progress)');
            }

            return lines;
          },
        },
      },
    },
  };

  const chartData = { datasets };
  const classStyle = whoResult ? CLASS_STYLES[whoResult.status] : CLASS_STYLES.NORMAL;
  const ClassIcon = classStyle.icon;
  const graphStyle = whoResult ? CLASS_STYLES[whoResult.graph_status] : CLASS_STYLES.NORMAL;
  const GraphIcon = graphStyle.icon;
  const lineInfo = whoResult ? LINE_STATUS_LABEL[whoResult.lineStatus] : null;

  return (
    <div className="glass-card p-6 flex flex-col space-y-4 relative overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold font-display text-white">WHO Partogram</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            WHO (2020) Labour Care Guide — strict alert/action line geometry
          </p>
          {timeAt4cm !== null && (
            <p className="text-[11px] text-slate-500 mt-1">
              Active phase start: <span className="text-[#00C9A7] font-semibold">{timeAt4cm.toFixed(1)}h</span> from admission &nbsp;·&nbsp;
              Alert line: <span className="text-yellow-400 font-semibold">{timeAt4cm.toFixed(1)}h → {(timeAt4cm + 6).toFixed(1)}h</span> &nbsp;·&nbsp;
              Action line: <span className="text-red-400 font-semibold">{(timeAt4cm + 4).toFixed(1)}h → {(timeAt4cm + 10).toFixed(1)}h</span>
            </p>
          )}
        </div>

        {/* Dual status badges: Graph vs Clinical */}
        <div className="flex flex-col items-end gap-2 max-w-xl">
          {whoResult && (
            <div className="flex flex-wrap justify-end gap-2">
              {/* Graph status */}
              <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${graphStyle.bg} ${graphStyle.text}`}>
                <GraphIcon className="w-3.5 h-3.5" />
                <span>Graph: {whoResult.graph_status}</span>
              </div>
              {/* Overall ColpAI status */}
              <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${classStyle.bg} ${classStyle.text}`}>
                <ClassIcon className="w-3.5 h-3.5" />
                <span>ColpAI: {whoResult.status}</span>
                {lineInfo && <span className={`font-normal ${lineInfo.color} ml-0.5`}>· {lineInfo.text}</span>}
              </div>
            </div>
          )}
          {/* AI Delivery Estimate */}
          {aiData?.estimated_time_to_full_dilation_hours > 0 && (
            <div className="flex items-center space-x-2 bg-blue-500/20 text-blue-300 px-3 py-1.5 rounded-lg border border-blue-500/30 text-xs font-semibold">
              <Clock className="w-3.5 h-3.5" />
              <span>Est. time to full dilation: {aiData.estimated_time_to_full_dilation_hours}h</span>
            </div>
          )}
        </div>
      </div>

      {/* ── ColpAI Insight Panel ─────────────────────────────────────────── */}
      {whoResult && (
        <div className={`rounded-xl border px-4 py-3 ${classStyle.bg}`}>
          <div className="flex items-start space-x-3">
            <ClassIcon className={`w-4 h-4 mt-0.5 shrink-0 ${classStyle.text}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${classStyle.text} mb-1`}>Clinical Insight</p>
              <p className="text-xs text-slate-300 leading-relaxed">{whoResult.insight}</p>
              {/* Recommendation */}
              <p className="text-xs text-slate-400 mt-1.5 italic">
                <span className="not-italic font-semibold text-slate-300">Recommendation: </span>
                {whoResult.recommendation}
              </p>
              {/* Clinical flags */}
              {whoResult.clinical_flags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider self-center">Clinical:</span>
                  {whoResult.clinical_flags.map((flag, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300">
                      {flag}
                    </span>
                  ))}
                </div>
              )}
              {/* Graph flags */}
              {whoResult.graph_flags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider self-center">Graph:</span>
                  {whoResult.graph_flags.map((flag, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-300">
                      {flag}
                    </span>
                  ))}
                </div>
              )}
              {/* Data integrity warnings */}
              {whoResult.dataWarnings?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider self-center">Data:</span>
                  {whoResult.dataWarnings.map((w, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300">
                      {w}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {whoResult.dilationRate !== null && (
              <div className="shrink-0 text-right">
                <div className="text-lg font-bold text-white">{whoResult.dilation_rate}</div>
                <div className="text-[10px] text-slate-400">dilation rate</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Chart ────────────────────────────────────────────────────────── */}
      <div className="relative" style={{ height: 380 }}>
        {/* Active-phase zone overlay label */}
        {timeAt4cm !== null && (
          <div className="absolute top-2 left-2 z-10 bg-[#0A0F1E]/80 border border-white/10 rounded-lg px-2 py-1">
            <div className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-slate-400/50 inline-block" />
              <span className="text-[10px] text-slate-500">Latent</span>
              <span className="text-slate-600 mx-1">|</span>
              <span className="w-2 h-2 rounded-full bg-[#00C9A7] inline-block" />
              <span className="text-[10px] text-[#00C9A7]">Active (≥ 4 cm)</span>
            </div>
          </div>
        )}
        <Line data={chartData} options={options} />
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-300 pt-3 border-t border-slate-700/50">
        <div className="flex items-center space-x-1.5">
          <span className="text-[#00C9A7] font-bold text-base leading-none">×</span>
          <span>Active Dilation</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="text-slate-400 font-bold text-base leading-none">●</span>
          <span className="text-slate-500">Latent Phase</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <svg width="28" height="8"><line x1="0" y1="4" x2="28" y2="4" stroke="#FACC15" strokeWidth="3" strokeDasharray="9,4"/></svg>
          <span>Alert Line — 1 cm/hr from 4 cm</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#EF4444" strokeWidth="2" strokeDasharray="6,3"/></svg>
          <span>Action Line (+4 hrs)</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="text-slate-400 font-bold text-base leading-none">○</span>
          <span>Head Station (inverted)</span>
        </div>
      </div>

      {/* ── Medical Safety Disclaimer ─────────────────────────────────────── */}
      <div className="border-t border-slate-700/30 pt-3 flex items-start space-x-2">
        <span className="text-[9px] text-slate-600 mt-0.5">+</span>
        <p className="text-[10px] text-slate-600 italic leading-relaxed">
          <span className="font-semibold not-italic text-slate-500">Medical Disclaimer:</span>{' '}
          This tool provides clinical decision support only. All data is displayed as entered.
          Final clinical decisions must be made by a qualified obstetrician or midwife.
          This system does not replace professional clinical judgement.
        </p>
      </div>
      {aiData?.explanations?.length > 0 && (
        <div className="border-t border-slate-700/30 pt-3">
          <div className="flex items-center space-x-2 mb-2">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">LSTM Model Observations</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {aiData.explanations.map((exp, idx) => (
              <span key={idx} className="text-[10px] px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg text-slate-300">
                {exp}
              </span>
            ))}
          </div>
          <p className="text-[9px] text-slate-600 italic mt-1.5">AI model output — requires clinical validation</p>
        </div>
      )}
    </div>
  );
};

export default PartographChart;
