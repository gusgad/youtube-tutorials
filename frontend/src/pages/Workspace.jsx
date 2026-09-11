import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../state/AuthContext.jsx';
import Sidebar from '../components/Sidebar.jsx';
import ChannelView from '../components/ChannelView.jsx';

export default function Workspace() {
  const { logout } = useAuth();
  const [workspace, setWorkspace] = useState(null);
  const [role, setRole] = useState(null);
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);

  useEffect(() => {
    api.listWorkspaces().then(async (workspaces) => {
      const ws = workspaces[0];
      if (!ws) return;
      setWorkspace(ws);
      setRole(ws.role);
      const chs = await api.listChannels(ws.id);
      setChannels(chs);
      setSelectedChannel(chs[0] || null);
    });
  }, []);

  async function handleCreateChannel() {
    const name = prompt('Channel name:');
    if (!name) return;
    const channel = await api.createChannel(workspace.id, { name });
    setChannels((prev) => [...prev, { ...channel, memberCount: 1, lastMessage: null }]);
  }

  function handleChannelDeleted(channelId) {
    setChannels((prev) => prev.filter((c) => c.id !== channelId));
    setSelectedChannel((prev) => (prev?.id === channelId ? null : prev));
  }

  if (!workspace) return <div className="center">Loading workspace...</div>;

  return (
    <div className="workspace-layout">
      <Sidebar
        workspace={workspace}
        channels={channels}
        selectedChannelId={selectedChannel?.id}
        onSelect={setSelectedChannel}
        onCreateChannel={handleCreateChannel}
        onLogout={logout}
      />
      {selectedChannel ? (
        <ChannelView
          channel={selectedChannel}
          canManageChannel={role === 'admin'}
          onChannelDeleted={handleChannelDeleted}
        />
      ) : (
        <div className="center">Select a channel to get started.</div>
      )}
    </div>
  );
}
