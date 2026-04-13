import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Activity, 
  Users, 
  UserPlus, 
  Settings, 
  LogOut, 
  LayoutDashboard, 
  FileText
} from 'lucide-react';

const Sidebar = () => {
  return (
    <div className="w-64 h-screen glass-card rounded-none border-y-0 border-l-0 sticky top-0 flex flex-col p-6 z-50">
      <div className="flex items-center space-x-3 mb-10 px-2">
        <div className="w-10 h-10 gradient-teal rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/20">
          <Activity className="text-[#0A0F1E] w-6 h-6" />
        </div>
        <span className="text-xl font-bold font-serif whitespace-nowrap">e-Partogram</span>
      </div>

      <nav className="flex-1 space-y-2">
        <NavLink 
          to="/dashboard" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="font-medium">Dashboard</span>
        </NavLink>
        
        <NavLink 
          to="/patients" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Users className="w-5 h-5" />
          <span className="font-medium">Patients</span>
        </NavLink>
        
        <NavLink 
          to="/new-patient" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <UserPlus className="w-5 h-5" />
          <span className="font-medium">New Patient</span>
        </NavLink>
        
        <NavLink 
          to="/reports" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <FileText className="w-5 h-5" />
          <span className="font-medium">Reports</span>
        </NavLink>
      </nav>

      <div className="mt-auto space-y-2">
        <button className="nav-item w-full text-left bg-white/5 border border-white/5 cursor-pointer">
          <Settings className="w-5 h-5" />
          <span className="font-medium">Settings</span>
        </button>
        
        <button 
          onClick={() => {
            localStorage.removeItem('token');
            window.location.href = '/login';
          }}
          className="nav-item w-full text-left text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Log Out</span>
        </button>
      </div>

      <div className="mt-8 px-4 py-3 bg-white/5 rounded-2xl border border-white/10">
        <p className="text-xs text-slate-400 mb-1">Logged in as</p>
        <p className="text-sm font-semibold truncate text-[#00C9A7]">Dr. Priya Sharma</p>
      </div>
    </div>
  );
};

export default Sidebar;
