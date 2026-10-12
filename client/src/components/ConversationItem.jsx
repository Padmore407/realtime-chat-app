import Avatar from './Avatar';
import { conversationTitle, formatListTime, messagePreview, otherMember } from '../utils/format';

export default function ConversationItem({ conversation, me, online, typing, active, onSelect }) {
  const other = conversation.isGroup ? null : otherMember(conversation, me._id);
  const typers = Object.values(typing || {});
  const preview = typers.length
    ? conversation.isGroup
      ? `${typers[0]} is typing…`
      : 'typing…'
    : messagePreview(conversation.lastMessage, me._id);

  return (
    <li>
      <button
        type="button"
        className={`conversation-item ${active ? 'active' : ''} ${conversation.unreadCount ? 'unread' : ''}`}
        onClick={() => onSelect(conversation._id)}
      >
        <Avatar
          name={conversationTitle(conversation, me._id)}
          id={conversation.isGroup ? conversation._id : other?._id}
          isGroup={conversation.isGroup}
          online={conversation.isGroup ? undefined : Boolean(online[other?._id])}
        />
        <div className="conversation-text">
          <div className="conversation-top">
            <span className="conversation-name">{conversationTitle(conversation, me._id)}</span>
            <time className="conversation-time">{formatListTime(conversation.lastMessage?.createdAt)}</time>
          </div>
          <div className="conversation-bottom">
            <span className={`conversation-preview ${typers.length ? 'typing' : ''}`}>{preview}</span>
            {conversation.unreadCount > 0 && (
              <span className="badge" aria-label={`${conversation.unreadCount} unread`}>
                {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
              </span>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}
