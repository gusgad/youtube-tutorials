const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('chatterbox_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request('/users/me'),

  listWorkspaces: () => request('/workspaces'),
  createWorkspace: (name) => request('/workspaces', { method: 'POST', body: JSON.stringify({ name }) }),
  listChannels: (workspaceId) => request(`/workspaces/${workspaceId}/channels`),
  createChannel: (workspaceId, data) =>
    request(`/workspaces/${workspaceId}/channels`, { method: 'POST', body: JSON.stringify(data) }),
  deleteChannel: (channelId) => request(`/channels/${channelId}`, { method: 'DELETE' }),
  joinChannel: (channelId) => request(`/channels/${channelId}/join`, { method: 'POST' }),

  listMessages: (channelId, { limit, offset } = {}) =>
    request(`/channels/${channelId}/messages?limit=${limit || 50}&offset=${offset || 0}`),
  searchMessages: (channelId, q) => request(`/channels/${channelId}/messages/search?q=${encodeURIComponent(q)}`),
  markChannelRead: (channelId) => request(`/channels/${channelId}/messages/read`, { method: 'POST' }),
  unreadCount: (channelId) => request(`/channels/${channelId}/messages/unread-count`),
};

export { getToken };
