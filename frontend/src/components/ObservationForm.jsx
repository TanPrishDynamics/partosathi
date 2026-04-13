import React, { useState } from 'react';
import { 
  X, 
  Save, 
  Thermometer, 
  Droplet, 
  Activity, 
  Heart,
  ChevronRight
} from 'lucide-react';

const ObservationForm = ({ patientId, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    patient_id: patientId,
    timestamp: new Date().toISOString(),
    cervical_dilation: '',
    head_station: '',
    fetal_heart_rate: '',
    amniotic_fluid: 'clear',
    moulding: '0',
    contraction_freq: '',
    contraction_duration: '',
    maternal_pulse: '',
    bp_systolic: '',
    bp_diastolic: '',
    temperature: '',
    urine_protein: 'nil',
    urine_ketones: 'nil',
    urine_volume: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0A0F1E]/80 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="glass-card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col relative animate-in fade-in zoom-in duration-300">
        <div className="p-6 border-b border-white/10 flex items-center justify-between gradient-teal/10">
          <div>
            <h2 className="text-2xl font-bold font-serif">New Observation</h2>
            <p className="text-sm text-slate-400">Recording for Patient ID: {patientId}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-slate-400">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            
            {/* Labor Progress */}
            <div className="space-y-4">
              <h3 className="text-[#00C9A7] font-bold text-xs uppercase tracking-widest flex items-center space-x-2">
                <Activity className="w-4 h-4" />
                <span>Labor Progress</span>
              </h3>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Cervical Dilation (0-10 cm)</label>
                  <input 
                    type="number" step="0.5" name="cervical_dilation" value={formData.cervical_dilation} onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:border-[#00C9A7] outline-none transition-all"
                    placeholder="E.g. 4.5" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Fetal Head Station (-5 to +5)</label>
                  <input 
                    type="number" step="1" name="head_station" value={formData.head_station} onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:border-[#00C9A7] outline-none transition-all"
                    placeholder="E.g. -2" 
                  />
                </div>
              </div>
            </div>

            {/* Fetal Condition */}
            <div className="space-y-4">
              <h3 className="text-red-400 font-bold text-xs uppercase tracking-widest flex items-center space-x-2">
                <Heart className="w-4 h-4" />
                <span>Fetal Condition</span>
              </h3>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Heart Rate (bpm)</label>
                  <input 
                    type="number" name="fetal_heart_rate" value={formData.fetal_heart_rate} onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:border-[#00C9A7] outline-none transition-all"
                    placeholder="E.g. 140" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Amniotic Fluid</label>
                    <select 
                      name="amniotic_fluid" value={formData.amniotic_fluid} onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 focus:border-[#00C9A7] outline-none transition-all appearance-none"
                    >
                      <option value="clear">Clear (I)</option>
                      <option value="meconium">Meconium (M)</option>
                      <option value="absent">Absent (A)</option>
                      <option value="blood">Blood (B)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Moulding</label>
                    <select 
                      name="moulding" value={formData.moulding} onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 focus:border-[#00C9A7] outline-none transition-all appearance-none"
                    >
                      <option value="0">0</option>
                      <option value="+">+</option>
                      <option value="++">++</option>
                      <option value="+++">+++</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Contractions */}
            <div className="space-y-4">
              <h3 className="text-amber-400 font-bold text-xs uppercase tracking-widest flex items-center space-x-2">
                <Activity className="w-4 h-4" />
                <span>Contractions</span>
              </h3>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Frequency (per 10 min)</label>
                  <input 
                    type="number" name="contraction_freq" value={formData.contraction_freq} onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:border-[#00C9A7] outline-none transition-all"
                    placeholder="E.g. 3" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Duration (seconds)</label>
                  <input 
                    type="number" name="contraction_duration" value={formData.contraction_duration} onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:border-[#00C9A7] outline-none transition-all"
                    placeholder="E.g. 45" 
                  />
                </div>
              </div>
            </div>

            {/* Maternal Vitals */}
            <div className="space-y-4">
              <h3 className="text-blue-400 font-bold text-xs uppercase tracking-widest flex items-center space-x-2">
                <Activity className="w-4 h-4" />
                <span>Maternal Vitals</span>
              </h3>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Pulse (bpm)</label>
                    <input 
                      type="number" name="maternal_pulse" value={formData.maternal_pulse} onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:border-[#00C9A7] outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Temp (°C)</label>
                    <input 
                      type="number" step="0.1" name="temperature" value={formData.temperature} onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:border-[#00C9A7] outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">BP (Sys)</label>
                    <input 
                      type="number" name="bp_systolic" value={formData.bp_systolic} onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:border-[#00C9A7] outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">BP (Dia)</label>
                    <input 
                      type="number" name="bp_diastolic" value={formData.bp_diastolic} onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:border-[#00C9A7] outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Urine */}
            <div className="space-y-4">
              <h3 className="text-purple-400 font-bold text-xs uppercase tracking-widest flex items-center space-x-2">
                <Droplet className="w-4 h-4" />
                <span>Urine Analysis</span>
              </h3>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Protein</label>
                    <select 
                      name="urine_protein" value={formData.urine_protein} onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 focus:border-[#00C9A7] outline-none transition-all appearance-none"
                    >
                      <option value="nil">Nil</option>
                      <option value="+">+</option>
                      <option value="++">++</option>
                      <option value="+++">+++</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Ketones</label>
                    <select 
                      name="urine_ketones" value={formData.urine_ketones} onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 focus:border-[#00C9A7] outline-none transition-all appearance-none"
                    >
                      <option value="nil">Nil</option>
                      <option value="+">+</option>
                      <option value="++">++</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Volume (mL)</label>
                  <input 
                    type="number" name="urine_volume" value={formData.urine_volume} onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:border-[#00C9A7] outline-none transition-all"
                  />
                </div>
              </div>
            </div>

          </div>
        </form>

        <div className="p-6 border-t border-white/10 flex items-center justify-end space-x-4">
          <button 
            type="button" onClick={onClose}
            className="px-6 py-2.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            className="glass-button flex items-center space-x-2"
          >
            <Save className="w-4 h-4" />
            <span>Save Observation</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ObservationForm;
