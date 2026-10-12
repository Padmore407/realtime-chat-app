import { useCallback, useEffect, useRef, useState } from 'react';
import { useChat } from '../context/ChatContext';
import { api } from '../services/api';
import { formatBytes, isImage } from '../utils/format';
import EmojiPicker from './EmojiPicker';
import { CloseIcon, FileIcon, PaperclipIcon, SendIcon, SmileIcon } from './Icons';

const TYPING_IDLE_MS = 2000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,.pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip';

export default function MessageInput({ conversationId }) {
  const { sendMessage, startTyping, stopTyping } = useChat();
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const isTyping = useRef(false);
  const idleTimer = useRef(null);

  // ---- Typing indicator: emit "typing" once, "stop_typing" after a pause ----
  const endTyping = useCallback(() => {
    clearTimeout(idleTimer.current);
    if (isTyping.current) {
      stopTyping(conversationId);
      isTyping.current = false;
    }
  }, [conversationId, stopTyping]);

  useEffect(() => endTyping, [endTyping]); // stop when switching chats / unmounting

  const handleChange = (e) => {
    setText(e.target.value);
    if (!isTyping.current) {
      startTyping(conversationId);
      isTyping.current = true;
    }
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(endTyping, TYPING_IDLE_MS);
  };

  // Auto-grow the textarea up to a max height.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  // Image thumbnail for the pending attachment.
  useEffect(() => {
    if (!file || !isImage(file.type)) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFile = (e) => {
    const selected = e.target.files?.[0];
    e.target.value = ''; // allow choosing the same file again
    if (!selected) return;
    if (selected.size > MAX_FILE_BYTES) {
      setError('File is too large (max 10 MB)');
      return;
    }
    setError('');
    setFile(selected);
  };

  const insertEmoji = (emoji) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const body = text.trim();
    if ((!body && !file) || uploading) return;

    let attachment;
    if (file) {
      setUploading(true);
      setError('');
      try {
        attachment = await api.uploadFile(file);
      } catch (err) {
        setError(err.message);
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    sendMessage({ text: body, attachment });
    setText('');
    setFile(null);
    setShowEmoji(false);
    endTyping();
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form className="composer" onSubmit={handleSubmit}>
      {error && <p className="form-error composer-error">{error}</p>}
      {file && (
        <div className="pending-file">
          {preview ? <img src={preview} alt="" /> : <FileIcon size={28} />}
          <div className="file-info">
            <span className="file-name">{file.name}</span>
            <span className="file-size">{uploading ? 'Uploading…' : formatBytes(file.size)}</span>
          </div>
          <button type="button" className="icon-button small" onClick={() => setFile(null)} disabled={uploading} aria-label="Remove attachment">
            <CloseIcon size={16} />
          </button>
        </div>
      )}
      {showEmoji && <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmoji(false)} />}

      <div className="composer-row">
        <button
          type="button"
          className="icon-button"
          data-emoji-toggle
          onClick={() => setShowEmoji((v) => !v)}
          aria-label="Emoji"
          aria-expanded={showEmoji}
        >
          <SmileIcon />
        </button>
        <button type="button" className="icon-button" onClick={() => fileInputRef.current?.click()} aria-label="Attach a file">
          <PaperclipIcon />
        </button>
        <input ref={fileInputRef} type="file" accept={ACCEPT} hidden onChange={handleFile} />
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message"
          maxLength={5000}
          aria-label="Message"
        />
        <button type="submit" className="send-button" disabled={(!text.trim() && !file) || uploading} aria-label="Send">
          <SendIcon size={18} />
        </button>
      </div>
    </form>
  );
}
