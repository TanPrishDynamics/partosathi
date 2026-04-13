import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Plus, 
  Search, 
  ChevronRight, 
  User, 
  AlertCircle,
  Activity,
  Clock,
  Filter,
  Loader2
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { formatDistanceToNow } from 'date-fns';

const PatientList = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const resp = await axios.get('/api/patients', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setPatients(resp.data);
      } catch (err) {
        console.error(err);
        if (err.response?.status === 401) navigate('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchPatients();
  }, [navigate]);

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.patient_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-[#0A0F1E]">
      <Sidebar />
      
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
            <div>
              <h1 className="text-3xl font-bold font-serif mb-2">Patients</h1>
              <p className="text-slate-400">Monitoring {patients.length} active labor cases</p>
            </div>
            
            <button 
              onClick={() => navigate('/new-patient')}
              className="glass-button flex items-center justify-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span className="font-bold">Register New Patient</span>
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input 
                type="text"
                placeholder="Search by Name or Patient ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 focus:border-[#00C9A7] outline-none transition-all"
              />
            </div>
            <button className="px-6 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-slate-400 hover:text-white flex items-center space-x-2 transition-all cursor-pointer">
              <Filter className="w-4 h-4" />
              <span className="font-medium">Filter</span>
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-[#00C9A7] animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPatients.map(p => (
                <div 
                  key={p.id}
                  onClick={() => navigate(`/dashboard/${p.patient_id}`)}
                  className="glass-card p-6 cursor-pointer group hover:border-[#00C9A7]/40 transition-all duration-300 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 gradient-teal opacity-5 blur-2xl -mr-16 -mt-16 group-hover:opacity-10 transition-opacity"></div>
                  
                  <div className="flex items-start justify-between mb-6 relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-[#00C9A7]/20 group-hover:bg-[#00C9A7]/5 transition-all">
                      <User className="w-6 h-6 text-slate-400 group-hover:text-[#00C9A7]" />
                    </div>
                    {(p.alert_counts?.red > 0 || p.alert_counts?.yellow > 0) && (
                      <div className="flex space-x-1">
                        {p.alert_counts.red > 0 && (
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></div>
                        )}
                        {p.alert_counts.yellow > 0 && (
                          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-lg font-serif group-hover:text-[#00C9A7] transition-colors">{p.name}</h3>
                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-[#00C9A7] group-hover:translate-x-1 transition-all" />
                    </div>
                    <p className="text-xs text-[#00C9A7] font-bold tracking-widest mb-4 opacity-70 uppercase">{p.patient_id}</p>
                    
                    <div className="space-y-3 pt-4 border-t border-white/5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 flex items-center space-x-1.5">
                          <Activity className="w-3.5 h-3.5" />
                          <span>Observations</span>
                        </span>
                        <span className="font-bold text-slate-300">{p.observation_count} total</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Admission</span>
                        </span>
                        <span className="text-slate-400">{formatDistanceToNow(new Date(p.admission_time), { addSuffix: true })}</span>
                      </div>
                    </div>

                    <div className="mt-6 flex items-center space-x-4">
                      {p.alert_counts.red > 0 && (
                        <div className="flex items-center space-x-1 text-red-500 text-[10px] font-bold uppercase tracking-tighter">
                          <AlertCircle className="w-3 h-3" />
                          <span>{p.alert_counts.red} Critical</span>
                        </div>
                      )}
                      <div className="text-[10px] font-bold uppercase text-slate-600 ml-auto">
                        G{p.gravida} P{p.parity} • {p.gestational_age}w
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filteredPatients.length === 0 && (
                <div className="col-span-full py-20 text-center glass-card border-dashed">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-slate-600" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No patients found</h3>
                  <p className="text-slate-500">Try searching for a different name or ID</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default PatientList;
