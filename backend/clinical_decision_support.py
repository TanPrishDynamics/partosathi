"""
Clinical Decision Support Engine for e-Partogram
Validates, normalizes, and analyzes labor monitoring data per WHO standards
"""

from datetime import datetime
from typing import Dict, List, Tuple, Optional, Any
import json
import re


class ClinicalDecisionSupport:
    """
    WHO-based clinical validation and decision support for labor management.
    
    Reference: WHO Labour Care Guide (2020), Friedman Labor Curve, FIGO Guidelines
    """
    
    # WHO Clinical Thresholds
    FHR_MIN = 110  # bpm - lower limit of normal
    FHR_MAX = 160  # bpm - upper limit of normal
    TEMP_THRESHOLD = 38.0  # °C - fever threshold
    BP_SYSTOLIC_THRESHOLD = 140  # mmHg - hypertension
    BP_DIASTOLIC_THRESHOLD = 90  # mmHg
    PULSE_THRESHOLD = 100  # bpm - tachycardia
    DILATION_RATE_MIN = 1.0  # cm/hr in active phase (from 4cm)
    ACTIVE_PHASE_START = 4  # cm cervical dilation
    
    def __init__(self):
        self.alerts = []
        self.normalized_data = {}
        self.validation_errors = []

    def parse_freetext_input(self, text: str) -> Dict[str, Any]:
        """
        Parse semi-structured text input from doctor.
        Extracts key-value pairs using regex.
        """
        data = {}
        
        # Time
        time_match = re.search(r'Time[:\s]+(\d+\.?\d*)\s*(hours?|hrs?)', text, re.IGNORECASE)
        if time_match:
            data['time_hours'] = float(time_match.group(1))
        
        # FHR
        fhr_match = re.search(r'FHR[:\s]+(\d+)\s*bpm', text, re.IGNORECASE)
        if fhr_match:
            data['fhr'] = int(fhr_match.group(1))
        
        # Cervical Dilation
        dil_match = re.search(r'[Cc]ervical\s+dilation[:\s]+(\d+\.?\d*)\s*cm', text, re.IGNORECASE)
        if dil_match:
            data['cervical_dilation'] = float(dil_match.group(1))
        
        # Contractions
        contra_match = re.search(r'[Cc]ontractions[:\s]+(\d+)\s+in\s+10\s+min[,\s]*lasting\s+(\d+)\s*sec', text, re.IGNORECASE)
        if contra_match:
            data['contractions_count'] = int(contra_match.group(1))
            data['contractions_duration'] = int(contra_match.group(2))
        
        # Head Descent / Station
        head_match = re.search(r'[Hh]ead\s+(?:descent|station)[:\s]+(\d)/5', text, re.IGNORECASE)
        if head_match:
            data['head_descent'] = f"{head_match.group(1)}/5"
        
        # Amniotic Fluid
        if re.search(r'meconium', text, re.IGNORECASE):
            data['amniotic_fluid'] = 'meconium'
        elif re.search(r'clear', text, re.IGNORECASE):
            data['amniotic_fluid'] = 'clear'
        elif re.search(r'blood', text, re.IGNORECASE):
            data['amniotic_fluid'] = 'blood'
        
        # Moulding
        mould_match = re.search(r'[Mm]oulding[:\s]+(\+{0,3}|0)', text)
        if mould_match:
            data['moulding'] = mould_match.group(1)
        
        # Pulse
        pulse_match = re.search(r'[Pp]ulse[:\s]+(\d+)\s*bpm', text, re.IGNORECASE)
        if pulse_match:
            data['pulse'] = int(pulse_match.group(1))
        
        # Blood Pressure
        bp_match = re.search(r'BP[:\s]+(\d+)/(\d+)\s*mmHg', text, re.IGNORECASE)
        if bp_match:
            data['bp'] = f"{bp_match.group(1)}/{bp_match.group(2)}"
        
        # Temperature
        temp_match = re.search(r'[Tt]emperature[:\s]+(\d+\.?\d*)\s*°?C', text, re.IGNORECASE)
        if temp_match:
            data['temperature'] = float(temp_match.group(1))
        
        # Urine Protein
        if re.search(r'urine.*protein\s+negative', text, re.IGNORECASE):
            data['urine_protein'] = 'negative'
        elif re.search(r'urine.*protein\s+\+', text, re.IGNORECASE):
            data['urine_protein'] = '+'
        
        # Urine Ketones
        if re.search(r'urine.*ketones\s+negative', text, re.IGNORECASE):
            data['urine_ketones'] = 'negative'
        elif re.search(r'urine.*ketones\s+\+', text, re.IGNORECASE):
            data['urine_ketones'] = '+'
        
        return data

    def validate_data(self, data: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """
        Validate input data for completeness and range validity.
        Returns: (is_valid, error_list)
        """
        errors = []
        required_fields = [
            'time_hours', 'fhr', 'cervical_dilation', 'contractions_count',
            'contractions_duration', 'head_descent', 'amniotic_fluid', 'moulding',
            'pulse', 'bp', 'temperature', 'urine_protein', 'urine_ketones'
        ]
        
        for field in required_fields:
            if field not in data:
                errors.append(f"Missing field: {field}")
        
        # Validate ranges
        if 'fhr' in data:
            if not (50 <= data['fhr'] <= 200):
                errors.append("FHR out of physiological range (50-200 bpm)")
        
        if 'cervical_dilation' in data:
            if not (0 <= data['cervical_dilation'] <= 10):
                errors.append("Cervical dilation out of range (0-10 cm)")
        
        if 'temperature' in data:
            if not (35 <= data['temperature'] <= 42):
                errors.append("Temperature out of range (35-42°C)")
        
        if 'pulse' in data:
            if not (40 <= data['pulse'] <= 200):
                errors.append("Pulse out of range (40-200 bpm)")
        
        if 'contractions_count' in data:
            if not (0 <= data['contractions_count'] <= 10):
                errors.append("Contractions out of range (0-10 per 10 min)")
        
        return len(errors) == 0, errors

    def normalize_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalize raw input to strict JSON format.
        """
        # Parse BP
        bp_parts = data.get('bp', '0/0').split('/')
        bp_systolic = int(bp_parts[0]) if len(bp_parts) > 0 else 0
        bp_diastolic = int(bp_parts[1]) if len(bp_parts) > 1 else 0
        
        normalized = {
            "timestamp": datetime.utcnow().isoformat(),
            "time_hours": data.get('time_hours'),
            "fetal": {
                "fhr": data.get('fhr'),
                "amniotic_fluid": data.get('amniotic_fluid', 'clear'),
                "moulding": data.get('moulding', '0')
            },
            "labor": {
                "cervical_dilation": data.get('cervical_dilation'),
                "head_descent": data.get('head_descent', '-5/5'),
                "contractions": {
                    "count": data.get('contractions_count'),
                    "duration_sec": data.get('contractions_duration')
                }
            },
            "maternal": {
                "pulse": data.get('pulse'),
                "bp": {
                    "systolic": bp_systolic,
                    "diastolic": bp_diastolic,
                    "formatted": f"{bp_systolic}/{bp_diastolic}"
                },
                "temperature": data.get('temperature'),
                "urine": {
                    "protein": data.get('urine_protein', 'negative'),
                    "ketones": data.get('urine_ketones', 'negative'),
                    "volume_ml": data.get('urine_volume')
                }
            }
        }
        
        return normalized

    def generate_alerts(self, normalized: Dict[str, Any], 
                       previous_dilation: Optional[float] = None,
                       time_diff_hours: Optional[float] = None) -> List[Dict[str, str]]:
        """
        Generate clinical alerts based on WHO thresholds.
        """
        alerts = []
        
        # ==== FETAL ALERTS ====
        fhr = normalized['fetal']['fhr']
        
        if fhr < self.FHR_MIN:
            alerts.append({
                "severity": "RED",
                "type": "fetal_distress",
                "message": f"CRITICAL: FHR {fhr} bpm below normal range (<110 bpm). Risk of fetal hypoxia.",
                "action": "Immediate fetal assessment; consider emergency intervention"
            })
        elif fhr > self.FHR_MAX:
            alerts.append({
                "severity": "RED",
                "type": "fetal_tachycardia",
                "message": f"CRITICAL: FHR {fhr} bpm above normal range (>160 bpm). Possible fetal distress or infection.",
                "action": "Immediate fetal assessment; monitor for maternal infection"
            })
        
        if normalized['fetal']['amniotic_fluid'] == 'meconium':
            alerts.append({
                "severity": "YELLOW",
                "type": "meconium_staining",
                "message": "WARNING: Meconium-stained amniotic fluid detected. Possible fetal compromise.",
                "action": "Increased monitoring; prepare for resuscitation"
            })
        
        if normalized['fetal']['moulding'] == '+++':
            alerts.append({
                "severity": "YELLOW",
                "type": "excessive_moulding",
                "message": "WARNING: Excessive moulding (+++). Possible cephalopelvic disproportion.",
                "action": "Monitor for arrest of labor; assess for obstruction"
            })
        
        # ==== MATERNAL ALERTS ====
        pulse = normalized['maternal']['pulse']
        if pulse > self.PULSE_THRESHOLD:
            alerts.append({
                "severity": "YELLOW",
                "type": "maternal_tachycardia",
                "message": f"WARNING: Maternal pulse {pulse} bpm (tachycardia). Monitor for dehydration/infection.",
                "action": "Assess hydration status; check temperature"
            })
        
        bp_sys = normalized['maternal']['bp']['systolic']
        bp_dia = normalized['maternal']['bp']['diastolic']
        if bp_sys >= self.BP_SYSTOLIC_THRESHOLD or bp_dia >= self.BP_DIASTOLIC_THRESHOLD:
            alerts.append({
                "severity": "YELLOW",
                "type": "hypertension",
                "message": f"WARNING: BP {bp_sys}/{bp_dia} mmHg (elevated). Risk of preeclampsia.",
                "action": "Check for proteinuria; monitor reflexes; consider intervention"
            })
        
        temp = normalized['maternal']['temperature']
        if temp > self.TEMP_THRESHOLD:
            alerts.append({
                "severity": "YELLOW",
                "type": "maternal_fever",
                "message": f"WARNING: Temperature {temp}°C (fever). Possible infection (chorioamnionitis).",
                "action": "Culture samples if indicated; consider antibiotics"
            })
        
        if normalized['maternal']['urine']['protein'] not in ['negative', None]:
            alerts.append({
                "severity": "YELLOW",
                "type": "proteinuria",
                "message": "WARNING: Proteinuria detected. Monitor BP and reflexes for preeclampsia.",
                "action": "Assess for hypertension and edema"
            })
        
        # ==== LABOR PROGRESS ALERTS ====
        dilation = normalized['labor']['cervical_dilation']
        
        # Check dilation rate if previous reading available
        if previous_dilation is not None and time_diff_hours is not None and time_diff_hours > 0:
            dilation_rate = (dilation - previous_dilation) / time_diff_hours
            
            # Only evaluate dilation rate in active phase (≥4 cm)
            if dilation >= self.ACTIVE_PHASE_START:
                if dilation_rate < self.DILATION_RATE_MIN:
                    alerts.append({
                        "severity": "YELLOW",
                        "type": "slow_dilation",
                        "message": f"WARNING: Cervical dilation rate {dilation_rate:.2f} cm/hr (slow). Below 1 cm/hr threshold.",
                        "action": "Monitor progress; assess for prolonged labor; consider oxytocin augmentation"
                    })
        
        # Check if crossing alert/action lines (simplified)
        if dilation >= self.ACTIVE_PHASE_START + 4 and dilation <= self.ACTIVE_PHASE_START + 6:
            alerts.append({
                "severity": "YELLOW",
                "type": "nearing_action_line",
                "message": "WARNING: Labor progression nearing WHO action line. Prepare for possible intervention.",
                "action": "Increase monitoring frequency; involve senior clinician"
            })
        
        if dilation > self.ACTIVE_PHASE_START + 6:
            alerts.append({
                "severity": "RED",
                "type": "action_line_crossed",
                "message": "CRITICAL: Labor has crossed WHO action line. Intervention likely needed.",
                "action": "Urgent senior obstetric review; prepare for cesarean/operative delivery"
            })
        
        # Contractions assessment
        contra_count = normalized['labor']['contractions']['count']
        if contra_count >= 5:
            alerts.append({
                "severity": "YELLOW",
                "type": "strong_contractions",
                "message": f"WARNING: Strong contractions ({contra_count}/10 min). Monitor for tetany.",
                "action": "Assess uterine tone; reduce oxytocin if applicable"
            })
        
        return alerts

    def determine_status(self, alerts: List[Dict[str, str]]) -> str:
        """
        Determine overall labor status from alerts.
        """
        if not alerts:
            return "normal"
        
        has_red = any(a['severity'] == 'RED' for a in alerts)
        if has_red:
            return "critical"
        
        has_yellow = any(a['severity'] == 'YELLOW' for a in alerts)
        if has_yellow:
            return "warning"
        
        return "normal"

    def process_observation(self, input_data: Dict[str, Any] | str,
                          previous_dilation: Optional[float] = None,
                          time_diff_hours: Optional[float] = None) -> Dict[str, Any]:
        """
        Main processing pipeline: Parse → Validate → Normalize → Alert
        
        Args:
            input_data: Dict (JSON) or str (freetext)
            previous_dilation: For dilation rate calculation
            time_diff_hours: Time since last observation
        
        Returns:
            Structured JSON output with alerts
        """
        # Parse input
        if isinstance(input_data, str):
            parsed = self.parse_freetext_input(input_data)
        else:
            parsed = input_data
        
        # Validate
        is_valid, errors = self.validate_data(parsed)
        if not is_valid:
            return {
                "success": False,
                "error": "validation_failed",
                "missing_fields": errors,
                "normalized_data": None,
                "alerts": [],
                "status": "error"
            }
        
        # Normalize
        normalized = self.normalize_data(parsed)
        
        # Generate alerts
        alerts = self.generate_alerts(normalized, previous_dilation, time_diff_hours)
        
        # Determine status
        status = self.determine_status(alerts)
        
        return {
            "success": True,
            "error": None,
            "normalized_data": normalized,
            "alerts": alerts,
            "status": status,
            "alert_count": len(alerts),
            "critical_alerts": sum(1 for a in alerts if a['severity'] == 'RED'),
            "warning_alerts": sum(1 for a in alerts if a['severity'] == 'YELLOW')
        }

    def prepare_for_plotting(self, normalized: Dict[str, Any]) -> Dict[str, Any]:
        """
        Prepare normalized data for partograph visualization.
        Returns format suitable for Chart.js plotting.
        """
        return {
            "point": {
                "x": normalized['time_hours'],
                "y_dilation": normalized['labor']['cervical_dilation'],
                "y_station": self._parse_station(normalized['labor']['head_descent']),
                "fhr": normalized['fetal']['fhr'],
                "contractions": normalized['labor']['contractions']['count']
            },
            "metadata": {
                "timestamp": normalized['timestamp'],
                "amniotic_fluid": normalized['fetal']['amniotic_fluid'],
                "moulding": normalized['fetal']['moulding'],
                "bp": normalized['maternal']['bp']['formatted'],
                "temperature": normalized['maternal']['temperature']
            }
        }

    @staticmethod
    def _parse_station(head_descent_str: str) -> float:
        """
        Convert head descent string (e.g., '3/5') to numeric station (-5 to +5).
        """
        try:
            parts = head_descent_str.split('/')
            descent_fifths = int(parts[0])
            # Convert 5/5 → 0 (engaged), 3/5 → +2 (lower), 0/5 → -5 (high)
            return -(5 - descent_fifths)
        except:
            return 0


# Singleton instance
cds = ClinicalDecisionSupport()


def process_labor_observation(input_data: Dict[str, Any] | str,
                             previous_dilation: Optional[float] = None,
                             time_diff_hours: Optional[float] = None) -> Dict[str, Any]:
    """
    Convenience function to process a single observation.
    
    Usage:
        result = process_labor_observation({
            'time_hours': 2,
            'fhr': 145,
            'cervical_dilation': 4,
            ...
        })
    """
    return cds.process_observation(input_data, previous_dilation, time_diff_hours)
