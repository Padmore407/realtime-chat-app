import { ChatIcon } from '../components/Icons';

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo">
            <ChatIcon size={22} />
          </span>
          Chatter
        </div>
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
        {children}
        <p className="auth-footer">{footer}</p>
      </div>
    </main>
  );
}
