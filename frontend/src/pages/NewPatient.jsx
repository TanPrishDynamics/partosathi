import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  ArrowLeft, 
  UserPlus, 
  Save, 
  Calendar, 
  User, 
  Activity,
  ChevronRight,
  Info
} from 'lucide-react';
import Sidebar from '../components/Sidebar';

const NewPatient = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gravida: 1,
    parity: 0,
    gestational_age: '',
    admission_time: new Date().toISOString().slice(0, 16)
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const authHeader = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
      const resp = await axios.post('/api/patient', formData, authHeader);
      navigate(`/dashboard/${resp.data.patient_id}`);
    } catch (err) {
      console.error(err);
      alert('Error registering patient');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#0A0F1E]">
      <Sidebar />
      
      <main className="flex-1 overflow-y-auto p-8 relative">
        <div className="max-w-3xl mx-auto">
          
          <button 
            onClick={() => navigate('/patients')}
            className="flex items-center space-x-2 text-slate-400 hover:text-white mb-8 transition-colors group cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Patients</span>
          </button>

          <div className="mb-10">
            <h1 className="text-3xl font-bold font-serif mb-2">New Admission</h1>
            <p className="text-slate-400">Enter patient details to initialize the digital partograph</p>
          </div>

          <div className="glass-card p-10 bg-white/5 border-white/10 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 gradient-teal opacity-5 blur-3xl -mr-32 -mt-32"></div>

             <form onSubmit={handleSubmit} className="relative z-10 space-y-8">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00C9A7]" />
                      <input 
                        type="text" name="name" value={formData.name} onChange={handleChange} required
                        className="w-full bg-black/20 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 focus:border-[#00C9A7] outline-none transition-all font-medium"
                        placeholder="E.g. Jane Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Age (Years)</label>
                    <input 
                      type="number" name="age" value={formData.age} onChange={handleChange} required
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3.5 focus:border-[#00C9A7] outline-none transition-all font-medium"
                      placeholder="28"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Gestational Age (Weeks)</label>
                    <input 
                      type="number" name="gestational_age" value={formData.gestational_age} onChange={handleChange} required
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3.5 focus:border-[#00C9A7] outline-none transition-all font-medium"
                      placeholder="39"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Gravida</label>
                    <input 
                      type="number" name="gravida" value={formData.gravida} onChange={handleChange} required
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3.5 focus:border-[#00C9A7] outline-none transition-all font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Parity</label>
                    <input 
                      type="number" name="parity" value={formData.parity} onChange={handleChange} required
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3.5 focus:border-[#00C9A7] outline-none transition-all font-medium"
                    />
                  </div>

                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Admission Timestamp</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00C9A7]" />
                      <input 
                        type="datetime-local" name="admission_time" value={formData.admission_time} onChange={handleChange} required
                        className="w-full bg-black/20 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 focus:border-[#00C9A7] outline-none transition-all font-medium"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-teal-500/5 border border-teal-500/10 rounded-2xl flex items-start space-x-3">
                   <Info className="w-5 h-5 text-[#00C9A7] mt-0.5" />
                   <p className="text-xs text-slate-400 leading-relaxed">
                     Initializing a new patient profile will set the baseline for labor monitoring. 
                     The partograph will automatically start tracking progress from the first observation recorded ≥ 4cm dilation.
                   </p>
                </div>

                <div className="pt-6 flex justify-end">
                   <button 
                    type="submit" 
                    disabled={loading}
                    className="glass-button w-full sm:w-auto px-10 py-4 flex items-center justify-center space-x-2"
                   >
                     <UserPlus className="w-5 h-5" />
                     <span className="text-lg">Register & Start Partograph</span>
                     {loading ? <Loader2 className="w-5 h-5 animate-spin ml-2" /> : <ChevronRight className="w-5 h-5" />}
                   </button>
                </div>

             </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default NewPatient;
