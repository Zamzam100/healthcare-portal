import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import Doctors from './pages/Doctors';
import Login from './pages/Login';
import Appointments from './pages/Appointments';
import Documents from './pages/Documents';

function Header() {
  const { user, logout } = useAuth();
  return (
    <header className="top">
      <NavLink to="/" className="brand">Carebook</NavLink>
      <nav>
        {user ? (
  <>
    <NavLink to="/appointments">{user.role === 'doctor' ? 'Schedule' : 'My appointments'}</NavLink>
    {user.role === 'patient' && <NavLink to="/documents">Documents</NavLink>}
    <span>{user.name}</span>
    <button className="btn quiet" onClick={logout}>Sign out</button>
  </>
) : (
  <NavLink to="/login">Sign in</NavLink>
)}
      </nav>
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<Doctors />} />
            <Route path="/login" element={<Login />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/documents" element={<Documents />} />
          </Routes>
        </main>
      </AuthProvider>
    </BrowserRouter>
  );
}