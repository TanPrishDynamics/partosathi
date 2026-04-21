/**
 * Dashboard API — observations, alerts, and partogram data.
 */
import api from '../../services/api';

export const getObservations    = (patientId) => api.get(`/api/patient/${patientId}/observations`).then(r => r.data);
export const addObservation     = (patientId, data) => api.post(`/api/patient/${patientId}/observation`, data).then(r => r.data);
export const updateObservation  = (patientId, obsId, data) => api.put(`/api/patient/${patientId}/observation/${obsId}`, data).then(r => r.data);
export const deleteObservation  = (patientId, obsId) => api.delete(`/api/patient/${patientId}/observation/${obsId}`).then(r => r.data);
export const getAlerts          = (patientId) => api.get(`/api/patient/${patientId}/alerts`).then(r => r.data);
export const acknowledgeAlert   = (patientId, alertId) => api.patch(`/api/patient/${patientId}/alert/${alertId}/acknowledge`).then(r => r.data);
