import { useState, useRef, useEffect, useCallback } from 'react';
import { useProfile } from '../services/profiles/ProfileContext';
import { ProfilePanel } from './ProfilePanel';
import './ProfileIcon.css';

interface ProfileIconProps {
  onProfileChange?: () => void;
  className?: string;
}

export function ProfileIcon({ onProfileChange, className }: ProfileIconProps) {
  const { activeProfile, ready } = useProfile();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const updatePanelPosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPanelStyle({
      position: 'fixed',
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
      zIndex: 10000,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (!ready) return null;

  const shortName = activeProfile.name.charAt(0).toUpperCase() + activeProfile.name.slice(1, 3).toLowerCase();

  return (
    <div className={`profile-icon-container${className ? ` ${className}` : ''}`} ref={containerRef}>
      <button
        ref={btnRef}
        type="button"
        className="profile-icon-btn"
        onClick={() => {
          if (!open) updatePanelPosition();
          setOpen(prev => !prev);
        }}
        aria-label={`Profile: ${activeProfile.name}`}
        title={activeProfile.name}
      >
        <span className="profile-icon-avatar">{shortName}</span>
      </button>
      {open && <ProfilePanel onClose={() => setOpen(false)} onProfileChange={onProfileChange} style={panelStyle} />}
    </div>
  );
}
