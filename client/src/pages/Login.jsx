import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>{mode === 'login' ? 'Sign in' : 'Create your account'}</h1>
      <p className="lede">Book appointments and keep your records in one place.</p>
      <form className="auth" onSubmit={submit}>
        {mode === 'register' && (
          <label>Full name
            <input value={form.name} onChange={set('name')} required />
          </label>
        )}
        <label>Email
          <input type="email" value={form.email} onChange={set('email')} required />
        </label>
        <label>Password
          <input type="password" value={form.password} onChange={set('password')} minLength={8} required />
        </label>
        {mode === 'register' && <small>Use at least 8 characters.</small>}
        {error && <div className="note err" role="alert">{error}</div>}
        <button className="btn" disabled={busy}>
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        <button type="button" className="btn quiet" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
      </form>
    </>
  );
}