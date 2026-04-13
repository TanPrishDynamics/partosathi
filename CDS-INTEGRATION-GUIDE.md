# Clinical Decision Support (CDS) Integration Guide

## Overview

The Clinical Decision Support system for e-Partogram processes labor monitoring data using WHO standards and generates:
- ✅ Normalized structured JSON
- ✅ Clinical alerts (RED/YELLOW/GREEN)
- ✅ Graph-ready data for partograph visualization
- ✅ Dilation rate analysis
- ✅ WHO alert/action line status

---

## API ENDPOINTS

### 1. Single Observation Analysis

**Endpoint:** `POST /api/cds/analyze-observation`

**Authentication:** Required (JWT token)

**Purpose:** Analyze a single labor observation with full clinical decision support

#### Request Example (JSON structured data):
```json
{
  "patient_id": "PTH-001",
  "data": {
    "time_hours": 2,
    "fhr": 145,
    "cervical_dilation": 4,
    "contractions_count": 3,
    "contractions_duration": 40,
    "head_descent": "3/5",
    "amniotic_fluid": "clear",
    "moulding": "+",
    "pulse": 84,
    "bp": "120/80",
    "temperature": 37,
    "urine_protein": "negative",
    "urine_ketones": "negative"
  }
}
```

#### Request Example (Semi-structured freetext):
```json
{
  "patient_id": "PTH-001",
  "data": "Time: 2 hours\nFHR: 145 bpm\nCervical dilation: 4 cm\nContractions: 3 in 10 min, lasting 40 sec\nHead descent: 3/5\nAmniotic fluid: clear\nMoulling: +\nPulse: 84 bpm\nBP: 120/80 mmHg\nTemperature: 37°C\nUrine: protein negative, ketones negative"
}
```

#### Response (Success):
```json
{
  "success": true,
  "patient_id": "PTH-001",
  "normalized_data": {
    "timestamp": "2026-04-13T10:30:00",
    "time_hours": 2,
    "fetal": {
      "fhr": 145,
      "amniotic_fluid": "clear",
      "moulding": "+"
    },
    "labor": {
      "cervical_dilation": 4,
      "head_descent": "3/5",
      "contractions": {
        "count": 3,
        "duration_sec": 40
      }
    },
    "maternal": {
      "pulse": 84,
      "bp": {
        "systolic": 120,
        "diastolic": 80,
        "formatted": "120/80"
      },
      "temperature": 37,
      "urine": {
        "protein": "negative",
        "ketones": "negative",
        "volume_ml": null
      }
    }
  },
  "alerts": [],
  "status": "normal",
  "alert_summary": {
    "total": 0,
    "critical": 0,
    "warning": 0
  },
  "plot_ready": {
    "x": 2,
    "y_dilation": 4,
    "y_station": "3/5",
    "fhr": 145,
    "contractions": 3
  }
}
```

#### Response (With Alerts):
```json
{
  "success": true,
  "patient_id": "PTH-002",
  "normalized_data": { ... },
  "alerts": [
    {
      "severity": "RED",
      "type": "fetal_distress",
      "message": "CRITICAL: FHR 95 bpm below normal range (<110 bpm). Risk of fetal hypoxia.",
      "action": "Immediate fetal assessment; consider emergency intervention"
    },
    {
      "severity": "YELLOW",
      "type": "meconium_staining",
      "message": "WARNING: Meconium-stained amniotic fluid detected. Possible fetal compromise.",
      "action": "Increased monitoring; prepare for resuscitation"
    }
  ],
  "status": "critical",
  "alert_summary": {
    "total": 2,
    "critical": 1,
    "warning": 1
  }
}
```

---

### 2. Batch Analysis (Multiple Observations)

**Endpoint:** `POST /api/cds/batch-analyze`

**Purpose:** Analyze multiple observations at once (useful for importing historical data)

#### Request Example:
```json
{
  "patient_id": "PTH-001",
  "observations": [
    {
      "timestamp": "2026-04-13T08:00:00",
      "time_hours": 0,
      "fhr": 142,
      "cervical_dilation": 3,
      ...
    },
    {
      "timestamp": "2026-04-13T09:00:00",
      "time_hours": 1,
      "fhr": 140,
      "cervical_dilation": 3.5,
      ...
    },
    {
      "timestamp": "2026-04-13T10:00:00",
      "time_hours": 2,
      "fhr": 145,
      "cervical_dilation": 4,
      ...
    }
  ]
}
```

