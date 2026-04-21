# CDS Test Cases

**13 Pre-Built Test Scenarios for Clinical Decision Support Validation**

---

## Test Case 1: Normal Labor
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
**Expected**: status = "normal", alerts = []

---

## Test Case 2: Fetal Distress (Low FHR)
```json
{
  "time_hours": 3,
  "fhr": 95,
  "cervical_dilation": 5,
  "contractions_count": 3,
  "contractions_duration": 40,
  "head_descent": "2/5",
  "amniotic_fluid": "clear",
  "moulling": "+",
  "pulse": 85,
  "bp": "122/82",
  "temperature": 37,
  "urine_protein": "negative",
  "urine_ketones": "negative"
}
```
**Expected**: status = "critical", alerts = [RED: fetal_distress]

---

## Test Case 3: Fetal Tachycardia + Fever
```json
{
  "time_hours": 2.5,
  "fhr": 175,
  "cervical_dilation": 4.5,
  "contractions_count": 3,
  "contractions_duration": 40,
  "head_descent": "3/5",
  "amniotic_fluid": "clear",
  "moulling": "+",
  "pulse": 88,
  "bp": "125/85",
  "temperature": 38.5,
  "urine_protein": "negative",
  "urine_ketones": "negative"
}
```
**Expected**: status = "critical", alerts = [RED: fetal_tachycardia, YELLOW: fever]

---

## Test Case 4: Meconium Staining
```json
{
  "time_hours": 3,
  "fhr": 140,
  "cervical_dilation": 5,
  "contractions_count": 4,
  "contractions_duration": 45,
  "head_descent": "2/5",
  "amniotic_fluid": "meconium",
  "moulling": "+",
  "pulse": 82,
  "bp": "118/78",
  "temperature": 37,
  "urine_protein": "negative",
  "urine_ketones": "negative"
}
```
**Expected**: status = "warning", alerts = [YELLOW: meconium_staining]

---

## Test Case 5: Maternal Hypertension
```json
{
  "time_hours": 2,
  "fhr": 138,
  "cervical_dilation": 4,
  "contractions_count": 3,
  "contractions_duration": 40,
  "head_descent": "3/5",
  "amniotic_fluid": "clear",
  "moulling": "+",
  "pulse": 85,
  "bp": "145/92",
  "temperature": 37,
  "urine_protein": "negative",
  "urine_ketones": "negative"
}
```
**Expected**: status = "warning", alerts = [YELLOW: hypertension]

---

## Test Case 6: Maternal Fever
```json
{
  "time_hours": 3.5,
  "fhr": 140,
  "cervical_dilation": 5,
  "contractions_count": 3,
  "contractions_duration": 40,
  "head_descent": "2/5",
  "amniotic_fluid": "clear",
  "moulling": "++",
  "pulse": 90,
  "bp": "120/80",
  "temperature": 38.3,
  "urine_protein": "negative",
  "urine_ketones": "negative"
}
```
**Expected**: status = "warning", alerts = [YELLOW: fever]

---

## Test Case 7: Maternal Tachycardia
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
  "pulse": 105,
  "bp": "120/80",
  "temperature": 37,
  "urine_protein": "negative",
  "urine_ketones": "negative"
}
```
**Expected**: status = "warning", alerts = [YELLOW: maternal_tachycardia]

---

## Test Case 8: Slow Labor (Requires 2 observations)
**Obs 1** (time 0): dilation = 4 cm  
**Obs 2** (time 4): dilation = 4.5 cm  
**Rate** = 0.125 cm/hr (SLOW!)

**Expected**: status = "warning", alerts = [YELLOW: slow_dilation]

---

## Test Case 9: Excessive Moulling
```json
{
  "time_hours": 3,
  "fhr": 140,
  "cervical_dilation": 5,
  "contractions_count": 3,
  "contractions_duration": 40,
  "head_descent": "1/5",
  "amniotic_fluid": "clear",
  "moulling": "+++",
  "pulse": 84,
  "bp": "120/80",
  "temperature": 37,
  "urine_protein": "negative",
  "urine_ketones": "negative"
}
```
**Expected**: status = "warning", alerts = [YELLOW: excessive_moulling]

---

## Test Case 10: Proteinuria
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
  "pulse": 85,
  "bp": "130/85",
  "temperature": 37,
  "urine_protein": "+",
  "urine_ketones": "negative"
}
```
**Expected**: status = "warning", alerts = [YELLOW: proteinuria]

---

## Test Case 11: Multiple Complications (Medical Emergency)
```json
{
  "time_hours": 4,
  "fhr": 105,
  "cervical_dilation": 6,
  "contractions_count": 5,
  "contractions_duration": 50,
  "head_descent": "1/5",
  "amniotic_fluid": "meconium",
  "moulling": "+++",
  "pulse": 102,
  "bp": "148/95",
  "temperature": 38.5,
  "urine_protein": "+",
  "urine_ketones": "negative"
}
```
**Expected**: status = "critical", alerts = [1 RED + 6 YELLOW]

---

## Test Case 12: Freetext Parsing
```json
{
  "data": "Time: 2.5 hours\nFHR: 142 bpm\nDilation: 4.2 cm\nContractions: 3 in 10 min, lasting 38 sec\nHead descent: 3/5\nFluid: clear\nMoulling: +\nPulse: 79\nBP: 119/79\nTemp: 36.9°C\nUrine: protein negative, ketones negative"
}
```
**Expected**: status = "normal", alerts = [], properly parsed JSON

---

## Test Case 13: Missing Required Field (Error)
```json
{
  "time_hours": 2,
  "fhr": 140,
  "cervical_dilation": 4,
  "contractions_count": 3
  // Missing: head_descent, amniotic_fluid, etc.
}
```
**Expected**: success = false, error = "validation_failed"

---

## How to Run Tests

### cURL
```bash
curl -X POST http://localhost:5001/api/cds/analyze-observation \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d @test_case_1.json
```

### Python
```python
import requests

response = requests.post(
    "http://localhost:5001/api/cds/analyze-observation",
    headers={"Authorization": f"Bearer {token}"},
    json={"patient_id": "PTH-001", "data": test_data}
)
print(response.json())
```

### Postman
- Import test cases as requests
- Set environment variable for TOKEN
- Run collection

---

## Validation Checklist

For each test:
- [ ] Response contains `success` field
- [ ] Response contains `status` (normal/warning/critical)
- [ ] Response contains `alerts` array
- [ ] Severity matches expected (RED/YELLOW)
- [ ] HTTP status correct (200/400)
- [ ] `plot_ready` contains chart data

---

**Test Suite Version:** 1.0  
**Last Updated:** April 13, 2026  
**Status:** Ready for QA Testing
