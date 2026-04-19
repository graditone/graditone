import { useState } from 'react';
import { useProfile } from '../services/profiles/ProfileContext';
import { validateProfileName } from '../services/profiles/types';
import './ProfilePanel.css';

interface ProfilePanelProps {
  onClose: () => void;
  onProfileChange?: () => void;
  style?: React.CSSProperties;
}

export function ProfilePanel({ onClose, onProfileChange, style }: ProfilePanelProps) {
  const {
    activeProfile,
    profiles,
    switchProfile,
    createProfile,
    renameProfile,
    deleteProfile,
  } = useProfile();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function handleCreate() {
    const error = validateProfileName(newName);
    if (error) {
      setCreateError(error);
      return;
    }
    try {
      createProfile(newName.trim());
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        setCreateError('Storage is full. Delete a profile to free space.');
      } else {
        setCreateError(e instanceof Error ? e.message : 'Failed to create profile');
      }
      return;
    }
    setNewName('');
    setCreating(false);
    setCreateError(null);
    onClose();
    document.dispatchEvent(new CustomEvent('graditone:profile-changed'));
    onProfileChange?.();
  }

  function handleSwitch(id: string) {
    if (id === activeProfile.id) return;
    switchProfile(id);
    onClose();
    document.dispatchEvent(new CustomEvent('graditone:profile-changed'));
    onProfileChange?.();
  }

  function handleStartRename(id: string, currentName: string) {
    setEditingId(id);
    setEditName(currentName);
    setEditError(null);
  }

  function handleRename(id: string) {
    const error = validateProfileName(editName);
    if (error) {
      setEditError(error);
      return;
    }
    renameProfile(id, editName.trim());
    setEditingId(null);
    setEditError(null);
  }

  async function handleDelete(id: string) {
    await deleteProfile(id);
    setConfirmDeleteId(null);
  }

  return (
    <div className="profile-panel" role="dialog" aria-label="Profile management" style={style}>
      <div className="profile-panel-header">
        <span className="profile-panel-title">Profiles</span>
      </div>
      <ul className="profile-panel-list">
        {profiles.map(p => (
          <li
            key={p.id}
            className={`profile-panel-item ${p.id === activeProfile.id ? 'profile-panel-item--active' : ''}`}
          >
            {editingId === p.id ? (
              <div className="profile-panel-edit">
                <input
                  className="profile-panel-input"
                  value={editName}
                  onChange={e => { setEditName(e.target.value); setEditError(null); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(p.id); if (e.key === 'Escape') setEditingId(null); }}
                  autoFocus
                  maxLength={50}
                />
                <button className="profile-panel-btn-sm" onClick={() => handleRename(p.id)}>✓</button>
                <button className="profile-panel-btn-sm" onClick={() => setEditingId(null)}>✕</button>
                {editError && <span className="profile-panel-error">{editError}</span>}
              </div>
            ) : confirmDeleteId === p.id ? (
              <div className="profile-panel-confirm">
                <span>Delete "{p.name}"?</span>
                <button className="profile-panel-btn-sm profile-panel-btn-danger" onClick={() => handleDelete(p.id)}>Delete</button>
                <button className="profile-panel-btn-sm" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
              </div>
            ) : (
              <>
                <button
                  className="profile-panel-name"
                  onClick={() => handleSwitch(p.id)}
                  title={p.id === activeProfile.id ? 'Active profile' : `Switch to ${p.name}`}
                >
                  <span className="profile-panel-avatar">
                    {p.name.charAt(0).toUpperCase() + p.name.slice(1, 3).toLowerCase()}
                  </span>
                  <span className="profile-panel-name-text">{p.name}</span>
                  {p.id === activeProfile.id && <span className="profile-panel-active-badge">✓</span>}
                </button>
                <button
                  className="profile-panel-btn-sm"
                  onClick={() => handleStartRename(p.id, p.name)}
                  aria-label={`Rename ${p.name}`}
                  title="Rename"
                >✎</button>
                {profiles.length > 1 && (
                  <button
                    className="profile-panel-btn-sm profile-panel-btn-danger"
                    onClick={() => setConfirmDeleteId(p.id)}
                    aria-label={`Delete ${p.name}`}
                    title="Delete"
                  >🗑</button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {creating ? (
        <div className="profile-panel-create">
          <input
            className="profile-panel-input"
            value={newName}
            onChange={e => { setNewName(e.target.value); setCreateError(null); }}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setCreating(false); setCreateError(null); } }}
            placeholder="Profile name"
            autoFocus
            maxLength={50}
          />
          <button className="profile-panel-btn" onClick={handleCreate}>Create</button>
          <button className="profile-panel-btn" onClick={() => { setCreating(false); setCreateError(null); }}>Cancel</button>
          {createError && <span className="profile-panel-error">{createError}</span>}
        </div>
      ) : (
        <button className="profile-panel-btn profile-panel-add-btn" onClick={() => setCreating(true)}>
          + New Profile
        </button>
      )}
    </div>
  );
}