#### Response:
```json
{
  "success": true,
  "patient_id": "PTH-001",
  "observations_analyzed": 3,
  "results": [
    {
      "normalized_data": { ... },
      "alerts": [],
      "status": "normal"
    },
    {
      "normalized_data": { ... },
      "alerts": [],
      "status": "normal"
    },
    {
      "normalized_data": { ... },
      "alerts": [],
      "status": "normal"
    }
  ]
}
```

---

## CLINICAL THRESHOLDS (WHO Standards)

### Fetal Alerts
- **FHR < 110 bpm** → RED "Fetal Distress"
- **FHR > 160 bpm** → RED "Fetal Tachycardia"
- **Meconium-stained fluid** → YELLOW warning
- **Excessive moulding (+++)** → YELLOW warning

### Labor Progress
- **Dilation rate < 1 cm/hr** (in active phase ≥4 cm) → YELLOW "Slow Labor"
- **Crossing alert line** → Flagged
- **Crossing action line** → RED "Urgent intervention recommended"

### Maternal Condition
- **Pulse > 100 bpm** → YELLOW "Tachycardia"
- **BP ≥ 140/90 mmHg** → YELLOW "Hypertension Risk"
- **Temperature > 38°C** → YELLOW "Possible Infection"
- **Proteinuria detected** → YELLOW warning (preeclampsia risk)

### Contraction Pattern
- **≥5 contractions/10 min** → YELLOW "Strong contractions"

---

## USAGE EXAMPLES

### Python / Requests Library

```python
import requests
import json

# Set up
BASE_URL = "http://localhost:5001"
TOKEN = "your_jwt_token"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}

# Example 1: Analyze single observation
observation = {
    "patient_id": "PTH-001",
    "data": {
        "time_hours": 2,
        "fhr": 145,
        "cervical_dilation": 4,
        "contractions_count": 3,
        "contractions_duration": 40,
        "head_descent": "3/5",
        "amniotic_fluid": "clear",
        "moulding": "+",
        "pulse": 84,
        "bp": "120/80",
        "temperature": 37,
        "urine_protein": "negative",
        "urine_ketones": "negative"
    }
}

response = requests.post(
    f"{BASE_URL}/api/cds/analyze-observation",
    headers=HEADERS,
    json=observation
)

result = response.json()
print(f"Status: {result['status']}")
print(f"Alerts: {len(result['alerts'])}")
for alert in result['alerts']:
    print(f"  - {alert['severity']}: {alert['message']}")

# Example 2: Freetext input
freetext_observation = {
    "patient_id": "PTH-001",
    "data": """
    Time: 3 hours
    FHR: 105 bpm
    Cervical dilation: 5 cm
    Contractions: 4 in 10 min, lasting 45 sec
    Head descent: 2/5
    Amniotic fluid: meconium
    Moulling: ++
    Pulse: 98 bpm
    BP: 135/88 mmHg
    Temperature: 38.2°C
    Urine: protein negative, ketones negative
    """
}

response = requests.post(
    f"{BASE_URL}/api/cds/analyze-observation",
    headers=HEADERS,
    json=freetext_observation
)

result = response.json()
if result['alert_summary']['critical'] > 0:
    print("⚠️  CRITICAL ALERTS - Immediate action required!")
```

### JavaScript / Fetch

```javascript
const analyzeObservation = async (patientId, observationData) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch('/api/cds/analyze-observation', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      patient_id: patientId,
      data: observationData
    })
  });
  
  const result = await response.json();
  return result;
};

// Usage in React component
const handleObservationSubmit = async (formData) => {
  const result = await analyzeObservation('PTH-001', formData);
  
  if (result.status === 'critical') {
    showCriticalAlert(result.alerts);
  } else if (result.status === 'warning') {
    showWarningAlert(result.alerts);
  }
  
  // Update partograph with plot_ready data
  updatePartographChart(result.plot_ready);
};
```

### cURL

```bash
# Single observation
curl -X POST http://localhost:5001/api/cds/analyze-observation \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "PTH-001",
    "data": {
      "time_hours": 2,
      "fhr": 145,
      "cervical_dilation": 4,
      "contractions_count": 3,
      "contractions_duration": 40,
      "head_descent": "3/5",
      "amniotic_fluid": "clear",
      "moulling": "+",
      "pulse": 84,
      "bp": "120/80",
      "temperature": 37,
      "urine_protein": "negative",
      "urine_ketones": "negative"
    }
  }'
```

