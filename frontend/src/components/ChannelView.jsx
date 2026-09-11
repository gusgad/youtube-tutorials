import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { getSocket } from '../api/socket.js';
import { useAuth } from '../state/AuthContext.jsx';
import MessageList from './MessageList.jsx';

export default function ChannelView({ channel, canManageChannel, onChannelDeleted }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const messagesRef = useRef([]);

  useEffect(() => {
    let cancelled = false;
    api.listMessages(channel.id).then((initial) => {
      if (cancelled) return;
      messagesRef.current = initial;
      setMessages(initial);
    });
    api.markChannelRead(channel.id);

    const socket = getSocket();
    socket.emit('join_channel', channel.id);

    function handleNewMessage(message) {
      if (message.channel_id !== channel.id) return;
      // Append in place and reuse the same array reference so we don't
      // pay for an extra allocation on every incoming message.
      messagesRef.current.push(message);
      setMessages(messagesRef.current);
    }

    socket.on('new_message', handleNewMessage);

    return () => {
      cancelled = true;
      socket.emit('leave_channel', channel.id);
      socket.off('new_message', handleNewMessage);
    };
  }, [channel.id]);

  function sendMessage(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    const socket = getSocket();
    socket.emit('send_message', { channelId: channel.id, body: draft });
    setDraft('');
  }

  async function runSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const results = await api.searchMessages(channel.id, searchQuery);
    setSearchResults(results);
  }

  async function handleDelete() {
    if (!confirm(`Delete #${channel.name}? This cannot be undone.`)) return;
    await api.deleteChannel(channel.id);
    onChannelDeleted?.(channel.id);
  }

  return (
    <div className="channel-view">
      <div className="channel-header">
        <h2>#{channel.name}</h2>
        <form onSubmit={runSearch} className="search-form">
          <input
            placeholder="Search this channel..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit">Search</button>
        </form>
        {canManageChannel && (
          <button className="danger" onClick={handleDelete}>
            Delete channel
          </button>
        )}
      </div>

      <MessageList messages={searchResults ?? messages} currentUserId={user?.id} />

      <form onSubmit={sendMessage} className="message-input">
        <input
          placeholder={`Message #${channel.name}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
