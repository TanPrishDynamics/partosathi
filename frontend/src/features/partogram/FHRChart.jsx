import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { differenceInHours } from 'date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const FHRChart = ({ patient, observations }) => {
  if (!patient || !observations) return null;
  
  const admissionTime = React.useMemo(() => new Date(patient.admission_time), [patient.admission_time]);
  
  const fhrData = React.useMemo(() =>
    observations
      .filter(obs => obs.fetal_heart_rate !== null)
      .map(obs => ({
        x: differenceInHours(new Date(obs.timestamp), admissionTime),
        y: obs.fetal_heart_rate
      }))
      .sort((a, b) => a.x - b.x),
  [observations, patient.admission_time]);

  const data = React.useMemo(() => ({
    datasets: [
      {
        label: 'Fetal Heart Rate (bpm)',
        data: fhrData,
        borderColor: '#F87171',
        backgroundColor: 'rgba(248, 113, 113, 0.1)',
        pointBackgroundColor: '#EF4444',
        pointRadius: 4,
        borderWidth: 2,
        tension: 0.3,
        fill: true,
      }
    ],
  }), [fhrData]);

  const options = React.useMemo(() => ({
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'linear',
        min: 0,
        max: fhrData.length > 0 ? fhrData.reduce((m, d) => Math.max(m, d.x + 2), 12) : 12,
        ticks: { color: '#94A3B8' },
        grid: { color: 'rgba(255, 255, 255, 0.05)' }
      },
      y: {
        min: 60,
        max: 200,
        ticks: { color: '#94A3B8' },
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        suggestedMin: 110,
        suggestedMax: 160
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(10, 15, 30, 0.9)',
        titleColor: '#F87171',
      }
    }
  }), [fhrData]);

  return (
    <div className="glass-card p-5 h-[220px] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Fetal Heart Rate (bpm)</h3>
        <span className="text-xs text-red-400 px-2 py-0.5 bg-red-400/10 rounded-full border border-red-400/20">
          Normal: 110-160
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <Line data={data} options={options} />
      </div>
    </div>
  );
};

export default FHRChart;
