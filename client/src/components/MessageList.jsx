import { Fragment, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useChat } from '../context/ChatContext';
import { formatDay } from '../utils/format';
import MessageBubble from './MessageBubble';

const NEAR_BOTTOM_PX = 120;
const LOAD_OLDER_PX = 80;

export default function MessageList({ conversation }) {
  const { me, messages, hasMore, loadOlder, retryMessage } = useChat();
  const list = messages[conversation._id];
  const scrollRef = useRef(null);
  const stickToBottom = useRef(true);
  const heightBeforePrepend = useRef(null);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !list) return;
    if (heightBeforePrepend.current !== null) {
      // Older messages were added above: keep the visible message in place.
      el.scrollTop += el.scrollHeight - heightBeforePrepend.current;
      heightBeforePrepend.current = null;
    } else if (stickToBottom.current || list[list.length - 1]?.sender?._id === me._id) {
      scrollToBottom();
    }
  }, [list, me._id, scrollToBottom]);

  const handleScroll = () => {
    const el = scrollRef.current;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    if (el.scrollTop < LOAD_OLDER_PX && hasMore[conversation._id] && !loadingOlder) {
      heightBeforePrepend.current = el.scrollHeight;
      setLoadingOlder(true);
      loadOlder()
        .catch((err) => {
          heightBeforePrepend.current = null;
          console.error(err);
        })
        .finally(() => setLoadingOlder(false));
    }
  };

  const onMediaLoad = () => stickToBottom.current && scrollToBottom();

  if (!list) {
    return (
      <div className="messages center">
        <div className="spinner" aria-label="Loading messages" />
      </div>
    );
  }

  return (
    <div className="messages" ref={scrollRef} onScroll={handleScroll}>
      {loadingOlder && <div className="spinner small" aria-label="Loading older messages" />}
      {list.length === 0 && <p className="muted empty-chat">No messages yet. Say hello 👋</p>}
      {list.map((message, i) => {
        const prev = list[i - 1];
        const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(message.createdAt).toDateString();
        const isOwn = message.sender?._id === me._id;
        const showSender =
          conversation.isGroup && !isOwn && (newDay || prev.type === 'system' || prev.sender?._id !== message.sender?._id);
        return (
          <Fragment key={message._id}>
            {newDay && <div className="day-divider"><span>{formatDay(message.createdAt)}</span></div>}
            <MessageBubble
              message={message}
              isOwn={isOwn}
              showSender={showSender}
              isGroup={conversation.isGroup}
              onRetry={retryMessage}
              onMediaLoad={onMediaLoad}
            />
          </Fragment>
        );
      })}
    </div>
  );
}
