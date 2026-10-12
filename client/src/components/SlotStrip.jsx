import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA'); // local YYYY-MM-DD
const dayLabel = (key) =>
  new Date(key + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const timeLabel = (iso) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export default function SlotStrip({ doctorId }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [slots, setSlots] = useState(null);
  const [day, setDay] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api(`/doctors/${doctorId}`)
      .then((d) => {
        setSlots(d.slots);
        if (d.slots[0]) setDay(dayKey(d.slots[0].start_time));
      })
      .catch((e) => setMsg({ error: e.message }));
  }, [doctorId]);

  const byDay = useMemo(() => {
    const map = {};
    (slots || []).forEach((s) => {
      const k = dayKey(s.start_time);
      (map[k] = map[k] || []).push(s);
    });
    return map;
  }, [slots]);

  async function book(slot) {
    if (!user) return navigate('/login');
    try {
      await api('/appointments', { method: 'POST', body: { slotId: slot.id } });
      setSlots(slots.filter((s) => s.id !== slot.id));
      setMsg({ ok: `Booked for ${dayLabel(dayKey(slot.start_time))} at ${timeLabel(slot.start_time)}.` });
    } catch (e) {
      setMsg({ error: e.message });
    }
  }

  if (!slots && !msg) return <p className="empty">Loading times…</p>;
  const days = Object.keys(byDay);

  return (
    <div>
      {days.length === 0 && !msg?.ok && <p className="empty">No open times right now.</p>}
      <div className="days">
        {days.map((k) => (
          <button key={k} className="day" aria-pressed={k === day} onClick={() => setDay(k)}>
            {dayLabel(k)}
            <small>{byDay[k].length} free</small>
          </button>
        ))}
      </div>
      <div className="times">
        {(byDay[day] || []).map((s) => (
          <button key={s.id} className="time" onClick={() => book(s)}>
            {timeLabel(s.start_time)}
          </button>
        ))}
      </div>
      {msg?.ok && <div className="note ok" role="status">{msg.ok}</div>}
      {msg?.error && <div className="note err" role="alert">{msg.error}</div>}
    </div>
  );
}