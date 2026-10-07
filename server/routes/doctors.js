const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

// GET /api/doctors?specialization=cardio&location=down&maxFee=100
//                 &minExperience=5&language=Swahili&date=2026-10-10
router.get('/', async (req, res) => {
  const { specialization, location, maxFee, minExperience, language, date } = req.query;

  const conditions = ["u.role = 'doctor'"];
  const params = [];

  if (specialization) {
    params.push(`%${specialization}%`);
    conditions.push(`d.specialization ILIKE $${params.length}`);
  }
  if (location) {
    params.push(`%${location}%`);
    conditions.push(`d.location ILIKE $${params.length}`);
  }
  if (maxFee) {
    params.push(Number(maxFee));
    conditions.push(`d.fee <= $${params.length}`);
  }
  if (minExperience) {
    params.push(Number(minExperience));
    conditions.push(`d.experience_years >= $${params.length}`);
  }
  if (language) {
    params.push(language);
    conditions.push(`$${params.length} ILIKE ANY (d.languages)`);
  }
  if (date) {
    // Only doctors with at least one FREE slot on that date
    params.push(date);
    conditions.push(`EXISTS (
      SELECT 1 FROM availability_slots s
      WHERE s.doctor_id = u.id
        AND s.start_time::date = $${params.length}::date
        AND s.start_time > now()
        AND NOT EXISTS (
          SELECT 1 FROM appointments a
          WHERE a.slot_id = s.id AND a.status <> 'cancelled'
        )
    )`);
  }

  try {
    const result = await pool.query(
      `SELECT u.id, u.name, d.specialization, d.location, d.fee,
              d.experience_years, d.languages, d.bio
       FROM users u
       JOIN doctor_profiles d ON d.user_id = u.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY u.name`,
      params
    );
    res.json({ doctors: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/doctors/:id  -> doctor details plus upcoming free slots
router.get('/:id', async (req, res) => {
  try {
    const doc = await pool.query(
      `SELECT u.id, u.name, d.specialization, d.location, d.fee,
              d.experience_years, d.languages, d.bio
       FROM users u
       JOIN doctor_profiles d ON d.user_id = u.id
       WHERE u.id = $1 AND u.role = 'doctor'`,
      [req.params.id]
    );
    if (!doc.rows[0]) return res.status(404).json({ message: 'Doctor not found' });

    const slots = await pool.query(
      `SELECT s.id, s.start_time, s.end_time
       FROM availability_slots s
       WHERE s.doctor_id = $1
         AND s.start_time > now()
         AND NOT EXISTS (
           SELECT 1 FROM appointments a
           WHERE a.slot_id = s.id AND a.status <> 'cancelled'
         )
       ORDER BY s.start_time`,
      [req.params.id]
    );

    res.json({ doctor: doc.rows[0], slots: slots.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;