---

## ALERT STATUS CODES

| Status | Meaning | Action |
|--------|---------|--------|
| `normal` | All parameters within WHO thresholds | Continue routine monitoring |
| `warning` | One or more YELLOW alerts | Increased monitoring; assess situation |
| `critical` | One or more RED alerts | Urgent senior review; prepare for intervention |
| `error` | Validation failed; missing data | Check input data; retry |

---

## DILATION RATE CALCULATION

The system automatically calculates dilation rate (cm/hr) if:
1. Previous observation exists for the patient
2. Time between observations is known

**Example:**
- Time 0h: 3 cm dilation
- Time 2h: 4 cm dilation
- **Dilation rate:** (4 - 3) / 2 = **0.5 cm/hr** ← Below WHO 1 cm/hr threshold → YELLOW alert

---

## PLOTTING DATA FORMAT

The `plot_ready` field contains data formatted for Chart.js visualization:

```json
"plot_ready": {
  "x": 2,              // Time from admission (hours)
  "y_dilation": 4,     // Cervical dilation (cm), Y-axis left
  "y_station": "3/5",  // Head station
  "fhr": 145,          // Fetal heart rate (bpm)
  "contractions": 3    // Contractions per 10 min
}
```

**Integration with partograph:**
```javascript
// Add to partograph chart
partographChart.data.push({
  x: plotData.x,
  y: plotData.y_dilation,
  color: getAlertColor(status)
});
```

---

## ERROR RESPONSES

### Missing Required Fields
```json
{
  "success": false,
  "error": "validation_failed",
  "missing_fields": [
    "Missing field: cervical_dilation",
    "Missing field: fhr"
  ],
  "status": "error"
}
```

### Invalid Patient
```json
{
  "error": "404 Not Found"
}
```

### Server Error
```json
{
  "error": "string describing the error"
}
```

---

## WORKFLOW INTEGRATION

### Frontend Observation Form → CDS → Alerts + Chart

```
1. Doctor enters observation data
   ↓
2. POST to /api/cds/analyze-observation
   ↓
3. CDS normalizes + validates + generates alerts
   ↓
4. Frontend receives:
   - normalized_data (for storage)
   - alerts (for alert panel)
   - plot_ready (for partograph chart)
   ↓
5. Display alerts prominently
6. Update partograph visualization
7. Save to database via /api/observation
```

---

## TESTING THE SYSTEM

### Test Case 1: Normal Labor
```json
{
  "time_hours": 2,
  "fhr": 140,
  "cervical_dilation": 4,
  "contractions_count": 3,
  "contractions_duration": 40,
  "head_descent": "3/5",
  "amniotic_fluid": "clear",
  "moulling": "+",
  "pulse": 80,
  "bp": "120/80",
  "temperature": 37,
  "urine_protein": "negative",
  "urine_ketones": "negative"
}
```
**Expected:** status = "normal", alerts = []

### Test Case 2: Fetal Distress
```json
{
  "time_hours": 3,
  "fhr": 95,           // ← Triggers alert
  "cervical_dilation": 5,
  ...
}
```
**Expected:** status = "critical", 1 RED alert

### Test Case 3: Slow Labor
```json
{
  "time_hours": 4,
  "fhr": 140,
  "cervical_dilation": 4.5,    // ← Dilation rate 0.5 cm/hr
  ...
}
```
**Expected:** status = "warning", "Slow dilation" YELLOW alert

### Test Case 4: Meconium + Fever
```json
{
  "time_hours": 3,
  "fhr": 140,
  "amniotic_fluid": "meconium",  // ← YELLOW alert
  "temperature": 38.5,            // ← YELLOW alert
  ...
}
```
**Expected:** status = "warning", 2 YELLOW alerts

---

## PRODUCTION CONSIDERATIONS

1. **Data Privacy:** All observation data is stored securely; CDS operates on validated data only
2. **Audit Logging:** Record all CDS decisions for compliance/research
3. **Offline Support:** CDS can run locally if internet drops
4. **Real-time Alerts:** Integrate with SMS/push notifications for critical alerts
5. **Clinical Validation:** Have obstetricians review CDS logic quarterly
6. **Continuous Learning:** Use hospital outcomes to refine alert thresholds

---

**Document Version:** 1.0  
**Date:** April 13, 2026  
**Status:** Ready for Integration & Testing
