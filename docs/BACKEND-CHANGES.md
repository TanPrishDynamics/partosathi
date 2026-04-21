# Backend Changes - app.py Modifications

**File**: `backend/app.py`  
**Date Modified**: April 13, 2026  

---

## Summary

Added two new Clinical Decision Support API endpoints for labor observation analysis using WHO standards.

### Changes Made

**1. Import Added (Line 21)**
```python
from clinical_decision_support import process_labor_observation
```

**2. New Endpoint: `/api/cds/analyze-observation` (POST)**
- Analyzes a single labor observation
- Input: patient_id + observation data (JSON or freetext)
- Output: Normalized data + clinical alerts + plot-ready format
- Authentication: Required (JWT)

**3. New Endpoint: `/api/cds/batch-analyze` (POST)**
- Analyzes multiple observations at once
- Useful for historical data import
- Calculates dilation rates across time series
- Authentication: Required (JWT)

---

## Request/Response Examples

**Single Observation**
```bash
curl -X POST http://localhost:5001/api/cds/analyze-observation \
  -H "Authorization: Bearer TOKEN" \
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

**Response**
```json
{
  "success": true,
  "patient_id": "PTH-001",
  "status": "normal",
  "alerts": [],
  "normalized_data": { /* complete JSON */ },
  "plot_ready": {
    "x": 2,
    "y_dilation": 4,
    "fhr": 145,
    "contractions": 3
  }
}
```

---

## Integration Points

### Database Models Used
- `Patient`: Validation and context
- `Observation`: Previous dilation retrieval for rate calculation

### CDS Module
Calls: `process_labor_observation(data, previous_dilation, time_diff_hours)`

Returns:
- Normalized observation JSON
- Array of alerts with Type, Severity, Message, Action
- Status: normal/warning/critical
- Plot-ready data for charting

---

## WHO Clinical Thresholds Implemented

| Parameter | Alert Level | Threshold |
|-----------|-------------|-----------|
| FHR | RED | <110 or >160 bpm |
| BP | YELLOW | ≥140/90 mmHg |
| Temperature | YELLOW | >38°C |
| Maternal Pulse | YELLOW | >100 bpm |
| Proteinuria | YELLOW | Present |
| Meconium | YELLOW | Stained |
| Moulling | YELLOW | +++ |
| Dilation Rate | YELLOW | <1 cm/hr |

---

## Testing

See **CDS-TEST-CASES.md** for 13 comprehensive test scenarios covering:
- Normal labor
- Fetal distress (low/high FHR)
- Maternal complications
- Multiple alerts
- Error handling

---

## Frontend Integration Suggestion

Update `ObservationForm.jsx`:
1. Send data to `/api/cds/analyze-observation` before submission
2. Display validation errors
3. Show alert preview
4. Save to database via `/api/observation`
5. Update charts with plot_ready data

---

**Version:** 1.0  
**Last Updated:** April 13, 2026  
**Status:** Ready for Testing
