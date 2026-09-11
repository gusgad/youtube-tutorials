const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const config = require('./config');
const errorHandler = require('./middleware/errorHandler');
const { registerSocketHandlers } = require('./sockets');

const authRoutes = require('./routes/auth');
const workspaceRoutes = require('./routes/workspaces');
const channelRoutes = require('./routes/channels');
const userRoutes = require('./routes/users');

const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/users', userRoutes);

app.use(errorHandler);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: config.corsOrigin, credentials: true },
});

registerSocketHandlers(io);

server.listen(config.port, () => {
  console.log(`ChatterBox backend listening on port ${config.port}`);
});

module.exports = { app, server };
