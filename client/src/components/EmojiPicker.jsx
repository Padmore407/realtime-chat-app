import { useEffect, useRef } from 'react';

const EMOJIS = [
  '😀', '😂', '🥹', '😊', '😍', '😘', '😎', '🤩', '🤔', '😅', '😢', '😭',
  '😡', '😴', '🤯', '🥳', '😇', '🙃', '😬', '🤗', '👍', '👎', '👏', '🙌',
  '🙏', '💪', '👋', '🤝', '✌️', '👌', '❤️', '💔', '🔥', '✨', '🎉', '💯',
  '✅', '❌', '⭐', '☕', '🍕', '🎂', '⚽', '🎮', '💻', '📚', '🚀', '🌙',
];

export default function EmojiPicker({ onSelect, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const onPointer = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !e.target.closest('[data-emoji-toggle]')) onClose();
    };
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="emoji-picker" ref={ref} role="dialog" aria-label="Emoji picker">
      {EMOJIS.map((emoji) => (
        <button type="button" key={emoji} onClick={() => onSelect(emoji)} aria-label={`Insert ${emoji}`}>
          {emoji}
        </button>
      ))}
    </div>
  );
}
