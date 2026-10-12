import { useEffect, useState } from 'react';
import { api } from '../services/api';
import Avatar from './Avatar';
import { CheckIcon } from './Icons';

/** Search users and select several of them (used for creating groups and adding members). */
export default function UserPicker({ selected, onChange, excludeIds = [] }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .searchUsers(query.trim())
        .then((users) => !cancelled && setResults(users))
        .catch((err) => !cancelled && setError(err.message));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const isSelected = (user) => selected.some((u) => u._id === user._id);
  const toggle = (user) => onChange(isSelected(user) ? selected.filter((u) => u._id !== user._id) : [...selected, user]);
  const visible = results.filter((u) => !excludeIds.includes(u._id));

  return (
    <div className="user-picker">
      {selected.length > 0 && (
        <div className="chips">
          {selected.map((user) => (
            <button type="button" key={user._id} className="chip" onClick={() => toggle(user)}>
              {user.username} ×
            </button>
          ))}
        </div>
      )}
      <input
        className="input"
        placeholder="Search people by username"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search people"
      />
      {error && <p className="form-error">{error}</p>}
      <ul className="picker-list">
        {visible.map((user) => (
          <li key={user._id}>
            <button
              type="button"
              className={`picker-item ${isSelected(user) ? 'selected' : ''}`}
              onClick={() => toggle(user)}
              aria-pressed={isSelected(user)}
            >
              <Avatar name={user.username} id={user._id} online={user.online} size={36} />
              <span className="picker-name">{user.username}</span>
              <span className="picker-check">{isSelected(user) && <CheckIcon size={16} />}</span>
            </button>
          </li>
        ))}
        {visible.length === 0 && <li className="muted picker-empty">No users found</li>}
      </ul>
    </div>
  );
}
