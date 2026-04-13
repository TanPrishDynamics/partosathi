import React from 'react';
import { format } from 'date-fns';

const ObservationsTable = ({ observations }) => {
  return (
    <div className="glass-card overflow-hidden">
      <div className="p-6 border-b border-white/10">
        <h3 className="text-lg font-semibold">Observation History</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/5 text-[10px] uppercase tracking-widest text-[#00C9A7] font-bold">
              <th className="px-6 py-4">Time</th>
              <th className="px-6 py-4">Dil (cm)</th>
              <th className="px-6 py-4">Station</th>
              <th className="px-6 py-4">FHR</th>
              <th className="px-6 py-4">Contrax</th>
              <th className="px-6 py-4">BP</th>
              <th className="px-6 py-4">Pulse</th>
              <th className="px-6 py-4">Temp</th>
              <th className="px-6 py-4">Fluid</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {observations.slice().reverse().map((o, idx) => (
              <tr key={o.id || idx} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 font-medium">{format(new Date(o.timestamp), 'HH:mm')}</td>
                <td className="px-6 py-4">{o.cervical_dilation ?? '—'}</td>
                <td className="px-6 py-4">{o.head_station ?? '—'}</td>
                <td className="px-6 py-4">
                  <span className={o.fetal_heart_rate < 110 || o.fetal_heart_rate > 160 ? 'text-red-400 font-bold' : ''}>
                    {o.fetal_heart_rate ?? '—'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {o.contraction_freq ? `${o.contraction_freq}/10m (${o.contraction_duration}s)` : '—'}
                </td>
                <td className="px-6 py-4">{o.bp_systolic ? `${o.bp_systolic}/${o.bp_diastolic}` : '—'}</td>
                <td className="px-6 py-4">{o.maternal_pulse ?? '—'}</td>
                <td className="px-6 py-4">{o.temperature ? `${o.temperature}°C` : '—'}</td>
                <td className="px-6 py-4">
                   <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                     o.amniotic_fluid === 'clear' ? 'bg-green-500/10 text-green-400' :
                     o.amniotic_fluid === 'meconium' ? 'bg-yellow-500/10 text-yellow-500' :
                     o.amniotic_fluid === 'blood' ? 'bg-red-500/10 text-red-500' : 'bg-slate-500/10'
                   }`}>
                    {o.amniotic_fluid || '—'}
                   </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ObservationsTable;
