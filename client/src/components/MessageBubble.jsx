import { fileUrl } from '../services/api';
import { formatBytes, formatTime, isImage } from '../utils/format';
import { AlertIcon, CheckIcon, ClockIcon, DoubleCheckIcon, DownloadIcon, FileIcon } from './Icons';

function Attachment({ attachment, onMediaLoad }) {
  const href = fileUrl(attachment.url);
  if (isImage(attachment.mimeType)) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="image-attachment">
        <img src={href} alt={attachment.name} loading="lazy" onLoad={onMediaLoad} />
      </a>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" download={attachment.name} className="file-attachment">
      <FileIcon size={28} />
      <span className="file-info">
        <span className="file-name">{attachment.name}</span>
        <span className="file-size">{formatBytes(attachment.size)}</span>
      </span>
      <DownloadIcon size={18} />
    </a>
  );
}

function DeliveryStatus({ message, isGroup }) {
  if (message.status === 'sending') return <ClockIcon size={14} aria-label="Sending" />;
  if (message.status === 'failed') return <AlertIcon size={14} className="failed-icon" aria-label="Failed" />;
  const readers = message.readBy?.length || 0;
  if (readers > 0) {
    const label = isGroup ? `Seen by ${readers}` : 'Seen';
    return (
      <span className="read-receipt" title={label}>
        <DoubleCheckIcon size={16} aria-label={label} />
      </span>
    );
  }
  return <CheckIcon size={14} aria-label="Sent" />;
}

export default function MessageBubble({ message, isOwn, showSender, isGroup, onRetry, onMediaLoad }) {
  if (message.type === 'system') {
    return <div className="system-message">{message.text}</div>;
  }

  return (
    <div className={`message-row ${isOwn ? 'own' : ''}`}>
      <div className={`bubble ${message.status === 'failed' ? 'failed' : ''}`}>
        {showSender && <div className="sender-name">{message.sender.username}</div>}
        {message.attachment && <Attachment attachment={message.attachment} onMediaLoad={onMediaLoad} />}
        {message.text && <p className="message-text">{message.text}</p>}
        <div className="message-meta">
          <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
          {isOwn && <DeliveryStatus message={message} isGroup={isGroup} />}
        </div>
      </div>
      {message.status === 'failed' && (
        <button type="button" className="link-button danger retry" onClick={() => onRetry(message)}>
          Not sent — retry
        </button>
      )}
    </div>
  );
}
