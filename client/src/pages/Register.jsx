import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from './AuthLayout';

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await register({ username: form.username, email: form.email, password: form.password });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Chat with friends in real time."
      footer={
        <>
          Already have an account? <Link to="/login">Log in</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Username</span>
          <input
            className="input"
            name="username"
            value={form.username}
            onChange={update}
            autoComplete="username"
            minLength={3}
            maxLength={30}
            pattern="[a-zA-Z0-9_.\-]+"
            title="Letters, numbers, _ . and -"
            required
            autoFocus
          />
        </label>
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" name="email" value={form.email} onChange={update} autoComplete="email" required />
        </label>
        <label className="field">
          <span>Password</span>
          <input className="input" type="password" name="password" value={form.password} onChange={update} autoComplete="new-password" minLength={6} required />
        </label>
        <label className="field">
          <span>Confirm password</span>
          <input className="input" type="password" name="confirm" value={form.confirm} onChange={update} autoComplete="new-password" minLength={6} required />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="button full" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
}
