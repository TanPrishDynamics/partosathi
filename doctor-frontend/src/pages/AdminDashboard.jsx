import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Users, UserPlus, Trash2, Edit3, LogOut, ShieldCheck, Building2,
  Mail, Loader2, X, Clock, CheckCircle, XCircle, Bell, Activity,
  AlertTriangle, ChevronDown, ChevronUp, RefreshCw, Eye
} from 'lucide-react';

// ── helpers ────────────────────────────────────────────────────────────────
const api = (method, url, data) =>
  axios({ method, url, data, withCredentials: true });

const StatusBadge = ({ status }) => {
  const map = {
    approved:         'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    pending:          'bg-amber-500/10  text-amber-400  border-amber-500/20',
    pending_approval: 'bg-amber-500/10  text-amber-400  border-amber-500/20',
    rejected:         'bg-red-500/10    text-red-400    border-red-500/20',
    inactive:         'bg-slate-500/10  text-slate-400  border-slate-500/20',
  };
  const label = status === 'pending_approval' ? 'pending' : status;
  return (
    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${map[status] || map.inactive}`}>
      {label}
    </span>
  );
};

// ── Approve/Reject modal ───────────────────────────────────────────────────
const ActionModal = ({ item, type, action, onClose, onDone }) => {
  const [limit, setLimit] = useState(type === 'doctor' ? 50 : 200);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setLoading(true);
    setErr('');
    try {
      if (action === 'approve') {
        await api('post', '/api/admin/approve-user', {
          user_type: type, user_id: item.id, patient_limit: limit,
        });
      } else {
        await api('post', '/api/admin/reject-user', {
          user_type: type, user_id: item.id, reason,
        });
      }
      onDone();
      onClose();
    } catch (e) {
      setErr(e.response?.data?.error || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white border border-slate-200 rounded-2xl shadow-lg w-full max-w-md relative z-10 p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-black font-serif text-slate-800">
            {action === 'approve' ? 'Approve Account' : 'Reject Account'}
          </h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="mb-6 p-4 bg-slate-50 rounded-xl">
          <p className="font-bold text-slate-800">{item.name}</p>
          <p className="text-sm text-slate-500">{item.email}</p>
          <p className="text-xs text-slate-400 mt-1 capitalize">{type} account</p>
        </div>

        {err && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl">{err}</div>
        )}

        {action === 'approve' ? (
          <div className="space-y-2 mb-6">
            <label className="text-xs font-black uppercase tracking-widest text-indigo-600 ml-1">Patient Limit</label>
            <input
              type="number" min="1" max="9999"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full bg-white border border-slate-200 text-slate-800 rounded-2xl py-3 px-4 outline-none focus:border-indigo-400 transition-all"
            />
            <p className="text-xs text-slate-500 ml-1">Max patients this {type} can manage</p>
          </div>
        ) : (
          <div className="space-y-2 mb-6">
            <label className="text-xs font-black uppercase tracking-widest text-indigo-600 ml-1">Rejection Reason</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a reason for the applicant..."
              className="w-full bg-white border border-slate-200 text-slate-800 rounded-2xl py-3 px-4 outline-none focus:border-indigo-400 transition-all resize-none"
            />
          </div>
        )}

        <div className="flex items-center justify-end space-x-3">
          <button onClick={onClose} className="px-5 py-2.5 font-bold text-slate-500 hover:text-slate-800">Cancel</button>
          <button
            onClick={submit}
            disabled={loading}
            className={`px-6 py-2.5 rounded-xl font-bold flex items-center space-x-2 transition-all ${
              action === 'approve'
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
              action === 'approve' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />
            )}
            <span>{action === 'approve' ? 'Approve' : 'Reject'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Doctor create/edit modal ───────────────────────────────────────────────
const DoctorModal = ({ doctor, onClose, onDone }) => {
  const [form, setForm] = useState({
    name: doctor?.name || '',
    email: doctor?.email || '',
    license_number: doctor?.license_number || '',
    hospital: doctor?.hospital || '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      if (doctor) {
        await api('patch', `/api/admin/doctors/${doctor.id}`, form);
      } else {
        await api('post', '/api/admin/doctors', form);
      }
      onDone();
      onClose();
    } catch (e) {
      setErr(e.response?.data?.error || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const field = (label, key, type = 'text', placeholder = '', required = true) => (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{label}</label>
      <input
        type={type}
        required={required}
        placeholder={placeholder}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full bg-white border border-slate-200 text-slate-800 rounded-2xl py-3 px-4 outline-none focus:border-indigo-400 transition-all"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white border border-slate-200 rounded-2xl shadow-lg w-full max-w-xl relative z-10">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xl font-black font-serif text-slate-800">{doctor ? 'Update Doctor' : 'Register New Doctor'}</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-8 space-y-5">
          {err && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl">{err}</div>}
          <div className="grid grid-cols-2 gap-5">
            {field('Full Name', 'name')}
            {field('License Number', 'license_number')}
          </div>
          {field('Email Address', 'email', 'email')}
          {field('Affiliated Hospital', 'hospital')}
          {field(
            doctor ? 'New Password (optional)' : 'Initial Password',
            'password', 'password',
            doctor ? 'Leave blank to keep current' : '',
            !doctor
          )}
          <div className="flex justify-end space-x-4 pt-2">
            <button type="button" onClick={onClose} className="px-6 py-3 font-bold text-slate-500">Cancel</button>
            <button type="submit" disabled={loading} className="glass-button flex items-center space-x-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{doctor ? 'Update' : 'Authorize'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Dashboard ─────────────────────────────────────────────────────────
const AdminDashboard = ({ user, onLogout }) => {
  const [tab, setTab] = useState('pending');
  const [pending, setPending] = useState({ doctors: [], hospitals: [] });
  const [doctors, setDoctors] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null); // { type, item, action } | { type: 'doctor', item } | null

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api('get', '/api/admin/pending-users');
      setPending(r.data);
    } catch (e) {
      if (e.response?.status === 401) handleLogout();
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api('get', '/api/admin/doctors');
      setDoctors(r.data);
    } catch (e) {
      if (e.response?.status === 401) handleLogout();
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const r = await api('get', '/api/admin/notifications');
      setNotifications(r.data);
    } catch (_) {}
  }, []);

  const handleLogout = async () => {
    try { await api('post', '/api/auth/logout'); } catch (_) {}
    onLogout();
  };

  const markAllRead = async () => {
    try {
      await api('post', '/api/admin/notifications/read');
      setNotifications(n => n.map(x => ({ ...x, is_read: true })));
    } catch (_) {}
  };

  const deleteDoctor = async (id) => {
    if (!window.confirm('Delete this doctor account? This cannot be undone.')) return;
    try {
      await api('delete', `/api/admin/doctors/${id}`);
      fetchDoctors();
    } catch (e) { alert(e.response?.data?.error || 'Delete failed'); }
  };

  useEffect(() => {
    fetchPending();
    fetchNotifications();
  }, [fetchPending, fetchNotifications]);

  useEffect(() => {
    if (tab === 'doctors') fetchDoctors();
    if (tab === 'notifications') fetchNotifications();
  }, [tab, fetchDoctors, fetchNotifications]);

  const unread = notifications.filter(n => !n.is_read).length;

  const pendingTotal = pending.doctors.length + pending.hospitals.length;

  const NavBtn = ({ id, icon: Icon, label, badge }) => (
    <button
      onClick={() => setTab(id)}
      className={`nav-item w-full text-left ${tab === id ? 'active text-indigo-600' : 'text-slate-500'}`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="font-medium flex-1">{label}</span>
      {badge > 0 && (
        <span className="bg-red-500 text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="flex h-screen bg-[#EEF2FF]">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 sticky top-0 flex flex-col p-6 z-50">
        <div className="flex items-center space-x-3 mb-10 px-2">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
            <ShieldCheck className="text-white w-6 h-6" />
          </div>
          <div>
            <span className="text-xl font-black font-serif block text-indigo-600">ADMIN</span>
            <span className="text-[10px] font-bold text-slate-500 tracking-[0.2em]">CONTROL</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          <NavBtn id="pending"       icon={Clock}     label="Pending Approvals" badge={pendingTotal} />
          <NavBtn id="doctors"       icon={Users}     label="Doctors" />
          <NavBtn id="notifications" icon={Bell}      label="Notifications" badge={unread} />
          <NavBtn id="activity"      icon={Activity}  label="Audit Log" />
        </nav>

        <div className="pt-4 border-t border-slate-200 space-y-3">
          <div className="px-2">
            <p className="text-xs font-bold text-slate-600 truncate">{user?.name || 'Admin'}</p>
            <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="nav-item w-full text-left text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto">

          {/* ── Pending Approvals ── */}
          {tab === 'pending' && (
            <>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-3xl font-black font-serif mb-1">Pending Approvals</h1>
                  <p className="text-slate-500">{pendingTotal} account{pendingTotal !== 1 ? 's' : ''} awaiting review</p>
                </div>
                <button onClick={fetchPending} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500">
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>

              {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>
              ) : pendingTotal === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-lg p-16 text-center">
                  <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                  <p className="text-xl font-bold text-slate-700">All caught up!</p>
                  <p className="text-slate-500 mt-1">No pending approvals at this time.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {pending.doctors.length > 0 && (
                    <section>
                      <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4 px-1">
                        Doctors ({pending.doctors.length})
                      </h2>
                      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm divide-y divide-slate-100">
                        {pending.doctors.map(d => (
                          <div key={d.id} className="flex items-center justify-between p-5 hover:bg-slate-50">
                            <div className="flex items-center space-x-4">
                              <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
                                <ShieldCheck className="w-5 h-5 text-slate-400" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-800">{d.name}</p>
                                <p className="text-xs text-slate-500">{d.email}</p>
                                <div className="flex items-center space-x-2 mt-1">
                                  <StatusBadge status={d.status} />
                                  {d.license_number && (
                                    <span className="text-[10px] font-mono text-slate-500">{d.license_number}</span>
                                  )}
                                  {d.hospital && (
                                    <span className="text-[10px] text-slate-500">· {d.hospital}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {d.status !== 'rejected' && (
                                <button
                                  onClick={() => setModal({ type: 'doctor', item: d, action: 'reject' })}
                                  className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm font-bold transition-all"
                                >
                                  Reject
                                </button>
                              )}
                              {d.status !== 'approved' && (
                                <button
                                  onClick={() => setModal({ type: 'doctor', item: d, action: 'approve' })}
                                  className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-sm font-bold transition-all"
                                >
                                  Approve
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {pending.hospitals.length > 0 && (
                    <section>
                      <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4 px-1">
                        Hospitals ({pending.hospitals.length})
                      </h2>
                      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm divide-y divide-slate-100">
                        {pending.hospitals.map(h => (
                          <div key={h.id} className="flex items-center justify-between p-5 hover:bg-slate-50">
                            <div className="flex items-center space-x-4">
                              <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
                                <Building2 className="w-5 h-5 text-slate-400" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-800">{h.name}</p>
                                <p className="text-xs text-slate-500">{h.email}</p>
                                <div className="flex items-center space-x-2 mt-1">
                                  <StatusBadge status={h.status} />
                                  {h.contact_person && (
                                    <span className="text-[10px] text-slate-500">Contact: {h.contact_person}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {h.status !== 'rejected' && (
                                <button
                                  onClick={() => setModal({ type: 'hospital', item: h, action: 'reject' })}
                                  className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm font-bold transition-all"
                                >
                                  Reject
                                </button>
                              )}
                              <button
                                onClick={() => setModal({ type: 'hospital', item: h, action: 'approve' })}
                                className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-sm font-bold transition-all"
                              >
                                Approve
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Doctor Management ── */}
          {tab === 'doctors' && (
            <>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-3xl font-black font-serif mb-1">Doctor Management</h1>
                  <p className="text-slate-500">Configure and monitor clinical user access</p>
                </div>
                <button
                  onClick={() => setModal({ type: 'doctor_edit', item: null })}
                  className="glass-button flex items-center space-x-2"
                >
                  <UserPlus className="w-5 h-5" />
                  <span>Register Doctor</span>
                </button>
              </div>

              {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="py-4 px-6 text-xs text-slate-500 font-black uppercase tracking-widest">Doctor</th>
                          <th className="py-4 px-6 text-xs text-slate-500 font-black uppercase tracking-widest">Status</th>
                          <th className="py-4 px-6 text-xs text-slate-500 font-black uppercase tracking-widest">Quota</th>
                          <th className="py-4 px-6 text-xs text-slate-500 font-black uppercase tracking-widest">Facility</th>
                          <th className="py-4 px-6 text-xs text-slate-500 font-black uppercase tracking-widest text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {doctors.map(d => {
                          const pct = d.patient_limit ? Math.round((d.patients_used / d.patient_limit) * 100) : 0;
                          const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
                          return (
                            <tr key={d.id} className="hover:bg-slate-50 transition-colors group">
                              <td className="py-5 px-6">
                                <div className="flex items-center space-x-4">
                                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200 group-hover:border-indigo-300 transition-colors">
                                    <ShieldCheck className="w-5 h-5 text-slate-400 group-hover:text-indigo-500" />
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-800">{d.name}</p>
                                    <p className="text-xs text-slate-500">{d.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-5 px-6"><StatusBadge status={d.status || 'approved'} /></td>
                              <td className="py-5 px-6">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400">{d.patients_used || 0} / {d.patient_limit || 50}</span>
                                    <span className={pct >= 90 ? 'text-red-400' : pct >= 70 ? 'text-amber-400' : 'text-emerald-400'}>{pct}%</span>
                                  </div>
                                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden w-24">
                                    <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              </td>
                              <td className="py-5 px-6">
                                <p className="text-sm text-slate-600 flex items-center">
                                  <Building2 className="w-3.5 h-3.5 mr-2 text-slate-400" />
                                  {d.hospital || '—'}
                                </p>
                              </td>
                              <td className="py-5 px-6 text-right">
                                <div className="flex items-center justify-end space-x-2">
                                  <button
                                    onClick={() => setModal({ type: 'doctor_edit', item: d })}
                                    className="p-2.5 rounded-xl bg-slate-100 text-slate-500 hover:text-indigo-600 hover:bg-slate-200 transition-all"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => deleteDoctor(d.id)}
                                    className="p-2.5 rounded-xl bg-slate-100 text-slate-500 hover:text-red-500 hover:bg-red-50 transition-all"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {doctors.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-16 text-center text-slate-400">No doctors registered yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Notifications ── */}
          {tab === 'notifications' && (
            <>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-3xl font-black font-serif mb-1">Notifications</h1>
                  <p className="text-slate-500">{unread} unread</p>
                </div>
                {unread > 0 && (
                  <button onClick={markAllRead} className="glass-button text-sm flex items-center space-x-2">
                    <Eye className="w-4 h-4" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-16 text-center">
                  <Bell className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-400">No notifications yet</p>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm divide-y divide-slate-100">
                  {notifications.map(n => (
                    <div key={n.id} className={`p-5 flex items-start space-x-4 ${!n.is_read ? 'bg-amber-50' : ''}`}>
                      <div className={`w-2.5 h-2.5 rounded-full mt-2 flex-shrink-0 ${!n.is_read ? 'bg-amber-500' : 'bg-slate-200'}`} />
                      <div className="flex-1">
                        <p className="font-bold text-slate-800 text-sm">{n.title}</p>
                        <p className="text-slate-500 text-sm mt-0.5">{n.message}</p>
                        <p className="text-slate-400 text-xs mt-1">
                          {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                        </p>
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                        n.notif_type === 'approval' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        n.notif_type === 'rejection' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }`}>{n.notif_type || 'info'}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Audit Log ── */}
          {tab === 'activity' && <AuditLog />}
        </div>
      </main>

      {/* Modals */}
      {modal?.action && (
        <ActionModal
          item={modal.item}
          type={modal.type}
          action={modal.action}
          onClose={() => setModal(null)}
          onDone={fetchPending}
        />
      )}
      {modal?.type === 'doctor_edit' && (
        <DoctorModal
          doctor={modal.item}
          onClose={() => setModal(null)}
          onDone={fetchDoctors}
        />
      )}
    </div>
  );
};

// ── Audit Log tab ──────────────────────────────────────────────────────────
const AuditLog = () => {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('get', '/api/admin/actions')
      .then(r => setActions(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-black font-serif mb-1">Audit Log</h1>
        <p className="text-slate-500">All admin actions recorded for compliance</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-indigo-400 animate-spin" /></div>
      ) : actions.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-16 text-center">
          <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-400">No admin actions recorded yet</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm divide-y divide-slate-100">
          {actions.map(a => (
            <div key={a.id} className="p-5 flex items-center space-x-4">
              <div className="w-2 h-2 rounded-full bg-amber-400/70 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-800 capitalize">{(a.action || '').replace(/_/g, ' ')}</p>
                <p className="text-xs text-slate-500 mt-0.5">{a.details}</p>
              </div>
              <p className="text-xs text-slate-400 flex-shrink-0">
                {a.timestamp ? new Date(a.timestamp).toLocaleString() : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default AdminDashboard;
