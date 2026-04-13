import React, { useState } from 'react';
import axios from 'axios';
import { Activity, Lock, Mail, ChevronRight, Loader2, Building2, Stethoscope } from 'lucide-react';

const LoginPage = ({ onLogin }) => {
  const [loginMode, setLoginMode] = useState('doctor'); // 'doctor' or 'admin'
  const [email, setEmail] = useState('admin@hospital.com');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const endpoint = loginMode === 'admin' ? '/api/auth/admin-login' : '/api/auth/login';
      const resp = await axios.post(endpoint, { email, password });
      localStorage.setItem('token', resp.data.token);
      localStorage.setItem('role', resp.data.role);
      onLogin(loginMode === 'admin' ? resp.data.user : resp.data.doctor);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = (mode) => {
    setLoginMode(mode);
    setEmail('');
    setPassword('');
    setError('');
    if (mode === 'admin') {
      setEmail('admin@tanprish-dynamics.com');
      setPassword('admin123');
    } else {
      setEmail('admin@hospital.com');
      setPassword('admin123');
    }
  };

  return (
    <div className="min-h-screen gradient-navy flex items-center justify-center p-6 bg-[#0A0F1E]">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00C9A7]/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 gradient-teal rounded-2xl flex items-center justify-center shadow-2xl shadow-[#00C9A7]/30 mx-auto mb-4 animate-bounce-slow">
            <Activity className="text-[#0A0F1E] w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold font-serif mb-2 tracking-tight">e-Partogram</h1>
          <p className="text-slate-400">Electronic Labor Monitoring Solution</p>
        </div>

        <div className="glass-card p-8 bg-black/40">
          {/* Login Mode Tabs */}
          <div className="flex gap-4 mb-8 bg-white/5 p-2 rounded-xl border border-white/10">
            <button
              onClick={() => handleModeChange('doctor')}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg transition-all font-semibold ${
                loginMode === 'doctor'
                  ? 'bg-[#00C9A7] text-[#0A0F1E] shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Stethoscope className="w-5 h-5" />
              <span className="hidden sm:inline">Doctor</span>
            </button>
            <button
              onClick={() => handleModeChange('admin')}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg transition-all font-semibold ${
                loginMode === 'admin'
                  ? 'bg-[#00C9A7] text-[#0A0F1E] shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building2 className="w-5 h-5" />
              <span className="hidden sm:inline">Admin</span>
            </button>
          </div>

          <h2 className="text-xl font-bold mb-6">
            {loginMode === 'admin' ? 'Admin Portal' : 'Doctor Login'}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                {loginMode === 'admin' ? 'Company Email' : 'Hospital Email'}
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 focus:border-[#00C9A7] outline-none transition-all placeholder:text-slate-600 font-medium"
                  placeholder={loginMode === 'admin' ? 'admin@company.com' : 'doctor@hospital.com'}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 focus:border-[#00C9A7] outline-none transition-all placeholder:text-slate-600 font-medium"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full glass-button py-4 flex items-center justify-center space-x-2 group"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span className="text-lg">
                    {loginMode === 'admin' ? 'Access Admin Portal' : 'Enter Dashboard'}
                  </span>
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-xs text-slate-500">
              TanPrish Dynamics Healthcare Solutions &copy; 2026
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
