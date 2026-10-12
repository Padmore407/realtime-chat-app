import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from './AuthLayout';

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(form);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to continue your conversations."
      footer={
        <>
          New here? <Link to="/register">Create an account</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" name="email" value={form.email} onChange={update} autoComplete="email" required autoFocus />
        </label>
        <label className="field">
          <span>Password</span>
          <input className="input" type="password" name="password" value={form.password} onChange={update} autoComplete="current-password" required />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="button full" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </AuthLayout>
  );
}
