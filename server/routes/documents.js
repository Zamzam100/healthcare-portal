const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + (ALLOWED[file.mimetype] || '')),
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED[file.mimetype]) return cb(new Error('Only PDF, JPG and PNG files are allowed'));
    cb(null, true);
  },
});

// Check the file's real first bytes, not just what the browser claims
function looksLikeType(filePath, mime) {
  const buf = Buffer.alloc(8);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buf, 0, 8, 0);
  fs.closeSync(fd);
  if (mime === 'application/pdf') return buf.subarray(0, 4).toString() === '%PDF';
  if (mime === 'image/png') return buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (mime === 'image/jpeg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  return false;
}

// Owner, or a doctor who has a non-cancelled appointment with the owner
async function canAccess(user, doc) {
  if (String(doc.owner_id) === String(user.id)) return true;
  if (user.role !== 'doctor') return false;
  const r = await pool.query(
    `SELECT 1 FROM appointments a
     JOIN availability_slots s ON s.id = a.slot_id
     WHERE a.patient_id = $1 AND s.doctor_id = $2 AND a.status <> 'cancelled'
     LIMIT 1`,
    [doc.owner_id, user.id]
  );
  return r.rowCount > 0;
}

// Upload (patients only)
router.post('/', authorize('patient'), (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 10 MB' : err.message;
      return res.status(400).json({ message: msg });
    }
    if (!req.file) return res.status(400).json({ message: 'Choose a file to upload' });

    if (!looksLikeType(req.file.path, req.file.mimetype)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: 'The file contents do not match its type' });
    }

    try {
      const r = await pool.query(
        `INSERT INTO documents (owner_id, file_url, file_name, mime_type)
         VALUES ($1, $2, $3, $4)
         RETURNING id, file_name, mime_type, ai_summary, uploaded_at`,
        [req.user.id, req.file.filename, req.file.originalname.slice(0, 255), req.file.mimetype]
      );
      res.status(201).json({ document: r.rows[0] });
    } catch (e) {
      fs.unlink(req.file.path, () => {});
      console.error(e);
      res.status(500).json({ message: 'Server error' });
    }
  });
});

// My documents
router.get('/mine', authorize('patient'), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, file_name, mime_type, ai_summary, uploaded_at
       FROM documents WHERE owner_id = $1 ORDER BY uploaded_at DESC`,
      [req.user.id]
    );
    res.json({ documents: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

async function loadDocument(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return null;
  const r = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);
  const doc = r.rows[0];
  return doc && (await canAccess(req.user, doc)) ? doc : null;
}

// Download or view a file
router.get('/:id/file', async (req, res) => {
  try {
    const doc = await loadDocument(req);
    // Same answer whether it doesn't exist or isn't yours
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    res.type(doc.mime_type);
    res.sendFile(path.join(UPLOAD_DIR, doc.file_url));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete (owner only)
router.delete('/:id', authorize('patient'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(404).json({ message: 'Document not found' });
    const r = await pool.query(
      'DELETE FROM documents WHERE id = $1 AND owner_id = $2 RETURNING file_url',
      [id, req.user.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'Document not found' });
    fs.unlink(path.join(UPLOAD_DIR, r.rows[0].file_url), () => {});
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});
// Summarize one of my documents with the AI service
router.post('/:id/summarize', authorize('patient'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(404).json({ message: 'Document not found' });

    const r = await pool.query('SELECT * FROM documents WHERE id = $1 AND owner_id = $2', [
      id,
      req.user.id,
    ]);
    const doc = r.rows[0];
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    const bytes = await fs.promises.readFile(path.join(UPLOAD_DIR, doc.file_url));
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: doc.mime_type }), doc.file_name);

    const ai = await fetch(`${process.env.AI_SERVICE_URL}/summarize`, {
      method: 'POST',
      headers: { 'x-service-key': process.env.AI_SERVICE_KEY },
      body: form,
      signal: AbortSignal.timeout(90_000),
    });
    if (!ai.ok) {
      return res.status(502).json({ message: 'The summary service could not process this document. Please try again.' });
    }

    const summary = await ai.json();
    await pool.query('UPDATE documents SET ai_summary = $1 WHERE id = $2', [JSON.stringify(summary), id]);
    res.json({ summary });
  } catch (e) {
    console.error('Summarize failed:', e.message); // never log document contents
    res.status(502).json({ message: 'The summary service is unavailable right now.' });
  }
});
module.exports = router;