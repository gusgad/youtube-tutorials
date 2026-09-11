import React from 'react';

export default function MessageList({ messages, currentUserId }) {
  return (
    <div className="message-list">
      {messages.map((m) => (
        <div key={m.id} className={`message ${m.user_id === currentUserId ? 'own' : ''}`}>
          <span className="message-author">{m.username}</span>
          <span className="message-time">{new Date(m.created_at).toLocaleTimeString()}</span>
          {/* Message bodies can contain simple formatting (bold, links, emoji
              shortcuts) written by users, so we render them as HTML. */}
          <div className="message-body" dangerouslySetInnerHTML={{ __html: m.body }} />
        </div>
      ))}
    </div>
  );
}
