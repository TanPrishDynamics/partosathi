/**
 * Shared application-wide constants.
 * Import from here — avoid magic strings scattered across the codebase.
 */

export const PATIENT_STATUS = {
  ACTIVE:    'Active',
  COMPLETED: 'Completed',
};

export const RISK_LEVEL = {
  NORMAL:     'normal',
  WARNING:    'warning',
  CRITICAL:   'critical',
};

export const ALERT_TYPE = {
  RED:    'red',
  YELLOW: 'yellow',
  GREEN:  'green',
};

export const WHO_THRESHOLDS = {
  MIN_ACTIVE_DILATION_CM: 4,       // Active phase starts at ≥ 4 cm
  ALERT_LINE_CM_PER_HR:   1.0,     // Alert line: 1 cm/hr
  ACTION_LINE_HOURS:       4,      // Action line: 4 hrs right of alert line
  FHR_MIN_BPM:             110,    // Normal FHR minimum
  FHR_MAX_BPM:             160,    // Normal FHR maximum
  CONTRACTIONS_PER_10_MIN: 3,      // Adequate contraction frequency
  CONTRACTION_MIN_SEC:     40,     // Adequate contraction duration (seconds)
};

export const API_ROUTES = {
  PATIENTS:     '/api/patients',
  PATIENT:      (id) => `/api/patient/${id}`,
  OBSERVATIONS: (id) => `/api/patient/${id}/observations`,
  ALERTS:       (id) => `/api/patient/${id}/alerts`,
  EXPORT_PDF:   (id) => `/api/export/pdf/${id}`,
  AUTH_ME:      '/api/auth/me',
  AUTH_LOGIN:   '/api/auth/login',
};
