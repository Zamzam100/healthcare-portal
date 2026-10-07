-- USERS (patients, doctors, admins)
CREATE TABLE users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          VARCHAR(10) NOT NULL DEFAULT 'patient'
                CHECK (role IN ('patient', 'doctor', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- DOCTOR DETAILS (one row per doctor user)
CREATE TABLE doctor_profiles (
  user_id          BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  specialization   VARCHAR(100) NOT NULL,
  location         VARCHAR(100) NOT NULL,
  fee              NUMERIC(10,2) NOT NULL CHECK (fee >= 0),
  experience_years INT NOT NULL DEFAULT 0,
  languages        TEXT[] NOT NULL DEFAULT '{}',
  bio              TEXT
);

-- TIME SLOTS A DOCTOR OFFERS
CREATE TABLE availability_slots (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  doctor_id  BIGINT NOT NULL REFERENCES doctor_profiles(user_id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time   TIMESTAMPTZ NOT NULL,
  CHECK (end_time > start_time),
  UNIQUE (doctor_id, start_time)
);

-- APPOINTMENTS
CREATE TABLE appointments (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  patient_id BIGINT NOT NULL REFERENCES users(id),
  slot_id    BIGINT NOT NULL REFERENCES availability_slots(id),
  status     VARCHAR(10) NOT NULL DEFAULT 'scheduled'
             CHECK (status IN ('scheduled','confirmed','completed','cancelled')),
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- DOUBLE-BOOKING PROTECTION: a slot can have only one active appointment
CREATE UNIQUE INDEX one_active_booking_per_slot
  ON appointments (slot_id) WHERE status <> 'cancelled';

-- MEDICAL DOCUMENTS
CREATE TABLE documents (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url    TEXT NOT NULL,
  file_name   VARCHAR(255) NOT NULL,
  mime_type   VARCHAR(50) NOT NULL,
  ai_summary  JSONB,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CHAT MESSAGES
CREATE TABLE messages (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sender_id   BIGINT NOT NULL REFERENCES users(id),
  receiver_id BIGINT NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- INDEXES FOR COMMON SEARCHES
CREATE INDEX idx_doctor_specialization ON doctor_profiles (specialization);
CREATE INDEX idx_slots_doctor_time ON availability_slots (doctor_id, start_time);
CREATE INDEX idx_appointments_patient ON appointments (patient_id);
CREATE INDEX idx_messages_pair ON messages (sender_id, receiver_id, created_at);