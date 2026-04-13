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

const PartographChart = ({ patient, observations }) => {
  if (!patient || !observations) return null;
  
  const admissionTime = new Date(patient.admission_time);
  
  // Prepare data points for cervical dilation
  const dilationData = observations
    .filter(obs => obs.cervical_dilation !== null)
    .map(obs => ({
      x: differenceInHours(new Date(obs.timestamp), admissionTime),
      y: obs.cervical_dilation
    }))
    .sort((a, b) => a.x - b.x);

  // Prepare data points for head station
  const stationData = observations
    .filter(obs => obs.head_station !== null)
    .map(obs => ({
      x: differenceInHours(new Date(obs.timestamp), admissionTime),
      y: obs.head_station
    }))
    .sort((a, b) => a.x - b.x);

  // Find active phase start for Alert/Action lines
  const activeStart = observations
    .filter(o => o.cervical_dilation >= 4)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0];

  const activeStartHour = activeStart 
    ? differenceInHours(new Date(activeStart.timestamp), admissionTime)
    : 0;

  // Generate Alert and Action lines
  const maxHours = Math.max(12, ...dilationData.map(d => d.x + 4));
  const alertLine = [];
  const actionLine = [];

  for (let h = activeStartHour; h <= maxHours; h++) {
    const alertY = 4 + (h - activeStartHour);
    const actionY = 4 + Math.max(0, h - activeStartHour - 4);
    
    if (alertY <= 10) alertLine.push({ x: h, y: alertY });
    if (actionY <= 10) actionLine.push({ x: h, y: actionY });
  }

  const data = {
    datasets: [
      {
        label: 'Cervical Dilation (cm)',
        data: dilationData,
        borderColor: '#00C9A7',
        backgroundColor: 'rgba(0, 201, 167, 0.2)',
        pointBackgroundColor: '#00C9A7',
        pointRadius: 6,
        borderWidth: 3,
        tension: 0.1,
        fill: false,
        yAxisID: 'y',
      },
      {
        label: 'Head Station',
        data: stationData,
        borderColor: '#94A3B8',
        backgroundColor: 'transparent',
        pointStyle: 'triangle',
        pointRadius: 6,
        borderDash: [5, 5],
        borderWidth: 2,
        tension: 0,
        fill: false,
        yAxisID: 'y1',
      },
      {
        label: 'Alert Line',
        data: alertLine,
        borderColor: 'rgba(234, 179, 8, 0.5)',
        borderWidth: 2,
        pointRadius: 0,
        borderDash: [10, 5],
        fill: false,
      },
      {
        label: 'Action Line',
        data: actionLine,
        borderColor: 'rgba(239, 68, 68, 0.5)',
        borderWidth: 2,
        pointRadius: 0,
        borderDash: [10, 5],
        fill: false,
      }
    ],
  };

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
          font: { family: 'Poppins' }
        },
        min: 0,
        max: maxHours,
        ticks: { color: '#94A3B8', stepSize: 1 },
        grid: { color: 'rgba(255, 255, 255, 0.05)' }
      },
      y: {
        type: 'linear',
        title: {
          display: true,
          text: 'Cervical Dilation (cm)',
          color: '#00C9A7',
          font: { family: 'Poppins', weight: 'bold' }
        },
        min: 0,
        max: 10,
        ticks: { color: '#00C9A7', stepSize: 1 },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      },
      y1: {
        type: 'linear',
        position: 'right',
        title: {
          display: true,
          text: 'Head Station',
          color: '#94A3B8',
          font: { family: 'Poppins' }
        },
        min: -5,
        max: 5,
        reverse: true, // +5 is up, -5 is down in head descent terminology? 
        // Actually station is -5 (high) to +5 (at outlet). 
        // Conventionally on partograph, descending head is plotted downward.
        ticks: { color: '#94A3B8', stepSize: 1 },
        grid: { display: false }
      }
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#E2E8F0',
          usePointStyle: true,
          padding: 20,
          font: { family: 'Inter', size: 10 }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(10, 15, 30, 0.9)',
        titleColor: '#00C9A7',
        bodyColor: '#fff',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 12,
        displayColors: true
      }
    }
  };

  return (
    <div className="glass-card p-6 h-[500px] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold font-serif">WHO Partogram</h3>
        <div className="flex items-center space-x-4 text-xs">
          <span className="flex items-center space-x-1">
            <span className="w-3 h-3 rounded-full bg-[#00C9A7]"></span>
            <span>Progress</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-3 h-[2px] border-b-2 border-dashed border-yellow-500"></span>
            <span>Alert</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-3 h-[2px] border-b-2 border-dashed border-red-500"></span>
            <span>Action</span>
          </span>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Line data={data} options={options} />
      </div>
    </div>
  );
};

export default PartographChart;
