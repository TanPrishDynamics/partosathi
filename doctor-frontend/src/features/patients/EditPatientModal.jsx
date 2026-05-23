import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { 
  X, 
  Save, 
  Calendar, 
  User, 
  Loader2,
  ChevronRight
} from 'lucide-react';

const EditPatientModal = ({ patient, onSave, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gravida: '',
    parity: '',
    gestational_age: '',
    admission_time: '',
    membrane_rupture_time: ''
  });

  useEffect(() => {
    if (patient) {
      setFormData({
        name: patient.name || '',
        age: patient.age || '',
        gravida: patient.gravida || '',
        parity: patient.parity || '',
        gestational_age: patient.gestational_age || '',
        admission_time: patient.admission_time ? patient.admission_time.slice(0, 16) : '',
        membrane_rupture_time: patient.membrane_rupture_time ? patient.membrane_rupture_time.slice(0, 16) : ''
      });
    }
  }, [patient]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      
      const resp = await api.patch(`/api/patient/${patient.patient_id}`, formData);
      onSave(resp.data);
    } catch (err) {
      console.error(err);
      alert('Error updating patient details');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose}></div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col relative animate-in fade-in zoom-in duration-300">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold font-display text-slate-800">Edit Patient Details</h2>
            <p className="text-sm text-slate-500">Updating record for {patient.patient_id}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer text-slate-500">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Full Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-600" />
                <input
                  type="text" name="name" value={formData.name} onChange={handleChange} required
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl pl-12 pr-4 py-3 focus:border-indigo-400 outline-none transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Age (Years)</label>
              <input 
                type="number" name="age" value={formData.age} onChange={handleChange} required
                className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl px-4 py-3 focus:border-indigo-400 outline-none transition-all font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Gestational Age (Weeks)</label>
              <input 
                type="number" name="gestational_age" value={formData.gestational_age} onChange={handleChange} required
                className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl px-4 py-3 focus:border-indigo-400 outline-none transition-all font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Gravida</label>
              <input 
                type="number" name="gravida" value={formData.gravida} onChange={handleChange} required
                className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl px-4 py-3 focus:border-indigo-400 outline-none transition-all font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Parity</label>
              <input 
                type="number" name="parity" value={formData.parity} onChange={handleChange} required
                className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl px-4 py-3 focus:border-indigo-400 outline-none transition-all font-medium"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Admission Timestamp</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-600" />
                <input 
                  type="datetime-local" name="admission_time" value={formData.admission_time} onChange={handleChange} required
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl pl-12 pr-4 py-3 focus:border-indigo-400 outline-none transition-all font-medium"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Membrane Rupture Time (Optional)</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-600" />
                <input 
                  type="datetime-local" name="membrane_rupture_time" value={formData.membrane_rupture_time} onChange={handleChange}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl pl-12 pr-4 py-3 focus:border-indigo-400 outline-none transition-all font-medium"
                />
              </div>
            </div>
          </div>
        </form>

        <div className="p-6 border-t border-slate-200 flex items-center justify-end space-x-4">
          <button
            type="button" onClick={onClose}
            className="px-6 py-2.5 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={loading}
            className="glass-button flex items-center space-x-2 px-8"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Update Patient</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPatientModal;
