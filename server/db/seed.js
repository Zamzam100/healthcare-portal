const bcrypt = require('bcryptjs');
const pool = require('./pool');

const doctors = [
  { name: 'Dr. Amina Hassan', email: 'amina@example.com', specialization: 'Cardiology',
    location: 'Downtown', fee: 80, experience_years: 12, languages: ['English', 'Swahili'],
    bio: 'Heart health and preventive cardiology.' },
  { name: 'Dr. Brian Otieno', email: 'brian@example.com', specialization: 'Dermatology',
    location: 'Northside', fee: 50, experience_years: 6, languages: ['English'],
    bio: 'Skin conditions and cosmetic dermatology.' },
  { name: 'Dr. Grace Wanjiru', email: 'grace@example.com', specialization: 'Pediatrics',
    location: 'Lakeside', fee: 40, experience_years: 9, languages: ['English', 'Swahili', 'French'],
    bio: 'Child health and vaccinations.' },
];

async function upsertUser(name, email, hash, role) {
  const r = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [name, email, hash, role]
  );
  return r.rows[0].id;
}

async function seed() {
  // Dev-only passwords. Never use these in production.
  const doctorHash = await bcrypt.hash('Doctor1234', 10);
  const adminHash = await bcrypt.hash('Admin1234', 10);

  await upsertUser('Site Admin', 'admin@example.com', adminHash, 'admin');

  for (const d of doctors) {
    const id = await upsertUser(d.name, d.email, doctorHash, 'doctor');

    await pool.query(
      `INSERT INTO doctor_profiles
         (user_id, specialization, location, fee, experience_years, languages, bio)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (user_id) DO NOTHING`,
      [id, d.specialization, d.location, d.fee, d.experience_years, d.languages, d.bio]
    );

    for (let day = 1; day <= 7; day++) {
      for (const hour of [9, 10, 11, 14]) {
        const start = new Date();
        start.setDate(start.getDate() + day);
        start.setHours(hour, 0, 0, 0);
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        await pool.query(
          `INSERT INTO availability_slots (doctor_id, start_time, end_time)
           VALUES ($1, $2, $3)
           ON CONFLICT (doctor_id, start_time) DO NOTHING`,
          [id, start, end]
        );
      }
    }
  }

  console.log('Seed complete');
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});