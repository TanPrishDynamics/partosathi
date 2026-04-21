import React, { useState } from 'react';
import axios from 'axios';
import { Shield, Lock, Mail, Loader2 } from 'lucide-react';

const AdminLogin = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const resp = await axios.post('/api/auth/admin-login', { email, password });
      localStorage.setItem('token', resp.data.token);
      onLogin(resp.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050A18] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 gradient-gold opacity-5 blur-3xl rounded-full"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 gradient-gold opacity-5 blur-3xl rounded-full"></div>
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 gradient-gold rounded-3xl shadow-2xl mb-6 transform rotate-12">
            <Shield className="w-10 h-10 text-[#050A18]" />
          </div>
          <h1 className="text-4xl font-black font-serif mb-2 tracking-tight">Admin Portal</h1>
          <p className="text-slate-500 font-medium">TanPrish Dynamics — Control Center</p>
        </div>

        <div className="glass-card p-8 border-white/10">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm font-bold text-center animate-pulse">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-[#D4AF37] ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within:text-[#D4AF37] transition-colors" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-[#D4AF37] focus:bg-white/[0.08] transition-all"
                  placeholder="admin@tanprish-dynamics.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-[#D4AF37] ml-1">Secure Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within:text-[#D4AF37] transition-colors" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-[#D4AF37] focus:bg-white/[0.08] transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full glass-button py-4 flex items-center justify-center space-x-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  <span>Grant Access</span>
                </>
              )}
            </button>
          </form>
        </div>
        
        <p className="text-center mt-8 text-slate-600 text-sm">
          Protected by e-Partogram Security Infrastructure
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
