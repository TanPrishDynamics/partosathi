"""
Patient Service — all business logic for patient management.
This layer has NO knowledge of HTTP requests or Flask internals.
"""

def fetch_patients(current_user):
    """
    Fetches all patients. Business rules applied here.
    Import actual DB models from the parent app.py or models.py.
    
    NOTE: During restructure migration, call the existing logic from app.py here.
    """
    # TODO: migrate logic from app.py get_patients() into this function
    raise NotImplementedError("Migrate from app.py get_patients()")


def create_patient(data: dict, current_user):
    """
    Validates and creates a new patient record.
    Raises ValueError for invalid input.
    """
    required = ["name", "age", "gravida", "parity", "gestational_age", "admission_time"]
    for field in required:
        if not data.get(field):
            raise ValueError(f"Missing required field: {field}")

    # TODO: migrate creation logic from app.py create_patient() into this function
    raise NotImplementedError("Migrate from app.py create_patient()")


def change_status(patient_id: str, status: str, current_user):
    """Changes a patient's status (Active/Completed)."""
    # TODO: migrate from app.py update_patient_status()
    raise NotImplementedError("Migrate from app.py update_patient_status()")
