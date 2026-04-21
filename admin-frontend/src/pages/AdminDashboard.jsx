import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Edit3, 
  LogOut, 
  ShieldCheck, 
  Building2, 
  Mail,
  Loader2,
  X,
  Plus
} from 'lucide-react';

const AdminDashboard = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('doctors'); // 'doctors' or 'hospitals'
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    license_number: '',
    hospital: '',
    password: ''
  });

  const fetchDoctors = async () => {
    try {
      const resp = await axios.get('/api/admin/doctors', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setDoctors(resp.data);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) handleLogout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  const handleOpenModal = (doctor = null) => {
    if (doctor) {
      setEditingDoctor(doctor);
      setFormData({
        name: doctor.name,
        email: doctor.email,
        license_number: doctor.license_number || '',
        hospital: doctor.hospital || '',
        password: '' // Don't show password
      });
    } else {
      setEditingDoctor(null);
      setFormData({
        name: '',
        email: '',
        license_number: '',
        hospital: selectedHospital || '',
        password: ''
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const auth = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
      if (editingDoctor) {
        await axios.patch(`/api/admin/doctors/${editingDoctor.id}`, formData, auth);
      } else {
        await axios.post('/api/admin/doctors', formData, auth);
      }
      setShowModal(false);
      fetchDoctors();
    } catch (err) {
      alert(err.response?.data?.error || 'Operation failed');
    }
  };

  const getHospitalStats = () => {
    const stats = {};
    doctors.forEach(d => {
      const h = d.hospital || 'Unassigned';
      if (!stats[h]) stats[h] = { name: h, count: 0 };
      stats[h].count++;
    });
    return Object.values(stats);
  };

  const filteredDoctors = selectedHospital 
    ? doctors.filter(d => (d.hospital || 'Unassigned') === selectedHospital)
    : doctors;

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this doctor account? This cannot be undone.')) return;
    try {
      await axios.delete(`/api/admin/doctors/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetchDoctors();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex h-screen bg-[#050A18]">
      {/* Admin Sidebar */}
      <aside className="w-64 glass-card rounded-none border-y-0 border-l-0 sticky top-0 flex flex-col p-6 z-50">
        <div className="flex items-center space-x-3 mb-10 px-2 leading-none">
          <div className="w-10 h-10 gradient-gold rounded-xl flex items-center justify-center shadow-lg shadow-gold/20">
            <ShieldCheck className="text-[#050A18] w-6 h-6" />
          </div>
          <div>
            <span className="text-xl font-black font-serif block text-[#D4AF37]">ADMIN</span>
            <span className="text-[10px] font-bold text-slate-500 tracking-[0.2em]">CONTROL</span>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <button 
            onClick={() => { setActiveTab('doctors'); setSelectedHospital(null); }}
            className={`nav-item w-full text-left ${activeTab === 'doctors' && !selectedHospital ? 'active text-[#D4AF37]' : 'text-slate-400'}`}
          >
            <Users className="w-5 h-5" />
            <span className="font-medium">All Doctors</span>
          </button>
          
          <button 
            onClick={() => { setActiveTab('hospitals'); setSelectedHospital(null); }}
            className={`nav-item w-full text-left ${activeTab === 'hospitals' || selectedHospital ? 'active text-[#D4AF37]' : 'text-slate-400'}`}
          >
            <Building2 className="w-5 h-5" />
            <span className="font-medium">Hospitals</span>
          </button>
        </nav>

        <button 
          onClick={handleLogout}
          className="nav-item w-full text-left text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors mt-auto"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout Admin</span>
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h1 className="text-3xl font-black font-serif mb-2">
                {selectedHospital ? selectedHospital : (activeTab === 'doctors' ? 'Doctor Management' : 'Hospital Overview')}
              </h1>
              <p className="text-slate-500">
                {selectedHospital ? `Viewing all doctors at ${selectedHospital}` : (activeTab === 'doctors' ? 'Configure and monitor access for clinical users.' : 'Aggregate view of affiliated medical facilities.')}
              </p>
            </div>

            <div className="flex items-center space-x-4">
              {selectedHospital && (
                <button 
                  onClick={() => setSelectedHospital(null)}
                  className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-white transition-colors"
                >
                  Back to Hospitals
                </button>
              )}
              <button 
                onClick={() => handleOpenModal()}
                className="glass-button flex items-center space-x-2"
              >
                {activeTab === 'hospitals' && !selectedHospital ? (
                  <>
                    <Building2 className="w-5 h-5" />
                    <span>Register New Hospital</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    <span>Register New Doctor</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
              </div>
            ) : activeTab === 'hospitals' && !selectedHospital ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-8">
                {getHospitalStats().map(h => (
                  <button 
                    key={h.name}
                    onClick={() => setSelectedHospital(h.name)}
                    className="glass-card p-6 border border-white/5 hover:border-[#D4AF37]/30 transition-all text-left group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 gradient-gold opacity-5 blur-2xl -mr-10 -mt-10 group-hover:opacity-10 transition-opacity"></div>
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-[#D4AF37]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-lg truncate group-hover:text-[#D4AF37] transition-colors">{h.name}</h4>
                        <p className="text-xs text-slate-500 uppercase font-black tracking-widest">{h.count} Registered Doctors</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400 font-bold group-hover:text-white transition-colors pt-4 border-t border-white/5">
                      <span>View Team</span>
                      <Plus className="w-4 h-4" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/5">
                      <th className="py-4 px-6 text-xs text-slate-500 font-black uppercase tracking-widest">Doctor Profile</th>
                      <th className="py-4 px-6 text-xs text-slate-500 font-black uppercase tracking-widest">Clinical Data</th>
                      <th className="py-4 px-6 text-xs text-slate-500 font-black uppercase tracking-widest">Facility</th>
                      <th className="py-4 px-6 text-xs text-slate-500 font-black uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredDoctors.map(doctor => (
                      <tr key={doctor.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="py-5 px-6">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-[#D4AF37]/30 transition-colors">
                              <ShieldCheck className="w-6 h-6 text-slate-500 group-hover:text-[#D4AF37]" />
                            </div>
                            <div>
                              <p className="font-bold text-white text-lg">{doctor.name}</p>
                              <p className="text-xs text-slate-500 flex items-center mt-1">
                                <Mail className="w-3 h-3 mr-1" />
                                {doctor.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-5 px-6">
                          <p className="text-xs text-slate-500 uppercase font-black tracking-widest mb-1">License No.</p>
                          <p className="font-mono text-[#D4AF37]">{doctor.license_number || 'PENDING'}</p>
                        </td>
                        <td className="py-5 px-6">
                          <p className="text-sm text-slate-300 flex items-center">
                            <Building2 className="w-3.5 h-3.5 mr-2 text-slate-500" />
                            {doctor.hospital}
                          </p>
                        </td>
                        <td className="py-5 px-6 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button 
                              onClick={() => handleOpenModal(doctor)}
                              className="p-2.5 rounded-xl bg-white/5 text-slate-400 hover:text-[#D4AF37] hover:bg-white/10 transition-all shadow-sm"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(doctor.id)}
                              className="p-2.5 rounded-xl bg-white/5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all shadow-sm"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Doctor Form Modal */}
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
            <div className="glass-card w-full max-w-xl relative z-10 animate-in fade-in zoom-in duration-300">
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-xl font-black font-serif">
                  {editingDoctor ? 'Update Doctor Account' : 'Register New Doctor Access'}
                </h3>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-white/5">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="bg-[#D4AF37]/5 border border-[#D4AF37]/10 p-4 rounded-xl mb-2">
                   <p className="text-xs text-[#D4AF37] font-bold uppercase tracking-widest mb-1">Notice</p>
                   <p className="text-sm text-slate-400 leading-relaxed">
                     {activeTab === 'hospitals' && !editingDoctor 
                       ? "Registering a new hospital requires assigning its first authorized medical professional." 
                       : "Ensure all clinical credentials are valid before authorizing access."}
                   </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Full Name</label>
                    <input 
                      required
                      type="text"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:border-[#D4AF37] transition-all"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">License Number</label>
                    <input 
                      required
                      type="text"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:border-[#D4AF37] transition-all"
                      value={formData.license_number}
                      onChange={(e) => setFormData({...formData, license_number: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Email Address</label>
                  <input 
                    required
                    type="email"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:border-[#D4AF37] transition-all"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Affiliated Hospital</label>
                  <input 
                    required
                    type="text"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:border-[#D4AF37] transition-all"
                    value={formData.hospital}
                    onChange={(e) => setFormData({...formData, hospital: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                    {editingDoctor ? 'New Access Key (Optional)' : 'Initial Access Key'}
                  </label>
                  <input 
                    type="password"
                    placeholder={editingDoctor ? 'Leave blank to keep current' : 'Define initial password'}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:border-[#D4AF37] transition-all"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    required={!editingDoctor}
                  />
                </div>

                <div className="pt-4 flex items-center justify-end space-x-4">
                  <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 font-bold text-slate-400">Cancel</button>
                  <button type="submit" className="glass-button">
                    {editingDoctor ? 'Update Records' : 'Authorize Doctor'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
