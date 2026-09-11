import React from 'react';

export default function Sidebar({ workspace, channels, selectedChannelId, onSelect, onCreateChannel, onLogout }) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>{workspace?.name || 'ChatterBox'}</h3>
        <button onClick={onLogout} className="link-button">
          Log out
        </button>
      </div>
      <div className="channel-list">
        {channels.map((c) => (
          <button
            key={c.id}
            className={`channel-item ${c.id === selectedChannelId ? 'active' : ''}`}
            onClick={() => onSelect(c)}
          >
            # {c.name}
            {c.memberCount != null && <span className="member-count">{c.memberCount}</span>}
          </button>
        ))}
      </div>
      <button className="new-channel" onClick={onCreateChannel}>
        + New channel
      </button>
    </div>
  );
}
