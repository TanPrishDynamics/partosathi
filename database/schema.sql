-- ============================================================
-- e-Partogram MySQL Schema
-- Migrated from SQLite — production ready
-- Generated: 2026-04-20
-- ============================================================

CREATE DATABASE IF NOT EXISTS partogram
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE partogram;

-- Disable FK checks during import
SET FOREIGN_KEY_CHECKS = 0;

-- ── 1. admins ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id            INT           NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120)  NOT NULL,
  email         VARCHAR(120)  NOT NULL,
  password_hash VARCHAR(256)  NOT NULL,
  company       VARCHAR(120)  DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admins_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 2. doctors ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctors (
  id             INT           NOT NULL AUTO_INCREMENT,
  name           VARCHAR(120)  NOT NULL,
  email          VARCHAR(120)  NOT NULL,
  password_hash  VARCHAR(256)  NOT NULL,
  license_number VARCHAR(50)   DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_doctors_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 3. patients ────────────────────────────────────────────
-- NOTE: patient_id is the business key (e.g. "PTH-001"), id is the DB key
CREATE TABLE IF NOT EXISTS patients (
  id                    INT           NOT NULL AUTO_INCREMENT,
  patient_id            VARCHAR(20)   NOT NULL,
  name                  VARCHAR(120)  NOT NULL,
  age                   INT           NOT NULL,
  gravida               INT           DEFAULT NULL,
  parity                INT           DEFAULT NULL,
  gestational_age       INT           NOT NULL,
  admission_time        DATETIME      DEFAULT NULL,
  membrane_rupture_time DATETIME      DEFAULT NULL,
  status                VARCHAR(20)   DEFAULT 'Active',
  doctor_id             INT           DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_patients_patient_id (patient_id),
  KEY ix_patients_doctor_id (doctor_id),
  CONSTRAINT fk_patients_doctor FOREIGN KEY (doctor_id)
    REFERENCES doctors (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 4. observations ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS observations (
  id                   INT           NOT NULL AUTO_INCREMENT,
  patient_id           INT           NOT NULL,
  timestamp            DATETIME      DEFAULT NULL,
  cervical_dilation    FLOAT         DEFAULT NULL,
  head_station         FLOAT         DEFAULT NULL,
  fetal_heart_rate     INT           DEFAULT NULL,
  amniotic_fluid       VARCHAR(30)   DEFAULT NULL,
  moulding             VARCHAR(5)    DEFAULT NULL,
  contraction_freq     FLOAT         DEFAULT NULL,
  contraction_duration INT           DEFAULT NULL,
  maternal_pulse       INT           DEFAULT NULL,
  bp_systolic          INT           DEFAULT NULL,
  bp_diastolic         INT           DEFAULT NULL,
  temperature          FLOAT         DEFAULT NULL,
  urine_protein        VARCHAR(10)   DEFAULT NULL,
  urine_ketones        VARCHAR(10)   DEFAULT NULL,
  urine_volume         INT           DEFAULT NULL,
  oxytocin_units       FLOAT         DEFAULT NULL,
  oxytocin_drops       INT           DEFAULT NULL,
  PRIMARY KEY (id),
  KEY ix_observations_patient_id (patient_id),
  KEY ix_observations_timestamp (timestamp),
  CONSTRAINT fk_observations_patient FOREIGN KEY (patient_id)
    REFERENCES patients (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 5. alerts ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id             INT           NOT NULL AUTO_INCREMENT,
  patient_id     INT           NOT NULL,
  timestamp      DATETIME      DEFAULT NULL,
  alert_type     VARCHAR(60)   NOT NULL,
  severity       VARCHAR(10)   NOT NULL,
  message        TEXT          NOT NULL,           -- Upgraded: SQLite VARCHAR(300) → TEXT (handles emoji)
  observation_id INT           DEFAULT NULL,
  acknowledged   TINYINT(1)    NOT NULL DEFAULT 0, -- SQLite BOOLEAN → MySQL TINYINT(1)
  PRIMARY KEY (id),
  KEY ix_alerts_patient_id (patient_id),
  KEY ix_alerts_severity (severity),
  KEY ix_alerts_acknowledged (acknowledged),
  CONSTRAINT fk_alerts_patient FOREIGN KEY (patient_id)
    REFERENCES patients (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_alerts_observation FOREIGN KEY (observation_id)
    REFERENCES observations (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-enable FK checks
SET FOREIGN_KEY_CHECKS = 1;
