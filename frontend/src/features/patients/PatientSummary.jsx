import React from 'react';
import { User, Clock, FileDown, Heart, Baby, Activity } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const STAT = ({ label, value, sub, color = '#22D3EE' }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">{label}</span>
    <span className="text-sm font-bold text-slate-100">{value}</span>
    {sub && <span className="text-[10px] text-slate-600">{sub}</span>}
  </div>
);

const PatientSummary = ({ patient, onExportPDF }) => {
  if (!patient) return null;

  const admitTime  = new Date(patient.admission_time);
  const hoursInLabor = ((Date.now() - admitTime.getTime()) / 3600000).toFixed(1);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/[0.06] mb-8 animate-fade-in"
      style={{
        background: 'linear-gradient(135deg, rgba(17,24,39,0.95) 0%, rgba(11,18,32,0.98) 100%)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 48px rgba(0,0,0,0.4)',
      }}
    >
      {/* Accent glow */}
      <div className="absolute top-0 right-0 w-80 h-80 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.05) 0%, transparent 60%)' }}
      />
      {/* Top accent bar */}
      <div className="h-0.5 w-full"
        style={{ background: 'linear-gradient(90deg, #22D3EE 0%, #14B8A6 50%, transparent 100%)' }}
      />

      <div className="p-6 relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          
          {/* Left — Patient identity */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)' }}
            >
              <User className="w-7 h-7 text-cyan-400" />
            </div>

            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Poppins, system-ui, sans-serif' }}>
                  {patient.name}
                </h2>
                <span className="badge badge-active">Active Labor</span>
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-1">
                <span className="text-xs text-slate-500">
                  <span className="text-cyan-400 font-bold">ID</span>
                  &nbsp;{patient.patient_id}
                </span>
                <span className="text-xs text-slate-500">Age {patient.age}y</span>
                <span className="text-xs text-slate-500">
                  G{patient.gravida} P{patient.parity}
                </span>
                {patient.gestational_age && (
                  <span className="text-xs text-slate-500">{patient.gestational_age}w gestation</span>
                )}
              </div>
            </div>
          </div>

          {/* Right — Stats + Action */}
          <div className="flex flex-wrap items-center gap-3">

            {/* KPI chips */}
            <div className="flex items-center gap-px bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden divide-x divide-white/[0.05]">
              {[
                { icon: Clock, label: 'Admitted', value: format(admitTime, 'HH:mm, d MMM') },
                { icon: Activity, label: 'In labor', value: `${hoursInLabor}h` },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-2.5 px-4 py-3">
                  <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                    <Icon className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-600 uppercase tracking-widest font-bold leading-none mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-slate-200">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Export button */}
            <button
              onClick={onExportPDF}
              className="btn-ghost text-xs"
            >
              <FileDown className="w-4 h-4 text-cyan-400" />
              Export PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientSummary;
