import { useState } from 'react';
import { useChat } from '../context/ChatContext';
import { formatLastSeen, otherMember } from '../utils/format';
import Avatar from './Avatar';
import GroupInfoModal from './GroupInfoModal';
import { BackIcon, InfoIcon } from './Icons';
import MessageInput from './MessageInput';
import MessageList from './MessageList';

function typingText(names) {
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return 'Several people are typing…';
}

export default function ChatWindow() {
  const { activeConversation: conversation, activeTitle, me, online, typing, selectConversation } = useChat();
  const [showInfo, setShowInfo] = useState(false);

  const typers = Object.values(typing[conversation._id] || {});
  const other = conversation.isGroup ? null : otherMember(conversation, me._id);
  const isOtherOnline = Boolean(other && online[other._id]);

  let subtitle;
  if (conversation.isGroup) {
    const onlineCount = conversation.members.filter((m) => m._id !== me._id && online[m._id]).length;
    subtitle = `${conversation.members.length} members${onlineCount ? `, ${onlineCount} online` : ''}`;
  } else {
    subtitle = isOtherOnline ? 'Online' : formatLastSeen(other?.lastSeen);
  }

  return (
    <section className="chat-window" aria-label={`Conversation with ${activeTitle}`}>
      <header className="chat-header">
        <button type="button" className="icon-button back-button" onClick={() => selectConversation(null)} aria-label="Back to chats">
          <BackIcon />
        </button>
        <Avatar
          name={activeTitle}
          id={conversation.isGroup ? conversation._id : other?._id}
          isGroup={conversation.isGroup}
          online={conversation.isGroup ? undefined : isOtherOnline}
          size={40}
        />
        <div className="chat-header-text">
          <h1>{activeTitle}</h1>
          <p className={!conversation.isGroup && isOtherOnline ? 'online-text' : ''}>
            {!conversation.isGroup && typers.length ? 'typing…' : subtitle}
          </p>
        </div>
        {conversation.isGroup && (
          <button type="button" className="icon-button" onClick={() => setShowInfo(true)} aria-label="Group info">
            <InfoIcon />
          </button>
        )}
      </header>

      <MessageList conversation={conversation} />

      <div className="typing-indicator" aria-live="polite">
        {typers.length > 0 && (
          <>
            <span className="typing-dots"><i /><i /><i /></span>
            {typingText(typers)}
          </>
        )}
      </div>

      <MessageInput conversationId={conversation._id} />

      {showInfo && <GroupInfoModal conversation={conversation} onClose={() => setShowInfo(false)} />}
    </section>
  );
}
