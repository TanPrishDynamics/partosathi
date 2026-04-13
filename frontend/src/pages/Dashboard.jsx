import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Plus, 
  RefreshCcw, 
  ArrowLeft,
  Loader2,
  Table as TableIcon,
  BarChart3
} from 'lucide-react';

import Sidebar from '../components/Sidebar';
import PatientSummary from '../components/PatientSummary';
import PartographChart from '../components/PartographChart';
import FHRChart from '../components/FHRChart';
import ContractionChart from '../components/ContractionChart';
import ObservationsTable from '../components/ObservationsTable';
import AlertsPanel from '../components/AlertsPanel';
import ObservationForm from '../components/ObservationForm';

const Dashboard = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [observations, setObservations] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState('charts'); // 'charts' or 'table'

  const fetchData = async () => {
    try {
      const authHeader = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
      const [pResp, oResp, aResp] = await Promise.all([
        axios.get(`/api/patient/${id}`, authHeader),
        axios.get(`/api/observations/${id}`, authHeader),
        axios.get(`/api/alerts/${id}`, authHeader)
      ]);
      setPatient(pResp.data);
      setObservations(oResp.data);
      setAlerts(aResp.data);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [id]);

  const handleAddObservation = async (data) => {
    try {
      const authHeader = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
      await axios.post('/api/observation', data, authHeader);
      setShowForm(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Error saving observation');
    }
  };

  const handleAcknowledgeAlert = async (alertId) => {
    try {
      const authHeader = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
      await axios.patch(`/api/alerts/${alertId}/acknowledge`, {}, authHeader);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportPDF = async () => {
    try {
      const resp = await axios.get(`/api/export/pdf/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `partogram_${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
      alert('Error exporting PDF');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-[#0A0F1E] items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#00C9A7] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0A0F1E] overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 overflow-y-auto p-8 relative">
        <div className="max-w-7xl mx-auto">
          
          <div className="flex items-center justify-between mb-8">
            <button 
              onClick={() => navigate('/patients')}
              className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors cursor-pointer group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Back to Patients</span>
            </button>

            <div className="flex items-center space-x-4">
              <div className="bg-white/5 rounded-xl border border-white/5 p-1 flex">
                <button 
                  onClick={() => setViewMode('charts')}
                  className={`p-2 rounded-lg flex items-center space-x-2 transition-all cursor-pointer ${viewMode === 'charts' ? 'bg-[#00C9A7] text-[#0A0F1E] shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span className="text-xs font-bold">Visualization</span>
                </button>
                <button 
                  onClick={() => setViewMode('table')}
                  className={`p-2 rounded-lg flex items-center space-x-2 transition-all cursor-pointer ${viewMode === 'table' ? 'bg-[#00C9A7] text-[#0A0F1E] shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  <TableIcon className="w-4 h-4" />
                  <span className="text-xs font-bold">Data Log</span>
                </button>
              </div>

              <button 
                onClick={fetchData}
                className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                title="Refresh Data"
              >
                <RefreshCcw className="w-4 h-4 text-slate-400" />
              </button>

              <button 
                onClick={() => setShowForm(true)}
                className="glass-button flex items-center space-x-2"
              >
                <Plus className="w-5 h-5" />
                <span className="font-bold">Add Observation</span>
              </button>
            </div>
          </div>

          <PatientSummary patient={patient} onExportPDF={handleExportPDF} />

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
            
            {/* Visual Charts Area */}
            <div className={`xl:col-span-3 space-y-8 ${viewMode !== 'charts' ? 'hidden' : ''}`}>
              <PartographChart patient={patient} observations={observations} />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <FHRChart patient={patient} observations={observations} />
                <ContractionChart patient={patient} observations={observations} />
              </div>
            </div>

            {/* Table View */}
            <div className={`xl:col-span-3 ${viewMode !== 'table' ? 'hidden' : ''}`}>
              <ObservationsTable observations={observations} />
            </div>

            {/* Side Panel (Alerts) */}
            <div className="xl:col-span-1 min-w-0">
              <AlertsPanel alerts={alerts} onAcknowledge={handleAcknowledgeAlert} />
            </div>

          </div>
        </div>

        {showForm && (
          <ObservationForm 
            patientId={id} 
            onSave={handleAddObservation} 
            onClose={() => setShowForm(false)} 
          />
        )}
      </main>
    </div>
  );
};

export default Dashboard;
