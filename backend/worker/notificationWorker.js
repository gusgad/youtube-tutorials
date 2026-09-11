const amqplib = require('amqplib');
const config = require('../src/config');
const pool = require('../src/db/pool');

// Delivers a notification for a new message to every recipient. In this
// demo, "delivery" just means writing a log line + a row we could later
// surface as a push/email notification.
async function deliverNotification(payload) {
  const { channelId, messageId, authorId, recipientIds } = payload;

  const { rows } = await pool.query(
    `SELECT m.body, u.username AS author_username, c.name AS channel_name
     FROM messages m
     JOIN users u ON u.id = m.user_id
     JOIN channels c ON c.id = m.channel_id
     WHERE m.id = $1`,
    [messageId]
  );
  const details = rows[0];

  for (const recipientId of recipientIds) {
    console.log(
      `[notify] user=${recipientId} channel=#${details.channel_name} from=${details.author_username}: "${details.body}"`
    );
  }
}

async function start() {
  const conn = await amqplib.connect(config.rabbitmq.url);
  const channel = await conn.createChannel();
  await channel.assertQueue(config.rabbitmq.notificationQueue, { durable: true });
  channel.prefetch(10);

  console.log('Notification worker started, waiting for messages...');

  channel.consume(config.rabbitmq.notificationQueue, async (msg) => {
    if (!msg) return;

    // Acknowledge immediately so a slow downstream delivery (email/push)
    // doesn't hold up the queue for other consumers.
    channel.ack(msg);

    const payload = JSON.parse(msg.content.toString());
    await deliverNotification(payload);
  });
}

start().catch((err) => {
  console.error('Notification worker failed to start:', err);
  process.exit(1);
});
