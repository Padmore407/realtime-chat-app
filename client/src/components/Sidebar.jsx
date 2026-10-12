import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useNotifications } from '../context/NotificationContext';
import { api } from '../services/api';
import Avatar from './Avatar';
import ConversationItem from './ConversationItem';
import NewGroupModal from './NewGroupModal';
import { BellIcon, LogoutIcon, MoonIcon, SearchIcon, SunIcon, UsersIcon } from './Icons';

export default function Sidebar({ theme, onToggleTheme }) {
  const { logout } = useAuth();
  const { me, loaded, conversations, online, typing, activeId, selectConversation, openPrivateChat } = useChat();
  const { supported, permission, requestPermission } = useNotifications();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searchError, setSearchError] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);

  const searching = query.trim().length > 0;

  useEffect(() => {
    if (!searching) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .searchUsers(query.trim())
        .then((users) => !cancelled && (setResults(users), setSearchError('')))
        .catch((err) => !cancelled && setSearchError(err.message));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, searching]);

  // People from my conversations who are online right now.
  const onlineContacts = useMemo(() => {
    const seen = new Map();
    conversations.forEach((c) =>
      c.members.forEach((m) => m._id !== me._id && online[m._id] && seen.set(m._id, m))
    );
    return [...seen.values()];
  }, [conversations, online, me._id]);

  const startChat = async (userId) => {
    setQuery('');
    try {
      await openPrivateChat(userId);
    } catch (err) {
      setSearchError(err.message);
    }
  };

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <div className="me">
          <Avatar name={me.username} id={me._id} size={38} />
          <div>
            <div className="me-name">{me.username}</div>
            <div className="me-status">🟢 Online</div>
          </div>
        </div>
        <div className="header-actions">
          {supported && permission === 'default' && (
            <button type="button" className="icon-button" onClick={requestPermission} title="Enable desktop notifications" aria-label="Enable desktop notifications">
              <BellIcon />
            </button>
          )}
          <button type="button" className="icon-button" onClick={onToggleTheme} title="Toggle dark mode" aria-label="Toggle dark mode">
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <button type="button" className="icon-button" onClick={() => setShowNewGroup(true)} title="New group" aria-label="New group">
            <UsersIcon />
          </button>
          <button type="button" className="icon-button" onClick={logout} title="Log out" aria-label="Log out">
            <LogoutIcon />
          </button>
        </div>
      </header>

      <div className="search">
        <SearchIcon size={18} />
        <input
          type="search"
          placeholder="Search users"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search users"
        />
      </div>

      {!searching && onlineContacts.length > 0 && (
        <section className="online-strip" aria-label="Online now">
          {onlineContacts.map((user) => (
            <button type="button" key={user._id} className="online-user" onClick={() => startChat(user._id)}>
              <Avatar name={user.username} id={user._id} online size={44} />
              <span>{user.username}</span>
            </button>
          ))}
        </section>
      )}

      <div className="sidebar-scroll">
        {searching ? (
          <>
            <h2 className="list-title">People</h2>
            {searchError && <p className="form-error padded">{searchError}</p>}
            <ul className="conversation-list">
              {results.map((user) => (
                <li key={user._id}>
                  <button type="button" className="conversation-item" onClick={() => startChat(user._id)}>
                    <Avatar name={user.username} id={user._id} online={Boolean(online[user._id])} />
                    <div className="conversation-text">
                      <span className="conversation-name">{user.username}</span>
                      <span className="conversation-preview">{online[user._id] ? 'Online' : 'Offline'}</span>
                    </div>
                  </button>
                </li>
              ))}
              {results.length === 0 && !searchError && <li className="muted empty-list">No users match “{query}”</li>}
            </ul>
          </>
        ) : (
          <>
            <h2 className="list-title">Chats</h2>
            <ul className="conversation-list">
              {conversations.map((conversation) => (
                <ConversationItem
                  key={conversation._id}
                  conversation={conversation}
                  me={me}
                  online={online}
                  typing={typing[conversation._id]}
                  active={conversation._id === activeId}
                  onSelect={selectConversation}
                />
              ))}
            </ul>
            {loaded && conversations.length === 0 && (
              <p className="muted empty-list">No conversations yet. Search for someone above to start chatting.</p>
            )}
          </>
        )}
      </div>

      {showNewGroup && <NewGroupModal onClose={() => setShowNewGroup(false)} />}
    </aside>
  );
}
