import React, { useState } from 'react';
import { 
  X, 
  Save, 
  Droplet, 
  Activity, 
  Heart,
  Mic,
  Clock,
  FileText,
  Sparkles,
  Loader2
} from 'lucide-react';
import VoiceAssistant from '../../components/VoiceAssistant';

const ObservationForm = ({ patientId, patient, initialData, onSave, onClose }) => {
  // Auto-calculate time_hours from patient's admission_time on mount (new observations only)
  const calcTimeHours = () => {
    if (initialData?.time_hours !== undefined && initialData?.time_hours !== null && initialData?.time_hours !== '') {
      return initialData.time_hours;
    }
    const admissionTime = patient?.admission_time;
    const refTime = admissionTime ? new Date(admissionTime) : new Date();
    const now = new Date();
    const diffMs = now - refTime;
    const diffHours = Math.max(0, Math.round(diffMs / (1000 * 60 * 60) * 10) / 10);
    return diffHours;
  };

  const [formData, setFormData] = useState({
    patient_id: patientId,
    timestamp: initialData ? initialData.timestamp.slice(0, 16) : new Date().toISOString().slice(0, 16),
    time_hours: calcTimeHours(),
    cervical_dilation: initialData?.cervical_dilation ?? '',
    head_station: initialData?.head_station ?? '',
    fetal_heart_rate: initialData?.fetal_heart_rate ?? '',
    amniotic_fluid: initialData?.amniotic_fluid || 'clear',
    moulding: initialData?.moulding || '0',
    contraction_freq: initialData?.contraction_freq ?? '',
    contraction_duration: initialData?.contraction_duration ?? '',
    maternal_pulse: initialData?.maternal_pulse ?? '',
    bp_systolic: initialData?.bp_systolic ?? '',
    bp_diastolic: initialData?.bp_diastolic ?? '',
    temperature: initialData?.temperature ?? '',
    urine_protein: initialData?.urine_protein || 'nil',
    urine_ketones: initialData?.urine_ketones || 'nil',
    urine_volume: initialData?.urine_volume ?? ''
  });

  const [showVoice, setShowVoice] = useState(false);
  const [showRawText, setShowRawText] = useState(false);
  const [rawText, setRawText] = useState('');
  const [rawParsing, setRawParsing] = useState(false);
  const [rawResult, setRawResult] = useState(null); // { fields_extracted, confidence_score }
  const [rawError, setRawError] = useState('');
  const [showManualTime, setShowManualTime] = useState(false);
  const [manualTimeInput, setManualTimeInput] = useState('');


  const handleParseRawText = async () => {
    if (!rawText.trim()) return;
    setRawParsing(true);
    setRawResult(null);
    setRawError('');
    try {
      // H-2: Use centralized api instance (sends httpOnly cookie automatically)
      const { default: api } = await import('../../services/api');
      const res = await api.post('/api/cds/extract-text', { transcript: rawText });
      const data = res.data;
      if (data.success && Object.keys(data.extracted_data).length > 0) {
        const ed = data.extracted_data;
        const mapped = {};
        if (ed.cervical_dilation_cm !== undefined)        mapped.cervical_dilation = ed.cervical_dilation_cm;
        if (ed.fetal_head_station !== undefined)          mapped.head_station = ed.fetal_head_station;
        if (ed.contraction_frequency_per_10min !== undefined) mapped.contraction_freq = ed.contraction_frequency_per_10min;
        if (ed.contraction_duration_sec !== undefined)   mapped.contraction_duration = ed.contraction_duration_sec;
        if (ed.fetal_heart_rate !== undefined)           mapped.fetal_heart_rate = ed.fetal_heart_rate;
        if (ed.maternal_pulse !== undefined)             mapped.maternal_pulse = ed.maternal_pulse;
        setFormData(prev => ({ ...prev, ...mapped }));
        setRawResult({ fields_extracted: data.fields_extracted, confidence_score: data.confidence_score });
      } else {
        setRawError('No clinical data could be extracted. Try rephrasing — e.g. "dilation 6 cm, contractions 3 in 10 min".');
      }
    } catch (e) {
      setRawError('Failed to reach the AI extractor. Ensure the backend is running.');
    } finally {
      setRawParsing(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData, initialData?.id);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0A0F1E]/80 backdrop-blur-sm" onClick={onClose}></div>
      
      {showVoice && (
        <VoiceAssistant
          onDataExtracted={handleVoiceData}
          onClose={() => setShowVoice(false)}
        />
      )}

      <div className="glass-card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col relative animate-in fade-in zoom-in duration-300">
        <div className="p-6 border-b border-white/10 flex items-center justify-between gradient-teal/10">
          <div>
            <h2 className="text-2xl font-bold font-display">{initialData ? 'Edit Observation' : 'New Observation'}</h2>
            <p className="text-sm text-slate-400">{initialData ? `Updating Entry #${initialData.id}` : `Recording for Patient ID: ${patientId}`}</p>
          </div>
          <div className="flex items-center space-x-2">
            {/* Admission time info badge + manual override toggle */}
            <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#FF7F50]/10 border border-[#FF7F50]/30 rounded-xl">
              <Clock className="w-3.5 h-3.5 text-[#FF7F50]" />
              <span className="text-[#FF7F50] text-xs font-semibold">
                {formData.time_hours}h from admit
              </span>
              <button
                type="button"
                title="Manually set hours from admission"
                onClick={() => {
                  setManualTimeInput(String(formData.time_hours));
                  setShowManualTime(v => !v);
                }}
                className="ml-1 text-[#FF7F50]/60 hover:text-[#FF7F50] transition-colors cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
              </button>
            </div>
            {/* Raw Text Toggle */}
            <button
              onClick={() => { setShowRawText(v => !v); setRawResult(null); setRawError(''); }}
              type="button"
              title="Raw Text Input"
              className={`flex items-center space-x-2 px-4 py-2 border rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                showRawText
                  ? 'bg-purple-500/30 border-purple-500/50 text-purple-300'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Raw Text</span>
            </button>
            {/* Voice Toggle */}
            <button
              onClick={() => setShowVoice(true)}
              type="button"
              title="Voice Input"
              className="flex items-center space-x-2 px-4 py-2 bg-[#00C9A7]/20 border border-[#00C9A7]/40 text-[#00C9A7] rounded-xl text-sm font-semibold hover:bg-[#00C9A7]/30 transition-colors cursor-pointer"
            >
              <Mic className="w-4 h-4" />
              <span>Voice</span>
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-slate-400">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">

          {/* ── Manual Time Override Panel ───────────────────────── */}
          {showManualTime && (
            <div className="px-8 py-4 border-b border-white/10 bg-[#FF7F50]/5 flex items-center gap-4">
              <Clock className="w-4 h-4 text-[#FF7F50] shrink-0" />
              <span className="text-[#FF7F50] text-sm font-semibold whitespace-nowrap">Hours from Admission</span>
              <input
                type="number"
                min="0"
                max="72"
                step="0.5"
                value={manualTimeInput}
                onChange={e => setManualTimeInput(e.target.value)}
                placeholder="e.g. 4.5"
                className="w-32 bg-white/5 border border-[#FF7F50]/40 rounded-xl px-3 py-2 text-sm text-white focus:border-[#FF7F50] outline-none transition-colors"
              />
              <span className="text-slate-400 text-xs">hrs since admit</span>
              <button
                type="button"
                onClick={() => {
                  const val = parseFloat(manualTimeInput);
                  if (!isNaN(val) && val >= 0) {
                    setFormData(prev => ({ ...prev, time_hours: val }));
                  }
                  setShowManualTime(false);
                }}
                className="px-4 py-2 bg-[#FF7F50]/30 border border-[#FF7F50]/50 text-white rounded-xl text-sm font-semibold hover:bg-[#FF7F50]/50 transition-colors cursor-pointer"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={() => setShowManualTime(false)}
                className="text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          {/* ── Raw Text Panel ───────────────────────────────────── */}
          {showRawText && (
            <div className="px-8 pt-6 pb-2 border-b border-white/10 bg-purple-500/5">
              <div className="flex items-center space-x-2 mb-3">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-purple-300 font-semibold text-sm">Raw Text Entry</span>
                <span className="text-slate-500 text-xs ml-1">— Type naturally, AI fills the form</span>
              </div>
              <textarea
                value={rawText}
                onChange={e => { setRawText(e.target.value); setRawResult(null); setRawError(''); }}
                rows={3}
                placeholder={'e.g. "Time 4 hours, dilation 5.5 cm, contractions 3 in 10 minutes lasting 40 seconds, head station minus 2, FHR 142 bpm, maternal pulse 86"'}
                className="w-full bg-white/5 border border-purple-500/30 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-purple-400 outline-none resize-none transition-all"
              />
              <div className="flex items-center justify-between mt-3">
                <div className="text-xs">
                  {rawResult && (
                    <span className="text-green-400 font-semibold">
                      Filled {rawResult.fields_extracted} fields &nbsp;·&nbsp; Confidence: {Math.round(rawResult.confidence_score * 100)}%
                    </span>
                  )}
                  {rawError && <span className="text-red-400">{rawError}</span>}
                </div>
                <button
                  type="button"
                  onClick={handleParseRawText}
                  disabled={!rawText.trim() || rawParsing}
                  className="flex items-center space-x-2 px-5 py-2 bg-purple-500/30 border border-purple-500/50 text-purple-200 rounded-xl text-sm font-semibold hover:bg-purple-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {rawParsing
                    ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Parsing...</span></>
                    : <><Sparkles className="w-4 h-4" /><span>Parse &amp; Fill</span></>}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 italic mt-2">AI-assisted input — verify values before saving</p>
            </div>
          )}


          <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            
            {/* Labor Progress */}
            <div className="space-y-4">
              <h3 className="text-[#00C9A7] font-bold text-xs uppercase tracking-widest flex items-center space-x-2">
                <Activity className="w-4 h-4" />
                <span>Labor Progress</span>
              </h3>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Cervical Dilation (0-10 cm)</label>
                  <input 
                    type="number" step="0.5" name="cervical_dilation" value={formData.cervical_dilation} onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:border-[#00C9A7] outline-none transition-all"
                    placeholder="Example: 5.5" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Fetal Head Station (-5 to +5)</label>
                  <input 
                    type="number" step="1" name="head_station" value={formData.head_station} onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:border-[#00C9A7] outline-none transition-all"
                    placeholder="Example: -2" 
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
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Heart Rate (110-160 BPM)</label>
                  <input 
                    type="number" name="fetal_heart_rate" value={formData.fetal_heart_rate} onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:border-[#00C9A7] outline-none transition-all"
                    placeholder="Example: 142" 
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
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Frequency (0-5 per 10 min)</label>
                  <input 
                    type="number" name="contraction_freq" value={formData.contraction_freq} onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:border-[#00C9A7] outline-none transition-all"
                    placeholder="Example: 3" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Duration (10-60 Seconds)</label>
                  <input 
                    type="number" name="contraction_duration" value={formData.contraction_duration} onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:border-[#00C9A7] outline-none transition-all"
                    placeholder="Example: 35" 
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
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Pulse (60-120 BPM)</label>
                    <input 
                      type="number" name="maternal_pulse" value={formData.maternal_pulse} onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:border-[#00C9A7] outline-none transition-all"
                      placeholder="Ex: 82"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Temp (36-39 °C)</label>
                    <input 
                      type="number" step="0.1" name="temperature" value={formData.temperature} onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:border-[#00C9A7] outline-none transition-all"
                      placeholder="Ex: 37.1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">BP (90-140 Sys)</label>
                    <input 
                      type="number" name="bp_systolic" value={formData.bp_systolic} onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:border-[#00C9A7] outline-none transition-all"
                      placeholder="Ex: 120"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">BP (60-90 Dia)</label>
                    <input 
                      type="number" name="bp_diastolic" value={formData.bp_diastolic} onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:border-[#00C9A7] outline-none transition-all"
                      placeholder="Ex: 80"
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
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Volume (50-1000 mL)</label>
                  <input 
                    type="number" name="urine_volume" value={formData.urine_volume} onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:border-[#00C9A7] outline-none transition-all"
                    placeholder="Example: 250"
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
            <span>{initialData ? 'Update Entry' : 'Save Observation'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ObservationForm;
