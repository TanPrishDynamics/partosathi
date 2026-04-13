import React from 'react';
import { 
  User, 
  Calendar, 
  Clock, 
  Activity,
  FileDown
} from 'lucide-react';
import { format } from 'date-fns';

const PatientSummary = ({ patient, onExportPDF }) => {
  if (!patient) return null;

  return (
    <div className="glass-card p-6 mb-8 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-64 h-64 gradient-teal opacity-5 blur-3xl -mr-32 -mt-32"></div>
      
      <div className="flex flex-col lg:flex-row lg:items-center justify-between relative z-10 gap-6">
        <div className="flex items-center space-x-5">
          <div className="w-16 h-16 rounded-2xl bg-[#00C9A7]/10 flex items-center justify-center border border-[#00C9A7]/20">
            <User className="w-8 h-8 text-[#00C9A7]" />
          </div>
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <h2 className="text-2xl font-bold font-serif">{patient.name}</h2>
              <span className="bg-[#00C9A7] text-[#0A0F1E] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">
                Active Labor
              </span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400">
              <span className="flex items-center space-x-1.5 font-medium">
                <span className="text-[#00C9A7] font-bold">ID:</span>
                <span>{patient.patient_id}</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest leading-none">Age</span>
                <span>{patient.age}y</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest leading-none">Gravida</span>
                <span>G{patient.gravida} P{patient.parity}</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest leading-none">Gest. Age</span>
                <span>{patient.gestational_age} weeks</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/5 flex items-center space-x-3">
             <div className="p-2 bg-blue-500/10 rounded-lg">
               <Clock className="w-4 h-4 text-blue-400" />
             </div>
             <div>
               <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider leading-none mb-1">Admission Time</p>
               <p className="text-sm font-semibold">{format(new Date(patient.admission_time), 'HH:mm — dd MMM yyyy')}</p>
             </div>
          </div>

          <button 
            onClick={onExportPDF}
            className="flex items-center space-x-2 bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-2.5 rounded-xl transition-all font-semibold text-sm cursor-pointer"
          >
            <FileDown className="w-4 h-4 text-[#00C9A7]" />
            <span>Export Report</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PatientSummary;
