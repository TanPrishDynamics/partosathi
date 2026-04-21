# WHO Partograph Datasets - Implementation & Integration Guide
## Complete Backend & Frontend Setup for E-Partogram System

**Status**: 🟢 PRODUCTION READY  
**Created**: April 13, 2026  
**Version**: 1.0

---

## TABLE OF CONTENTS

1. [Quick Start](#quick-start-5-minutes)
2. [Backend Setup](#backend-setup)
3. [API Endpoints](#api-endpoints)
4. [Frontend Integration](#frontend-integration)
5. [Database Setup](#database-setup)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

---

## QUICK START (5 MINUTES)

### Step 1: Load Module

```python
from backend.WHO_PARTOGRAPH_DATASETS import WHO_PARTOGRAPH_DATASETS, get_case_by_id

# Get all cases
print(f"Loaded {len([k for k in WHO_PARTOGRAPH_DATASETS if k != 'metadata'])} cases")

# Get specific case
case = get_case_by_id('PTH-001')
print(f"Patient: {case['patient']['name']}")
```

### Step 2: Run Validation

```bash
cd backend
python3 WHO_PARTOGRAPH_DATASETS.py
```

**Expected Output**:
```
case_001_normal_labour:
  Patient: Sarah Okoye (PTH-001)
  Status: NORMAL
  Records: 9

case_002_slow_labour:
  Patient: Amara Mensah (PTH-002)
  Status: PROLONGED
  Alert Line Crossed: YES
  Records: 7

... (3 more cases)

Total Cases: 5
Total Observations: 36
✓ All validations passed - Dataset is production-ready!
```

### Step 3: Export JSON

```bash
cd backend
python3 generate_json_export.py
# Creates: WHO_PARTOGRAPH_DATASETS.json (5.5 KB)
```

---

## BACKEND SETUP

### Installation

```bash
# 1. Copy files to backend
cp WHO_PARTOGRAPH_DATASETS.py backend/
cp WHO_PARTOGRAPH_DATASETS.json backend/

# 2. No additional dependencies needed - only uses Python stdlib!
# Verify:
python3 -c "from WHO_PARTOGRAPH_DATASETS import WHO_PARTOGRAPH_DATASETS; print('OK')"
```

### Flask Integration

Add to `backend/app.py`:

```python
from flask import Blueprint, jsonify
from WHO_PARTOGRAPH_DATASETS import (
    WHO_PARTOGRAPH_DATASETS,
    get_case_by_id,
    analyze_all_cases,
    validate_datasets
)

# Create blueprint for WHO datasets API
who_bp = Blueprint('who_datasets', __name__, url_prefix='/api/who')

@who_bp.route('/datasets', methods=['GET'])
def get_all_datasets():
    """Get metadata for all WHO cases"""
    return jsonify({
        "metadata": WHO_PARTOGRAPH_DATASETS["metadata"],
        "cases_count": len([k for k in WHO_PARTOGRAPH_DATASETS if k != "metadata"])
    })

@who_bp.route('/datasets/<case_id>', methods=['GET'])
def get_dataset_by_id(case_id):
    """Get complete dataset for specific case"""
    case = get_case_by_id(case_id)
    if not case:
        return jsonify({"error": "Case not found", "case_id": case_id}), 404
    return jsonify(case)

@who_bp.route('/datasets/<case_id>/analysis', methods=['GET'])
def get_case_analysis(case_id):
    """Get clinical analysis summary"""
    case = get_case_by_id(case_id)
    if not case:
        return jsonify({"error": "Case not found"}), 404
    
    return jsonify({
        "patient_id": case["patient"]["patient_id"],
        "patient_name": case["patient"]["name"],
        "age": case["patient"]["age"],
        "labour_duration_hours": len(case["labour_records"]),
        "analysis": case["analysis"]
    })

@who_bp.route('/datasets/<case_id>/timeline', methods=['GET'])
def get_case_timeline(case_id):
    """Get time-series data for visualization"""
    case = get_case_by_id(case_id)
    if not case:
        return jsonify({"error": "Case not found"}), 404
    
    records = case["labour_records"]
    
    # Calculate alert and action lines
    timeline = []
    for record in records:
        time_hr = record["time_hr"]
        alert_dilation = 3 + max(0, time_hr - 3) if time_hr >= 3 else 3
        action_dilation = alert_dilation + 4
        
        timeline.append({
            "time_hr": time_hr,
            "actual_dilation": record["cervical_dilation"],
            "fhr": record["fetal_heart_rate"],
            "pulse": record["maternal_pulse"],
            "temp": record["temperature_c"],
            "alert_line": alert_dilation,
            "action_line": min(action_dilation, 10)  # Cap at 10 cm
        })
    
    return jsonify({
        "patient_id": case["patient"]["patient_id"],
        "patient_name": case["patient"]["name"],
        "labour_status": case["analysis"]["labour_status"],
        "alert_crossed": case["analysis"]["alert_line_crossed"],
        "action_crossed": case["analysis"]["action_line_crossed"],
        "timeline": timeline,
        "total_hours": len(records)
    })

@who_bp.route('/datasets/summary', methods=['GET'])
def get_all_cases_summary():
    """Get summary of all cases"""
    return jsonify(analyze_all_cases())

@who_bp.route('/validate', methods=['GET'])
def validate_data():
    """Validate dataset integrity"""
    validation = validate_datasets()
    return jsonify(validation)

# Register blueprint in app
app.register_blueprint(who_bp)
```

---

## API ENDPOINTS

### Base URL
```
http://localhost:5001/api/who
```

### 1. GET /datasets
Get metadata for all cases

**Request**:
```bash
curl -X GET http://localhost:5001/api/who/datasets
```

**Response** (200):
```json
{
  "metadata": {
    "source": "WHO Partograph Clinical Standards",
    "version": "1.0",
    "cases": 5,
    "total_observations": 36
  },
  "cases_count": 5
}
```

---

### 2. GET /datasets/{case_id}
Get complete case data

**Request**:
```bash
curl -X GET http://localhost:5001/api/who/datasets/PTH-003
```

**Response** (200):
```json
{
  "patient": {
    "patient_id": "PTH-003",
    "name": "Nia Kofi",
    "age": 19,
    "gravida": 1,
    "para": 0,
    "admission_time": "2026-04-13T10:00:00Z",
    "membrane_status": "ruptured"
  },
  "labour_records": [
    {
      "time_hr": 0,
      "cervical_dilation": 3.0,
      "fetal_heart_rate": 140,
      "maternal_pulse": 82,
      "temperature_c": 37.0
    },
    ... (more records)
  ],
  "analysis": {
    "alert_line_crossed": true,
    "action_line_crossed": true,
    "labour_status": "obstructed",
    "diagnosis": "Obstructed labour with fetal distress - ACTION LINE CROSSED",
    "recommended_action": "emergency_cesarean_section"
  }
}
```

---

### 3. GET /datasets/{case_id}/analysis
Get clinical analysis summary

**Request**:
```bash
curl -X GET http://localhost:5001/api/who/datasets/PTH-002/analysis
```

**Response** (200):
```json
{
  "patient_id": "PTH-002",
  "patient_name": "Amara Mensah",
  "age": 32,
  "labour_duration_hours": 7,
  "analysis": {
    "alert_line_crossed": true,
    "action_line_crossed": false,
    "labour_status": "prolonged",
    "diagnosis": "Slow labour - crosses alert line (0.5 cm/hour)",
    "recommended_action": "augment_labour"
  }
}
```

---

### 4. GET /datasets/{case_id}/timeline
Get time-series data for charting

**Request**:
```bash
curl -X GET http://localhost:5001/api/who/datasets/PTH-001/timeline
```

**Response** (200):
```json
{
  "patient_id": "PTH-001",
  "patient_name": "Sarah Okoye",
  "labour_status": "normal",
  "alert_crossed": false,
  "action_crossed": false,
  "timeline": [
    {
      "time_hr": 0,
      "actual_dilation": 2.0,
      "fhr": 140,
      "pulse": 80,
      "temp": 37.0,
      "alert_line": 3,
      "action_line": 7
    },
    {
      "time_hr": 1,
      "actual_dilation": 2.5,
      "fhr": 138,
      "pulse": 82,
      "temp": 36.9,
      "alert_line": 3,
      "action_line": 7
    },
    ... (more timeline points)
  ],
  "total_hours": 9
}
```

---

### 5. GET /datasets/summary
Get all cases summary

**Request**:
```bash
curl -X GET http://localhost:5001/api/who/datasets/summary
```

**Response** (200):
```json
{
  "case_001_normal_labour": {
    "patient_id": "PTH-001",
    "name": "Sarah Okoye",
    "status": "normal",
    "alert_crossed": false,
    "action_crossed": false,
    "diagnosis": "Normal labour progression...",
    "records": 9
  },
  "case_002_slow_labour": {
    "patient_id": "PTH-002",
    "name": "Amara Mensah",
    "status": "prolonged",
    "alert_crossed": true,
    "action_crossed": false,
    "diagnosis": "Slow labour...",
    "records": 7
  },
  ... (3 more cases)
}
```

---

### 6. GET /validate
Validate dataset integrity

**Request**:
```bash
curl -X GET http://localhost:5001/api/who/validate
```

**Response** (200):
```json
{
  "cases": 5,
  "observations": 36,
  "issues": []
}
```

---

## FRONTEND INTEGRATION

### React Setup

#### 1. Import Dataset

```jsx
// src/data/who_datasets.js
export { WHO_PARTOGRAPH_DATASETS } from './WHO_PARTOGRAPH_DATASETS.json';

// OR fetch from API
export async function fetchWHODatasets() {
  const response = await fetch('/api/who/datasets');
  return response.json();
}
```

#### 2. Create Visual Component

```jsx
// src/components/PartographDisplay.jsx
import React, { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';

export default function PartographDisplay({ caseData }) {
  const chartData = useMemo(() => {
    if (!caseData?.labour_records) return null;

    const records = caseData.labour_records;
    const labels = records.map(r => `Hour ${r.time_hr}`);

    return {
      labels,
      datasets: [
        {
          label: 'Actual Dilation',
          data: records.map(r => r.cervical_dilation),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 3,
          fill: false
        },
        {
          label: 'Alert Line (1 cm/hr)',
          data: records.map(r => 3 + Math.max(0, r.time_hr - 3)),
          borderColor: '#f97316',
          borderDash: [5, 5],
          borderWidth: 2,
          fill: false,
          pointRadius: 0
        },
        {
          label: 'Action Line (C-section)',
          data: records.map(r => Math.min(7 + Math.max(0, r.time_hr - 3), 10)),
          borderColor: '#dc2626',
          borderDash: [10, 5],
          borderWidth: 2,
          fill: false,
          pointRadius: 0
        }
      ]
    };
  }, [caseData]);

  if (!chartData) return <div>Loading...</div>;

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">
        Partograph: {caseData.patient.name}
      </h2>
      
      <Line 
        data={chartData} 
        options={{
          responsive: true,
          scales: {
            y: { min: 0, max: 10, title: { display: true, text: 'Dilation (cm)' } },
            x: { title: { display: true, text: 'Time (hours)' } }
          }
        }}
      />

      <div className="mt-6 p-4 bg-blue-50 rounded">
        <h3 className="font-bold text-lg">Clinical Analysis</h3>
        <p className="mt-2">{caseData.analysis.diagnosis}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <strong>Alert Line Crossed:</strong>
            <span className={caseData.analysis.alert_line_crossed ? "text-red-600 ml-2" : "text-green-600 ml-2"}>
              {caseData.analysis.alert_line_crossed ? "YES ⚠️" : "NO ✓"}
            </span>
          </div>
          <div>
            <strong>Action Line Crossed:</strong>
            <span className={caseData.analysis.action_line_crossed ? "text-red-700 font-bold ml-2" : "text-green-600 ml-2"}>
              {caseData.analysis.action_line_crossed ? "YES 🚨 EMERGENCY" : "NO ✓"}
            </span>
          </div>
        </div>
        <p className="mt-3 text-sm">
          <strong>Recommended Action:</strong> {caseData.analysis.recommended_action}
        </p>
      </div>
    </div>
  );
}
```

#### 3. Use in Dashboard

```jsx
import PartographDisplay from './components/PartographDisplay';
import { useState } from 'react';

export default function Dashboard() {
  const [selectedCase, setSelectedCase] = useState('case_001_normal_labour');
  const [caseData, setCaseData] = useState(null);

  // Fetch from API
  useEffect(() => {
    fetch(`/api/who/datasets/${selectedCase}`)
      .then(r => r.json())
      .then(setCaseData);
  }, [selectedCase]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <label className="block text-sm font-bold mb-2">Select Case:</label>
        <select 
          value={selectedCase}
          onChange={e => setSelectedCase(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="case_001_normal_labour">Normal Labour</option>
          <option value="case_002_slow_labour">Slow Labour</option>
          <option value="case_003_obstructed_labour">Obstructed Labour</option>
          <option value="case_004_fetal_distress">Fetal Distress</option>
          <option value="case_005_maternal_infection">Maternal Infection</option>
        </select>
      </div>

      {caseData && <PartographDisplay caseData={caseData} />}
    </div>
  );
}
```

---

## DATABASE SETUP

### PostgreSQL

```bash
# 1. Create database
createdb partogram

# 2. Create tables
psql partogram < schema.sql

# 3. Load data
python3 backend/load_datasets.py
```

**Schema** (`schema.sql`):
```sql
CREATE TABLE patient (
  id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  age INTEGER,
  gravida INTEGER,
  para INTEGER,
  admission_time TIMESTAMP,
  membrane_status VARCHAR(20)
);

CREATE TABLE labour_record (
  id SERIAL PRIMARY KEY,
  patient_id VARCHAR(10) REFERENCES patient(id) ON DELETE CASCADE,
  time_hr INTEGER,
  cervical_dilation DECIMAL(3,1),
  fetal_heart_rate INTEGER,
  maternal_pulse INTEGER,
  temperature_c DECIMAL(3,1),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(patient_id, time_hr)
);

CREATE TABLE case_analysis (
  id SERIAL PRIMARY KEY,
  patient_id VARCHAR(10) REFERENCES patient(id) ON DELETE CASCADE,
  alert_line_crossed BOOLEAN,
  action_line_crossed BOOLEAN,
  labour_status VARCHAR(50),
  diagnosis TEXT,
  recommended_action VARCHAR(50)
);

-- Indexes for performance
CREATE INDEX idx_patient_id ON labour_record(patient_id);
CREATE INDEX idx_time_hr ON labour_record(time_hr);
CREATE INDEX idx_patient_analysis ON case_analysis(patient_id);
```

**Loader** (`backend/load_datasets.py`):
```python
import psycopg2
from WHO_PARTOGRAPH_DATASETS import WHO_PARTOGRAPH_DATASETS

def load_datasets():
    conn = psycopg2.connect(
        dbname="partogram",
        user="postgres",
        password="password",
        host="localhost"
    )
    cursor = conn.cursor()

    for case_key, case_data in WHO_PARTOGRAPH_DATASETS.items():
        if case_key == "metadata":
            continue

        patient = case_data["patient"]

        # Insert patient
        cursor.execute("""
            INSERT INTO patient (id, name, age, gravida, para, admission_time, membrane_status)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        """, (
            patient["patient_id"],
            patient["name"],
            patient["age"],
            patient["gravida"],
            patient["para"],
            patient["admission_time"],
            patient["membrane_status"]
        ))

        # Insert labour records
        for record in case_data["labour_records"]:
            cursor.execute("""
                INSERT INTO labour_record
                (patient_id, time_hr, cervical_dilation, fetal_heart_rate, maternal_pulse, temperature_c)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
            """, (
                patient["patient_id"],
                record["time_hr"],
                record["cervical_dilation"],
                record["fetal_heart_rate"],
                record["maternal_pulse"],
                record["temperature_c"]
            ))

        # Insert analysis
        analysis = case_data["analysis"]
        cursor.execute("""
            INSERT INTO case_analysis
            (patient_id, alert_line_crossed, action_line_crossed, labour_status, diagnosis, recommended_action)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
        """, (
            patient["patient_id"],
            analysis["alert_line_crossed"],
            analysis["action_line_crossed"],
            analysis["labour_status"],
            analysis["diagnosis"],
            analysis["recommended_action"]
        ))

    conn.commit()
    cursor.close()
    conn.close()
    print("✓ Data loaded successfully")

if __name__ == "__main__":
    load_datasets()
```

---

## TESTING

### Unit Tests

```python
# backend/tests/test_who_datasets.py
import unittest
from WHO_PARTOGRAPH_DATASETS import (
    WHO_PARTOGRAPH_DATASETS,
    get_case_by_id,
    validate_datasets
)

class TestWHODatasets(unittest.TestCase):
    
    def test_all_cases_present(self):
        cases = [k for k in WHO_PARTOGRAPH_DATASETS if k != "metadata"]
        self.assertEqual(len(cases), 5)
    
    def test_case_retrieval(self):
        case = get_case_by_id('PTH-001')
        self.assertIsNotNone(case)
        self.assertEqual(case['patient']['name'], 'Sarah Okoye')
    
    def test_alert_line_case_2(self):
        case = get_case_by_id('PTH-002')
        self.assertTrue(case['analysis']['alert_line_crossed'])
    
    def test_action_line_case_3(self):
        case = get_case_by_id('PTH-003')
        self.assertTrue(case['analysis']['action_line_crossed'])
    
    def test_data_validation(self):
        result = validate_datasets()
        self.assertEqual(len(result['issues']), 0)

if __name__ == '__main__':
    unittest.main()
```

**Run tests**:
```bash
python -m pytest backend/tests/test_who_datasets.py -v
```

---

## TROUBLESHOOTING

### Module Not Found

```python
# Add backend to path
import sys
sys.path.insert(0, '/path/to/backend')
from WHO_PARTOGRAPH_DATASETS import WHO_PARTOGRAPH_DATASETS
```

### API Endpoint 404

```bash
# Check Flask blueprint registered
curl http://localhost:5001/api/who/datasets  # Should return data

# Verify endpoint in app.py
app.register_blueprint(who_bp)  # Must be called
```

### Database Connection Failed

```bash
# Test PostgreSQL connection
psql -U postgres -d partogram -c "SELECT COUNT(*) FROM patient"

# Check .env credentials
cat .env | grep DATABASE_URL
```

### JSON Export Empty

```bash
# Regenerate
cd backend
python3 generate_json_export.py

# Verify file created
ls -la WHO_PARTOGRAPH_DATASETS.json
```

---

## PERFORMANCE OPTIMIZATION

### Caching (Flask)

```python
from flask_caching import Cache

cache = Cache(app, config={'CACHE_TYPE': 'simple'})

@app.route('/api/who/datasets/<case_id>')
@cache.cached(timeout=3600)  # Cache for 1 hour
def get_dataset(case_id):
    # ...
```

### Database Indexing

```sql
-- Already included in schema.sql
CREATE INDEX idx_patient_id ON labour_record(patient_id);
CREATE INDEX idx_time_hr ON labour_record(time_hr);
```

### Frontend Lazy Loading

```jsx
const PartographChart = lazy(() => import('./PartographChart'));

<Suspense fallback={<div>Loading chart...</div>}>
  <PartographChart caseData={caseData} />
</Suspense>
```

---

## DEPLOYMENT CHECKLIST

- [ ] WHO_PARTOGRAPH_DATASETS.py in backend/
- [ ] generate_json_export.py executed
- [ ] Flask endpoints registered in app.py
- [ ] Database schema created
- [ ] Data loaded via load_datasets.py
- [ ] React component created and imported
- [ ] API endpoints tested with curl
- [ ] Chart library installed (Chart.js)
- [ ] Environment variables configured
- [ ] Unit tests passing (100%)
- [ ] Production database connected
- [ ] Caching configured
- [ ] Monitoring enabled

---

**Status**: ✅ READY FOR IMPLEMENTATION  
**Last Updated**: April 13, 2026  
**Version**: 1.0
