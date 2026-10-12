import { useState } from 'react';
import { useChat } from '../context/ChatContext';
import Avatar from './Avatar';
import Modal from './Modal';
import UserPicker from './UserPicker';

export default function GroupInfoModal({ conversation, onClose }) {
  const { me, online, addMembers, removeMember, leaveGroup } = useChat();
  const [adding, setAdding] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isAdmin = conversation.admin === me._id;
  const memberIds = conversation.members.map((m) => m._id);

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = () =>
    run(async () => {
      await addMembers(conversation._id, adding.map((u) => u._id));
      setAdding([]);
    });

  const handleRemove = (member) => {
    if (window.confirm(`Remove ${member.username} from the group?`)) run(() => removeMember(conversation._id, member._id));
  };

  const handleLeave = () => {
    if (window.confirm(`Leave "${conversation.name}"?`)) run(() => leaveGroup(conversation._id).then(onClose));
  };

  return (
    <Modal
      title={conversation.name}
      onClose={onClose}
      footer={
        <button type="button" className="button danger" onClick={handleLeave} disabled={busy}>
          Leave group
        </button>
      }
    >
      <h3 className="section-title">{conversation.members.length} members</h3>
      <ul className="member-list">
        {conversation.members.map((member) => (
          <li key={member._id} className="member-item">
            <Avatar name={member.username} id={member._id} online={Boolean(online[member._id])} size={36} />
            <span className="member-name">
              {member.username}
              {member._id === me._id && <span className="muted"> (you)</span>}
            </span>
            {member._id === conversation.admin && <span className="badge-label">Admin</span>}
            {isAdmin && member._id !== me._id && (
              <button type="button" className="link-button danger" onClick={() => handleRemove(member)} disabled={busy}>
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {isAdmin && (
        <>
          <h3 className="section-title">Add members</h3>
          <UserPicker selected={adding} onChange={setAdding} excludeIds={memberIds} />
          <button type="button" className="button full" onClick={handleAdd} disabled={busy || adding.length === 0}>
            Add {adding.length || ''} {adding.length === 1 ? 'member' : 'members'}
          </button>
        </>
      )}
      {error && <p className="form-error">{error}</p>}
    </Modal>
  );
}
