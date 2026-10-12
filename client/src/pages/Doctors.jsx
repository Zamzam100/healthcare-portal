import { useEffect, useState } from 'react';
import { api } from '../api';
import SlotStrip from '../components/SlotStrip';

export default function Doctors() {
  const [filters, setFilters] = useState({ specialization: '', location: '', maxFee: '', language: '', date: '' });
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
      setLoading(true);
      api(`/doctors${qs ? `?${qs}` : ''}`)
        .then((d) => { setDoctors(d.doctors); setError(''); })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 300); // wait for the user to stop typing
    return () => clearTimeout(timer);
  }, [filters]);

  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });

  return (
    <>
      <h1>Find a doctor</h1>
      <p className="lede">Search by specialty, fee or language, then pick a time that suits you.</p>

      <div className="filters">
        <label>Specialty
          <input value={filters.specialization} onChange={set('specialization')} placeholder="Cardiology" />
        </label>
        <label>Location
          <input value={filters.location} onChange={set('location')} placeholder="Downtown" />
        </label>
        <label>Maximum fee
          <input type="number" min="0" value={filters.maxFee} onChange={set('maxFee')} />
        </label>
        <label>Language
          <input value={filters.language} onChange={set('language')} placeholder="Swahili" />
        </label>
        <label>Available on
          <input type="date" value={filters.date} onChange={set('date')} />
        </label>
      </div>

      {error && <div className="note err" role="alert">{error}</div>}
      {!loading && doctors.length === 0 && !error && (
        <p className="empty">No doctors match these filters. Try removing one.</p>
      )}

      {doctors.map((d) => (
        <section className="doctor" key={d.id}>
          <div className="doctor-head">
            <div>
              <h2>{d.name}</h2>
              <div className="facts">
                <span>{d.specialization}</span>
                <span>{d.location}</span>
                <span>{d.experience_years} years of experience</span>
                <span>{d.languages.join(', ')}</span>
              </div>
            </div>
            <div className="fee">{Number(d.fee).toFixed(0)}</div>
          </div>
          <p>{d.bio}</p>
          {open === d.id ? (
            <SlotStrip doctorId={d.id} />
          ) : (
            <button className="btn quiet" onClick={() => setOpen(d.id)}>See open times</button>
          )}
        </section>
      ))}
    </>
  );
}