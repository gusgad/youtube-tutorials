const amqplib = require('amqplib');
const config = require('../config');

let channelPromise = null;

async function getChannel() {
  if (!channelPromise) {
    channelPromise = (async () => {
      const conn = await amqplib.connect(config.rabbitmq.url);
      const channel = await conn.createChannel();
      await channel.assertQueue(config.rabbitmq.notificationQueue, { durable: true });
      return channel;
    })();
  }
  return channelPromise;
}

async function publishNotification(payload) {
  const channel = await getChannel();
  channel.sendToQueue(
    config.rabbitmq.notificationQueue,
    Buffer.from(JSON.stringify(payload)),
    { persistent: true }
  );
}

module.exports = { publishNotification };
