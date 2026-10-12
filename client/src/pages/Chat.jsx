import ChatWindow from '../components/ChatWindow';
import { ChatIcon } from '../components/Icons';
import Sidebar from '../components/Sidebar';
import Toasts from '../components/Toasts';
import { useChat } from '../context/ChatContext';

export default function Chat({ theme, onToggleTheme }) {
  const { activeConversation, connection } = useChat();

  return (
    <div className={`chat-container ${activeConversation ? 'show-chat' : ''}`}>
      {connection === 'reconnecting' && <div className="connection-banner">Connection lost. Reconnecting…</div>}
      {connection === 'offline' && <div className="connection-banner">Can’t reach the server. Retrying…</div>}
      <Sidebar theme={theme} onToggleTheme={onToggleTheme} />
      <main className="chat-main">
        {activeConversation ? (
          <ChatWindow key={activeConversation._id} />
        ) : (
          <div className="empty-state">
            <ChatIcon size={48} />
            <h2>Your messages</h2>
            <p className="muted">Pick a conversation or search for someone to start chatting.</p>
          </div>
        )}
      </main>
      <Toasts />
    </div>
  );
}
