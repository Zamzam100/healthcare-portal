const express = require('express');
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate); // every route below requires login

// Patient books a slot
router.post('/', authorize('patient'), async (req, res) => {
  const slotId = Number(req.body.slotId);
  if (!Number.isInteger(slotId)) {
    return res.status(400).json({ message: 'A valid slotId is required' });
  }

  try {
    const slot = await pool.query(
      'SELECT id FROM availability_slots WHERE id = $1 AND start_time > now()',
      [slotId]
    );
    if (!slot.rows[0]) {
      return res.status(404).json({ message: 'Slot not found or already in the past' });
    }

    const result = await pool.query(
      `INSERT INTO appointments (patient_id, slot_id, notes)
       VALUES ($1, $2, $3)
       RETURNING id, slot_id, status, notes, created_at`,
      [req.user.id, slotId, req.body.notes || null]
    );
    res.status(201).json({ appointment: result.rows[0] });
  } catch (err) {
    // The unique index from schema.sql rejects a second active booking on a slot
    if (err.code === '23505') {
      return res.status(409).json({ message: 'This slot has already been booked' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// My appointments: patients see their own, doctors see theirs
router.get('/mine', authorize('patient', 'doctor'), async (req, res) => {
  const column = req.user.role === 'patient' ? 'a.patient_id' : 's.doctor_id';
  try {
    const result = await pool.query(
      `SELECT a.id, a.status, a.notes, s.start_time, s.end_time,
              pu.name AS patient_name, du.name AS doctor_name, d.specialization
       FROM appointments a
       JOIN availability_slots s ON s.id = a.slot_id
       JOIN users pu ON pu.id = a.patient_id
       JOIN users du ON du.id = s.doctor_id
       JOIN doctor_profiles d ON d.user_id = s.doctor_id
       WHERE ${column} = $1
       ORDER BY s.start_time`,
      [req.user.id]
    );
    res.json({ appointments: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Cancel: only the patient who booked it or the doctor it's with
router.patch('/:id/cancel', authorize('patient', 'doctor'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE appointments a SET status = 'cancelled'
       FROM availability_slots s
       WHERE a.id = $1 AND s.id = a.slot_id
         AND a.status IN ('scheduled', 'confirmed')
         AND (a.patient_id = $2 OR s.doctor_id = $2)
       RETURNING a.id, a.status`,
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Appointment not found or cannot be cancelled' });
    }
    res.json({ appointment: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Doctor moves an appointment forward: scheduled -> confirmed -> completed
router.patch('/:id/status', authorize('doctor'), async (req, res) => {
  const requiredCurrent = { confirmed: 'scheduled', completed: 'confirmed' };
  const { status } = req.body;
  if (!requiredCurrent[status]) {
    return res.status(400).json({ message: "Status must be 'confirmed' or 'completed'" });
  }

  try {
    const result = await pool.query(
      `UPDATE appointments a SET status = $1
       FROM availability_slots s
       WHERE a.id = $2 AND s.id = a.slot_id
         AND s.doctor_id = $3 AND a.status = $4
       RETURNING a.id, a.status`,
      [status, req.params.id, req.user.id, requiredCurrent[status]]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Appointment not found or invalid status change' });
    }
    res.json({ appointment: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;