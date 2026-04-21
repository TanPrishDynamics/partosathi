/**
 * Patient API — feature-scoped API wrappers for the patients feature.
 * Uses the centralized Axios instance from services/api.js.
 * No auth headers needed here — handled by the interceptor.
 */
import api from '../../services/api';

export const getPatients       = ()           => api.get('/api/patients').then(r => r.data);
export const getPatient        = (id)         => api.get(`/api/patient/${id}`).then(r => r.data);
export const createPatient     = (data)       => api.post('/api/patient', data).then(r => r.data);
export const updatePatient     = (id, data)   => api.put(`/api/patient/${id}`, data).then(r => r.data);
export const setPatientStatus  = (id, status) => api.patch(`/api/patient/${id}/status`, { status }).then(r => r.data);
export const deletePatient     = (id)         => api.delete(`/api/patient/${id}`).then(r => r.data);
export const exportPatientPDF  = (id)         => api.get(`/api/export/pdf/${id}`, { responseType: 'blob' });
