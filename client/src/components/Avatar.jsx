import { UsersIcon } from './Icons';

const COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#db2777', '#7c3aed', '#2563eb', '#dc2626'];

function colorFor(seed = '') {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

/** Initials avatar. `online` true/false shows the presence dot; undefined hides it. */
export default function Avatar({ name = '', id = '', isGroup = false, online, size = 44 }) {
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, background: colorFor(id || name), fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {isGroup ? <UsersIcon size={size * 0.45} /> : name.slice(0, 2).toUpperCase()}
      {online !== undefined && <span className={`status-dot ${online ? 'online' : 'offline'}`} />}
    </div>
  );
}
