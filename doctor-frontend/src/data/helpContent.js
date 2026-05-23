export const CATEGORIES = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    icon: '🚀',
    color: '#4A90E2',
    bg: 'rgba(74,144,226,0.08)',
    border: 'rgba(74,144,226,0.2)',
    desc: 'First login, navigation, and setup basics',
  },
  {
    id: 'patient-management',
    label: 'Patient Management',
    icon: '👤',
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.08)',
    border: 'rgba(139,92,246,0.2)',
    desc: 'Add, edit, and manage patient records',
  },
  {
    id: 'observations',
    label: 'Observations & Data Entry',
    icon: '📋',
    color: '#0891B2',
    bg: 'rgba(8,145,178,0.08)',
    border: 'rgba(8,145,178,0.2)',
    desc: 'Recording vitals, dilation, FHR, contractions',
  },
  {
    id: 'alerts',
    label: 'Alerts & Risk Predictions',
    icon: '⚠️',
    color: '#DC2626',
    bg: 'rgba(220,38,38,0.07)',
    border: 'rgba(220,38,38,0.18)',
    desc: 'Understanding red/yellow alerts and AI predictions',
  },
  {
    id: 'reports',
    label: 'Reports & Export',
    icon: '📄',
    color: '#16A34A',
    bg: 'rgba(22,163,74,0.07)',
    border: 'rgba(22,163,74,0.2)',
    desc: 'Exporting partograms and clinical summaries',
  },
  {
    id: 'account',
    label: 'Account & Security',
    icon: '🔒',
    color: '#D97706',
    bg: 'rgba(217,119,6,0.07)',
    border: 'rgba(217,119,6,0.2)',
    desc: 'Login, password, roles, and data privacy',
  },
];

export const QUICK_ACTIONS = [
  { label: 'How to create a patient', category: 'patient-management', q: 'How do I add a new patient?' },
  { label: 'How to interpret red alerts', category: 'alerts', q: 'What does a red alert mean?' },
  { label: 'What is the action line?', category: 'observations', q: 'What is the WHO alert/action line?' },
  { label: 'Export a PDF report', category: 'reports', q: 'How do I export a partogram report?' },
  { label: 'What does Emergency risk mean?', category: 'alerts', q: 'What does Emergency risk mean in AI prediction?' },
  { label: 'How to record FHR', category: 'observations', q: 'How do I record fetal heart rate?' },
];

