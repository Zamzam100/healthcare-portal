import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

const when = (iso) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit',
  });

const OPEN = ['scheduled', 'confirmed'];

export default function Appointments() {
  const { user, ready } = useAuth();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api('/appointments/mine')
      .then((d) => setItems(d.appointments))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (user && user.role !== 'admin') load();
  }, [user, load]);

  async function act(path, body) {
    try {
      await api(path, { method: 'PATCH', body });
      setError('');
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') {
    return <p className="empty">Admin accounts don't have appointments.</p>;
  }

  const isDoctor = user.role === 'doctor';
  const upcoming = (items || []).filter((a) => OPEN.includes(a.status));
  const past = (items || []).filter((a) => !OPEN.includes(a.status)).reverse();

  function row(a) {
    return (
      <section className="doctor" key={a.id}>
        <div className="doctor-head">
          <div>
            <h2>{when(a.start_time)}</h2>
            <div className="facts">
              {isDoctor ? (
                <span>Patient: {a.patient_name}</span>
              ) : (
                <>
                  <span>{a.doctor_name}</span>
                  <span>{a.specialization}</span>
                </>
              )}
              {a.notes && <span>Note: {a.notes}</span>}
            </div>
          </div>
          <span className={`status status-${a.status}`}>{a.status}</span>
        </div>
        {OPEN.includes(a.status) && (
          <div className="actions">
            {isDoctor && a.status === 'scheduled' && (
              <button className="btn" onClick={() => act(`/appointments/${a.id}/status`, { status: 'confirmed' })}>
                Confirm
              </button>
            )}
            {isDoctor && a.status === 'confirmed' && (
              <button className="btn" onClick={() => act(`/appointments/${a.id}/status`, { status: 'completed' })}>
                Mark completed
              </button>
            )}
            <button className="btn quiet" onClick={() => act(`/appointments/${a.id}/cancel`)}>
              Cancel appointment
            </button>
          </div>
        )}
      </section>
    );
  }

  return (
    <>
      <h1>{isDoctor ? 'Your schedule' : 'Your appointments'}</h1>
      <p className="lede">
        {isDoctor ? 'Confirm visits and mark them completed.' : 'Upcoming visits and your history.'}
      </p>
      {error && <div className="note err" role="alert">{error}</div>}
      {!items && !error && <p className="empty">Loading…</p>}
      {items && upcoming.length === 0 && <p className="empty">Nothing coming up.</p>}
      {upcoming.map(row)}
      {past.length > 0 && <h2 className="history">History</h2>}
      {past.map(row)}
    </>
  );
}