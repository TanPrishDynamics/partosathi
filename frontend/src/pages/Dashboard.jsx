import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  Plus, RefreshCcw, ArrowLeft, Loader2,
  Table as TableIcon, BarChart3, Cpu
} from 'lucide-react';

import Sidebar from '../components/Sidebar';
import PatientSummary from '../features/patients/PatientSummary';
import PartographChart from '../features/partogram/PartographChart';
import FHRChart from '../features/partogram/FHRChart';
import ContractionChart from '../features/partogram/ContractionChart';
import ObservationsTable from '../features/dashboard/ObservationsTable';
import AlertsPanel from '../features/dashboard/AlertsPanel';
import ObservationForm from '../features/dashboard/ObservationForm';
import DeliveryPredictor from '../features/partogram/DeliveryPredictor';

const Dashboard = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [observations, setObservations] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingObservation, setEditingObservation] = useState(null);
  const [viewMode, setViewMode] = useState('charts');
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [pR, oR, aR] = await Promise.all([
        api.get(`/api/patient/${id}`),
        api.get(`/api/observations/${id}`),
        api.get(`/api/alerts/${id}`),
      ]);
      setPatient(pR.data);
      setObservations(oR.data);
      setAlerts(aR.data);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) navigate('/login');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [id]);

  const handleAddObservation = async (data, obsId = null) => {
    try {
      if (obsId) await api.patch(`/api/observation/${obsId}`, data);
      else       await api.post('/api/observation', data);
      setShowForm(false);
      setEditingObservation(null);
      fetchData(true);
    } catch (err) {
      console.error(err);
      alert('Error saving observation');
    }
  };

  const handleDeleteObservation = async obsId => {
    if (!window.confirm('Delete this observation? Clinical alerts will be recalculated.')) return;
    try {
      await api.delete(`/api/observation/${obsId}`);
      fetchData(true);
    } catch (err) { console.error(err); }
  };

  const handleAcknowledgeAlert = async alertId => {
    try {
      await api.patch(`/api/alerts/${alertId}/acknowledge`, {});
      fetchData(true);
    } catch (err) { console.error(err); }
  };

  const handleExportPDF = async () => {
    try {
      const resp = await api.get(`/api/export/pdf/${id}`, { responseType: 'blob' });
      const url  = window.URL.createObjectURL(new Blob([resp.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `partogram_${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) { console.error(err); alert('Error exporting PDF'); }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(ellipse at top left, #0d1929 0%, #0B1220 55%, #060D18 100%)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)' }}>
            <Cpu style={{ width: '24px', height: '24px', color: '#22D3EE' }} className="animate-pulse" />
          </div>
          <p style={{ fontSize: '14px', color: '#6B7280', fontWeight: 500 }}>Loading partogram…</p>
        </div>
      </div>
    );
  }

  const activeAlerts = alerts.filter(a => !a.acknowledged).length;

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'radial-gradient(ellipse at top left, #0d1929 0%, #0B1220 55%, #060D18 100%)' }}>
      <Sidebar />

      <main style={{ flex: 1, overflowY: 'auto' }}>
        {/* ── Sticky header ──────────────────────────────────── */}
        <div style={{ position: 'sticky', top: 0, zIndex: 40, padding: '16px 40px', background: 'rgba(9,15,27,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

            {/* Left: back + active alerts */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button
                onClick={() => navigate('/patients')}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 500, transition: 'color 0.2s ease' }}
                onMouseOver={e => e.currentTarget.style.color = '#D1D5DB'}
                onMouseOut={e => e.currentTarget.style.color = '#6B7280'}
              >
                <ArrowLeft style={{ width: '15px', height: '15px' }} />
                Patients
              </button>
              {activeAlerts > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '5px 12px', borderRadius: '99px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#F87171', animation: 'ai-pulse-anim 1.3s ease-in-out infinite' }} />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#F87171' }}>
                    {activeAlerts} alert{activeAlerts > 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Right: view toggle + refresh + add */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* View toggle */}
              <div style={{ display: 'flex', gap: '3px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '4px' }}>
                {[
                  { mode: 'charts', icon: BarChart3, label: 'Charts' },
                  { mode: 'table',  icon: TableIcon, label: 'Log' },
                ].map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '7px 14px', borderRadius: '9px', border: 'none',
                      fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: viewMode === mode ? 'linear-gradient(135deg, #22D3EE, #0EA5E9)' : 'transparent',
                      color: viewMode === mode ? '#030D18' : '#6B7280',
                      boxShadow: viewMode === mode ? '0 3px 12px rgba(34,211,238,0.3)' : 'none',
                    }}
                  >
                    <Icon style={{ width: '14px', height: '14px' }} />
                    {label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => fetchData(false)}
                title="Refresh"
                style={{ width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', transition: 'all 0.2s ease' }}
                onMouseOver={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'}
                onMouseOut={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
              >
                <RefreshCcw style={{ width: '15px', height: '15px', color: refreshing ? '#22D3EE' : '#6B7280', animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              </button>

              <button
                onClick={() => setShowForm(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'linear-gradient(135deg, #22D3EE 0%, #0EA5E9 100%)', color: '#030D18', fontWeight: 700, fontSize: '14px', fontFamily: 'Poppins, sans-serif', borderRadius: '11px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(34,211,238,0.35)', transition: 'all 0.2s ease' }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(34,211,238,0.45)'; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(34,211,238,0.35)'; }}
              >
                <Plus style={{ width: '16px', height: '16px' }} />
                Add Observation
              </button>
            </div>
          </div>
        </div>

        {/* ── Body ──────────────────────────────────────────── */}
        <div style={{ padding: '28px 40px 48px', maxWidth: '1280px', margin: '0 auto' }}>
          <PatientSummary patient={patient} onExportPDF={handleExportPDF} />

          {/* Charts view */}
          <div className={viewMode !== 'charts' ? 'hidden' : 'space-y-6'}>
            <PartographChart patient={patient} observations={observations} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FHRChart patient={patient} observations={observations} />
              <ContractionChart patient={patient} observations={observations} />
            </div>

            <DeliveryPredictor patient={patient} observations={observations} />
          </div>

          {/* Table view */}
          <div className={viewMode !== 'table' ? 'hidden' : ''}>
            <ObservationsTable
              observations={observations}
              onEdit={obs => { setEditingObservation(obs); setShowForm(true); }}
              onDelete={handleDeleteObservation}
            />
          </div>

          {/* Always visible: Alerts */}
          <div className="mt-6">
            <AlertsPanel alerts={alerts} onAcknowledge={handleAcknowledgeAlert} />
          </div>
        </div>
      </main>

      {showForm && (
        <ObservationForm
          patientId={id}
          patient={patient}
          initialData={editingObservation}
          onSave={handleAddObservation}
          onClose={() => { setShowForm(false); setEditingObservation(null); }}
        />
      )}
    </div>
  );
};

export default Dashboard;