export const FAQ_DATA = [
  {
    category: 'Getting Started',
    categoryId: 'getting-started',
    faqs: [
      {
        question: 'What is the e-Partogram system?',
        answer: [
          'An AI-powered digital labor monitoring tool based on the WHO partograph.',
          'Tracks cervical dilation, fetal heart rate, contractions, and maternal vitals in real time.',
          'Generates automatic alerts when clinical thresholds are crossed.',
          'Produces AI clinical summaries and exportable PDF reports.',
        ],
      },
      {
        question: 'How do I log in?',
        answer: [
          'Open the app and enter your registered email and password.',
          'Doctors use the standard login. Admins use the admin login tab.',
          'Sessions last 1 hour — you will be silently refreshed if active.',
          'If you are redirected to login, your session expired; simply log in again.',
        ],
      },
      {
        question: 'How do I navigate the dashboard?',
        answer: [
          'Use the left sidebar to move between: Dashboard, Patients, New Patient, Reports, Help.',
          'Click any patient name to open their partogram view.',
          'The top bar shows live alert counts and AI status.',
        ],
      },
      {
        question: 'Is the system usable on a tablet or phone?',
        answer: [
          'Yes — the interface is designed for one-hand tablet use.',
          'Works in Chrome and Safari on iOS/Android.',
          'For best experience use a tablet in landscape orientation.',
        ],
      },
    ],
  },
  {
    category: 'Patient Management',
    categoryId: 'patient-management',
    faqs: [
      {
        question: 'How do I add a new patient?',
        answer: [
          'Click "New Patient" in the sidebar.',
          'Fill in: Name, Age, Gravida, Parity, Gestational Age, Admission Time.',
          'Consent must be confirmed before saving.',
          'The system automatically assigns a unique patient ID (e.g., PTH-042).',
        ],
      },
      {
        question: 'Can I edit patient details after saving?',
        answer: [
          'Yes — open the patient record and click the Edit button.',
          'You can update all fields except the patient ID.',
          'Changes are saved immediately and logged in the audit trail.',
        ],
      },
      {
        question: 'How do I mark a patient as completed?',
        answer: [
          'Open the patient record.',
          'Click the status dropdown and select "Completed".',
          'Completed patients remain in the system for reporting but are filtered from the active list.',
        ],
      },
      {
        question: 'Can multiple doctors see the same patient?',
        answer: [
          'Each patient is assigned to the doctor who created them.',
          'Admins can view all patients.',
          'Doctors only see their own assigned patients.',
        ],
      },
    ],
  },
  {
    category: 'Observations & Data Entry',
    categoryId: 'observations',
    faqs: [
      {
        question: 'How do I record a new observation?',
        answer: [
          'Open the patient dashboard.',
          'Click "Add Observation" or use the observation panel on the right.',
          'Enter available vitals — all fields are optional except patient ID.',
          'Click Save — alerts fire automatically based on the new data.',
        ],
      },
      {
        question: 'How do I record fetal heart rate?',
        answer: [
          'In the observation form, enter the FHR value in the "Fetal Heart Rate (bpm)" field.',
          'Normal range: 110–160 bpm.',
          'Values below 110 trigger a Fetal Bradycardia alert (red).',
          'Values above 160 trigger a Fetal Tachycardia alert (red).',
        ],
      },
      {
        question: 'What is the WHO alert/action line?',
        answer: [
          'Alert line: Expected dilation of 1 cm/hr from the start of active labor (≥4 cm).',
          'Action line: The alert line shifted 4 hours to the right.',
          'Crossing the alert line = consider augmentation.',
          'Crossing the action line = urgent obstetric review, prepare for operative delivery.',
        ],
      },
      {
        question: 'What do the amniotic fluid options mean?',
        answer: [
          '"Clear" — normal.',
          '"Meconium" — fetal distress risk; continuous FHR monitoring required, prepare NICU.',
          '"Blood" — possible abruption or vasa praevia; immediate obstetric assessment.',
          '"Absent" — membranes ruptured with no fluid visible.',
        ],
      },
      {
        question: 'How often should I enter observations?',
        answer: [
          'WHO recommends every 30 minutes in active labor.',
          'FHR: every 30 minutes in active phase, every 5 minutes in second stage.',
          'BP and temperature: every 4 hours (more frequently if hypertension suspected).',
        ],
      },
    ],
  },
  {
    category: 'Alerts & Risk Predictions',
    categoryId: 'alerts',
    faqs: [
      {
        question: 'What does a red alert mean?',
        answer: [
          'Red = Critical — immediate clinical action required.',
          'Examples: Fetal bradycardia (<110 bpm), Action line crossed, Pre-eclampsia risk, Blood-stained fluid.',
          'Do NOT dismiss without reviewing the patient.',
          'Red alerts are logged and cannot be silently cleared.',
        ],
      },
      {
        question: 'What does a yellow alert mean?',
        answer: [
          'Yellow = Warning — close monitoring required.',
          'Examples: FHR borderline (110–120 or 150–160 bpm), Slow labor progress, Meconium-stained fluid.',
          'Take clinical action within the next 30–60 minutes.',
        ],
      },
      {
        question: 'What does Emergency risk mean in AI prediction?',
        answer: [
          'The AI model classifies labor into: Normal, Slow Progress, Prolonged Labor.',
          '"Emergency" is not a model output — check the specific red alerts instead.',
          'AI predictions are advisory only and must be confirmed by a qualified clinician.',
          'Never act on AI output alone without clinical assessment.',
        ],
      },
      {
        question: 'How do I acknowledge an alert?',
        answer: [
          'Click the alert card in the Alerts panel.',
          'Click "Acknowledge" to mark it as reviewed.',
          'Acknowledged alerts are still stored in the audit log.',
          'Alerts reset if a new observation is added that re-triggers the same condition.',
        ],
      },
      {
        question: 'Why are some alerts repeating?',
        answer: [
          'Alerts re-calculate on every new observation.',
          'If the clinical condition persists (e.g., dilation still below alert line), the alert will re-fire.',
          'This is intentional — no condition should be silently ignored.',
        ],
      },
    ],
  },
  {
    category: 'Reports & Export',
    categoryId: 'reports',
    faqs: [
      {
        question: 'How do I export a partogram report?',
        answer: [
          'Go to the Reports page from the sidebar.',
          'Find the patient in the list.',
          'Click the "Export PDF" button on the right.',
          'A full partogram PDF downloads immediately — no internet required once loaded.',
        ],
      },
      {
        question: 'What does the PDF report include?',
        answer: [
          'Patient demographics and admission details.',
          'Full cervical dilation chart with WHO alert/action lines.',
          'Fetal heart rate chart over time.',
          'Contraction frequency and duration.',
          'All recorded maternal vitals.',
          'Alert history with timestamps.',
        ],
      },
      {
        question: 'Can I print the report?',
        answer: [
          'Yes — open the PDF and use your browser or OS print function.',
          'Designed for A4 paper in portrait orientation.',
        ],
      },
    ],
  },
  {
    category: 'Account & Security',
    categoryId: 'account',
    faqs: [
      {
        question: 'How do I change my password?',
        answer: [
          'Contact your system administrator to reset your password.',
          'Passwords must have at least 8 characters, one uppercase letter, and one number.',
          'Sessions expire after 1 hour of inactivity for security.',
        ],
      },
      {
        question: 'Who can see patient data?',
        answer: [
          'Doctors can only see patients they created.',
          'Admins can view all patients across all doctors.',
          'All data access is logged in an audit trail (HIPAA compliant).',
        ],
      },
      {
        question: 'Is patient data encrypted?',
        answer: [
          'Yes — patient names are encrypted at rest using AES-256 (Fernet).',
          'All data is transmitted over HTTPS (TLS 1.2+).',
          'JWT authentication tokens are stored in HttpOnly cookies — not accessible by JavaScript.',
        ],
      },
      {
        question: 'What happens if I lose internet connection?',
        answer: [
          'Already-loaded pages continue to work (React SPA caches the UI).',
          'New observations and alerts require an active connection to save.',
          'FAQs and Help Center are fully available offline once the page loads.',
        ],
      },
    ],
  },
];
