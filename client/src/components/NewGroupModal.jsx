import { useState } from 'react';
import { useChat } from '../context/ChatContext';
import Modal from './Modal';
import UserPicker from './UserPicker';

export default function NewGroupModal({ onClose }) {
  const { createGroup } = useChat();
  const [name, setName] = useState('');
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const canCreate = name.trim() && members.length > 0 && !saving;

  async function handleCreate() {
    setSaving(true);
    setError('');
    try {
      await createGroup(name.trim(), members.map((m) => m._id));
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title="New group"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="button" onClick={handleCreate} disabled={!canCreate}>
            {saving ? 'Creating…' : `Create group${members.length ? ` (${members.length + 1})` : ''}`}
          </button>
        </>
      }
    >
      <label className="field">
        <span>Group name</span>
        <input className="input" value={name} maxLength={50} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <div className="field">
        <span>Members</span>
        <UserPicker selected={members} onChange={setMembers} />
      </div>
      {error && <p className="form-error">{error}</p>}
    </Modal>
  );
}
