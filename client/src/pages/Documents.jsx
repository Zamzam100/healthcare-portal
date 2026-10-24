import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import Summary from '../components/Summary';

const fmt = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export default function Documents() {
  const { user, ready } = useAuth();
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [summarizing, setSummarizing] = useState(null);
  const fileInput = useRef(null);

  const load = useCallback(() => {
    api('/documents/mine')
      .then((d) => setDocs(d.documents))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (user?.role === 'patient') load();
  }, [user, load]);

  async function upload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    setBusy(true);
    setError('');
    try {
      await api('/documents', { method: 'POST', body: form });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function summarize(doc) {
    setSummarizing(doc.id);
    setError('');
    try {
      await api(`/documents/${doc.id}/summarize`, { method: 'POST' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSummarizing(null);
    }
  }

  // The file route needs the login token, so fetch it and open it as a blob
  async function view(doc) {
    const win = window.open('', '_blank');
    try {
      const res = await fetch(`/api/documents/${doc.id}/file`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) throw new Error('Could not open this document');
      const blob = await res.blob();
      win.location = URL.createObjectURL(blob);
    } catch (err) {
      if (win) win.close();
      setError(err.message);
    }
  }

  async function remove(doc) {
    if (!window.confirm(`Delete ${doc.file_name}?`)) return;
    try {
      await api(`/documents/${doc.id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'patient') return <p className="empty">Documents are uploaded by patients.</p>;

  return (
    <>
      <h1>Your documents</h1>
      <p className="lede">
        Lab results, prescriptions and reports. Only you and doctors you have booked with can open them.
      </p>

      <label className="upload">
        Upload a document
        <input ref={fileInput} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={upload} disabled={busy} />
        <small>PDF, JPG or PNG, up to 10 MB.</small>
      </label>
      <p className="consent">
        Summaries are written by an AI service. When you choose "Summarize with AI", the document is sent to it for processing.
      </p>

      {busy && <p className="empty">Uploading…</p>}
      {error && <div className="note err" role="alert">{error}</div>}
      {docs && docs.length === 0 && <p className="empty">No documents yet. Upload your first one above.</p>}

      {(docs || []).map((d) => (
        <section className="doctor" key={d.id}>
          <div className="doctor-head">
            <div>
              <h2>{d.file_name}</h2>
              <div className="facts"><span>Uploaded {fmt(d.uploaded_at)}</span></div>
            </div>
            <div className="actions">
              <button className="btn" onClick={() => summarize(d)} disabled={summarizing === d.id}>
                {summarizing === d.id ? 'Summarizing…' : d.ai_summary ? 'Summarize again' : 'Summarize with AI'}
              </button>
              <button className="btn quiet" onClick={() => view(d)}>View</button>
              <button className="btn quiet" onClick={() => remove(d)}>Delete</button>
            </div>
          </div>
          <Summary s={d.ai_summary} />
        </section>
      ))}
    </>
  );
}