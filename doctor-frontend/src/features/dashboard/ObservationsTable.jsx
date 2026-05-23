import { format } from 'date-fns';
import { Edit2, Trash2 } from 'lucide-react';

const FHR_OK   = fhr => fhr != null && fhr >= 110 && fhr <= 160;
const BP_HT    = (s, d) => s >= 140 || d >= 90;
const CONTR_OK = (f, d) => f >= 3 && d >= 40;

const Tag = ({ ok, children }) => (
  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
    ok === true  ? 'bg-green-500/10 text-green-400' :
    ok === false ? 'bg-red-500/10  text-red-400'   :
                   'bg-white/5     text-slate-500'
  }`}>
    {children}
  </span>
);

const ObservationsTable = ({ observations, onEdit, onDelete }) => {
  const sorted = observations.slice().sort((a, b) =>
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  return (
    <div className="glass-card overflow-hidden animate-fade-in stagger-3">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-200" style={{ fontFamily: 'Poppins, system-ui, sans-serif' }}>
          Observation Log
        </h3>
        <span className="text-[10px] text-slate-600 uppercase tracking-wider font-bold">
          {observations.length} entries · newest first
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Dilation</th>
              <th>Station</th>
              <th>FHR</th>
              <th>Contractions</th>
              <th>BP</th>
              <th>Pulse</th>
              <th>Temp</th>
              <th>Fluid</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((o, idx) => {
              const fhrOk  = o.fetal_heart_rate != null ? FHR_OK(o.fetal_heart_rate) : null;
              const bpFlag = (o.bp_systolic != null && o.bp_diastolic != null) ? BP_HT(o.bp_systolic, o.bp_diastolic) : null;
              const contrOk = (o.contraction_freq != null && o.contraction_duration != null)
                ? CONTR_OK(o.contraction_freq, o.contraction_duration) : null;
              const isActive = o.cervical_dilation >= 4;

              return (
                <tr key={o.id || idx} className="animate-slide-up" style={{ animationDelay: `${idx * 0.04}s` }}>
                  <td className="font-mono font-semibold text-slate-300 text-xs">
                    {format(new Date(o.timestamp), 'HH:mm')}
                    <br />
                    <span className="text-[9px] text-slate-600 font-sans">{format(new Date(o.timestamp), 'd MMM')}</span>
                  </td>

                  <td>
                    {o.cervical_dilation != null ? (
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-cyan-400' : 'bg-slate-600'}`} />
                        <span className={`font-bold ${isActive ? 'text-cyan-400' : 'text-slate-500'}`}>
                          {o.cervical_dilation} cm
                        </span>
                      </div>
                    ) : <span className="text-slate-700">—</span>}
                  </td>

                  <td>
                    {o.head_station != null ? (
                      <span className="font-mono font-semibold text-slate-300 text-xs">
                        {o.head_station >= 0 ? '+' : ''}{o.head_station}
                      </span>
                    ) : <span className="text-slate-700">—</span>}
                  </td>

                  <td>
                    {o.fetal_heart_rate != null ? (
                      <Tag ok={fhrOk}>{o.fetal_heart_rate} bpm</Tag>
                    ) : <span className="text-slate-700">—</span>}
                  </td>

                  <td>
                    {o.contraction_freq != null ? (
                      <Tag ok={contrOk}>{o.contraction_freq}/10m · {o.contraction_duration}s</Tag>
                    ) : <span className="text-slate-700">—</span>}
                  </td>

                  <td>
                    {o.bp_systolic != null ? (
                      <Tag ok={bpFlag === false ? false : true}>
                        {o.bp_systolic}/{o.bp_diastolic}
                      </Tag>
                    ) : <span className="text-slate-700">—</span>}
                  </td>

                  <td>
                    {o.maternal_pulse != null ? (
                      <Tag ok={o.maternal_pulse <= 100}>{o.maternal_pulse}</Tag>
                    ) : <span className="text-slate-700">—</span>}
                  </td>

                  <td>
                    {o.temperature != null ? (
                      <Tag ok={o.temperature < 38}>{o.temperature}°C</Tag>
                    ) : <span className="text-slate-700">—</span>}
                  </td>

                  <td>
                    {o.amniotic_fluid ? (
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        o.amniotic_fluid === 'clear'    ? 'bg-green-500/10 text-green-400' :
                        o.amniotic_fluid === 'meconium' ? 'bg-yellow-500/10 text-yellow-400' :
                        o.amniotic_fluid === 'blood'    ? 'bg-red-500/10 text-red-400' :
                        'bg-white/5 text-slate-500'
                      }`}>
                        {o.amniotic_fluid}
                      </span>
                    ) : <span className="text-slate-700">—</span>}
                  </td>

                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onEdit(o)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-cyan-400 hover:bg-cyan-400/8 transition-all"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDelete(o.id)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/8 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {observations.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-slate-600 text-sm">No observations recorded yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ObservationsTable;
