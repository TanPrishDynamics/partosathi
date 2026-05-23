import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { differenceInHours } from 'date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const ContractionChart = ({ patient, observations }) => {
  if (!patient || !observations) return null;
  
  const admissionTime = React.useMemo(() => new Date(patient.admission_time), [patient.admission_time]);
  
  const contraxData = React.useMemo(() =>
    observations
      .filter(obs => obs.contraction_freq !== null)
      .map(obs => ({
        x: differenceInHours(new Date(obs.timestamp), admissionTime),
        y: obs.contraction_freq,
        duration: obs.contraction_duration
      }))
      .sort((a, b) => a.x - b.x),
  [observations, patient.admission_time]);

  const data = React.useMemo(() => ({
    labels: contraxData.map(d => d.x),
    datasets: [
      {
        label: 'Frequency (per 10 min)',
        data: contraxData.map(d => d.y),
        backgroundColor: contraxData.map(d => {
          if (d.duration < 20) return 'rgba(0, 201, 167, 0.3)'; // Mild
          if (d.duration < 40) return 'rgba(0, 201, 167, 0.6)'; // Moderate
          return 'rgba(0, 201, 167, 0.9)'; // Strong
        }),
        borderRadius: 4,
      }
    ],
  }), [contraxData]);

  const options = React.useMemo(() => ({
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        title: { display: true, text: 'Hours from Admission', color: '#94A3B8' },
        ticks: { color: '#94A3B8' },
        grid: { color: 'rgba(255, 255, 255, 0.05)' }
      },
      y: {
        min: 0,
        max: 5,
        ticks: { color: '#94A3B8', stepSize: 1 },
        grid: { color: 'rgba(255, 255, 255, 0.05)' }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          afterBody: (context) => {
            const dataIndex = context[0].dataIndex;
            return `Duration: ${contraxData[dataIndex].duration}s`;
          }
        }
      }
    }
  }), [contraxData]);

  return (
    <div className="glass-card p-5 h-[220px] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Contractions (/10 min)</h3>
        <div className="flex items-center space-x-2 text-[10px]">
          <span className="flex items-center space-x-1 opacity-60"><span className="w-2 h-2 rounded bg-[#00C9A7]/30"></span><span>Mild</span></span>
          <span className="flex items-center space-x-1 opacity-80"><span className="w-2 h-2 rounded bg-[#00C9A7]/60"></span><span>Mod</span></span>
          <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded bg-[#00C9A7]"></span><span>Strong</span></span>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Bar data={data} options={options} />
      </div>
    </div>
  );
};

export default ContractionChart;
