/**
 * CLICKBAIT EVENT PITFALL - Event Modeling Anti-Pattern
 * 
 * This example demonstrates the "Clickbait Event" anti-pattern in Event Modeling.
 * Clickbait Events are like sensational news headlines that promise information
 * but deliver nothing substantial. They contain just enough information (usually an ID)
 * to get your attention, but force subscribers to query back for actual details.
 * 
 * Problems with Clickbait Events:
 * - Subscribers receive notifications but must query for real data
 * - Creates "chattiness" - constant back-and-forth communication
 * - Tight coupling between publisher and subscribers
 * - Race conditions between event delivery and data availability
 * - Exponential growth of API calls across the system
 * - Services become fragile and error-prone
 * - DDoS vulnerability through retry mechanisms
 * 
 * The solution: Treat events as an API - include complete context
 * 
 * AWS MSK SETUP (with Terraform):
 * ================================
 * 1. EC2 instance needs an IAM role with MSK permissions
 * 2. Set environment variable: export AWS_MSK_BROKERS="broker1:9092,broker2:9092"
 * 3. Optional: export AWS_REGION="us-east-1" (defaults to us-east-1)
 * 4. Optional: export USE_IAM_AUTH=false (for local testing without IAM)
 */

const express = require('express');
const { Kafka, logLevel } = require('kafkajs');
const { fromIni } = require('@aws-sdk/credential-providers');

// ============================================================================
// CONFIGURATION FOR AWS MSK
// ============================================================================
const MSK_BROKERS = (process.env.AWS_MSK_BROKERS || 'localhost:9092').split(',');
const USE_IAM_AUTH = process.env.USE_IAM_AUTH !== 'false';

const getKafkaConfig = async () => {
  const config = {
    clientId: 'clickbait-event-demo-app',
    brokers: MSK_BROKERS,
    logLevel: logLevel.ERROR,
    connectionTimeout: 10000,
    requestTimeout: 30000,
  };

  if (USE_IAM_AUTH) {
    try {
      const { SignatureV4 } = require('@aws-sdk/signature-v4');
      const { SHA256 } = require('@aws-crypto/sha256-js');

      config.ssl = true;
      config.sasl = {
        mechanism: 'scram-sha-512',
        authorizationIdentity: process.env.AWS_MSK_USERNAME || 'default',
        username: async () => {
          const credentials = await fromIni()();
          return credentials.accessKeyId;
        },
        password: async () => {
          const credentials = await fromIni()();
          const signer = new SignatureV4({
            credentials,
            region: process.env.AWS_REGION || 'us-east-1',
            service: 'kafka-cluster',
            sha256: SHA256,
          });

          const signature = await signer.sign({
            method: 'GET',
            path: '/',
            hostname: MSK_BROKERS[0]?.split(':')[0],
            headers: {
              'Host': MSK_BROKERS[0]?.split(':')[0],
            },
          });

          return signature.headers.Authorization;
        },
      };
    } catch (error) {
      console.warn('IAM authentication setup failed, falling back to plaintext:', error.message);
      config.ssl = false;
    }
  } else {
    config.ssl = false;
  }

  return config;
};

let kafka;

// ============================================================================
// PITFALL 1: CLICKBAIT EVENTS (ANTI-PATTERN) - WRONG WAY
// ============================================================================
/**
 * The wrong way - emitting events that are just headlines (IDs only).
 * These are like sensational clickbait news that promises a story but has no substance.
 * Subscribers get excited by the notification but then need to query for actual data.
 */
class ClickbaitEventExample {
  constructor() {
    this.producer = null;
    this.queryCount = 0; // Track how many queries subscribers make
  }

  async init() {
    this.producer = kafka.producer();
    await this.producer.connect();
  }

  async disconnect() {
    await this.producer.disconnect();
  }

  /**
   * WRONG: Publishing events that are just clickbait headlines
   * Event only has the ID - subscribers must query for details
   */
  async publishShipmentUpdatesWrongWay(shipmentId, updates) {
    console.log('\n[WRONG WAY] Clickbait Events (Anti-pattern)');
    console.log('━'.repeat(70));

    const events = [];
    const timestamp = new Date().toISOString();

    // Simulate shipment lifecycle with clickbait events
    events.push({
      eventType: 'ShipmentStatusChanged',
      shipmentId, // Only the ID - that's all!
      timestamp,
    });

    const records = events.map(event => ({
      topic: 'shipment-events',
      messages: [
        {
          key: shipmentId,
          value: JSON.stringify(event),
        },
      ],
    }));

    await this.producer.sendBatch({ topicMessages: records });

    console.log(`[SUMMARY] Sent ${events.length} clickbait events (IDs only)`);

    console.log(`\n[SUBSCRIBER-ACTION] Subscriber receives notification...`);
    console.log(`[SUBSCRIBER-QUERY] Query #1: GET /api/shipments/${shipmentId}`);
    console.log(`[SUBSCRIBER-QUERY] Query #2: GET /api/shipments/${shipmentId}/tracking`);
    console.log(`[SUBSCRIBER-QUERY] Query #3: GET /api/carriers/${updates.carrierId}`);

    this.queryCount += 3;

    console.log(`\n[PROBLEMS] PROBLEMS WITH CLICKBAIT EVENTS:`);
    console.log('  1. Subscribers get notification but have no context');
    console.log('  2. Must query back to publisher to understand what changed');
    console.log('  3. Tight coupling - subscribers depend on publisher API structure');
    console.log('  4. Chattiness - constant back-and-forth communication');
    console.log('  5. Race conditions - data might not be ready when queried');
    console.log('  6. If resource is deleted, query returns 404 or empty data');
    console.log('  7. Exponential growth of API calls across the system');
    console.log('  8. Retry mechanisms can cause DDoS-like behavior\n');
  }

  /**
   * Simulate the cascade of queries across multiple services
   */
  async demonstrateCallExplosion(shipmentId) {
    console.log('\n[EXPLOSION] Cascading API Calls Problem');
    console.log('━'.repeat(70));

    let totalCalls = 0;

    console.log(`[FLOW] Order Service receives ShipmentStatusChanged event`);
    console.log(`  -> Query #1: GET /shipments/${shipmentId}`);
    totalCalls++;

    console.log(`[FLOW] Response has carrierId, need carrier details`);
    console.log(`  -> Query #2: GET /carriers/carrier-123`);
    totalCalls++;

    console.log(`[FLOW] Response has destinationCityId, need city details`);
    console.log(`  -> Query #3: GET /cities/city-456`);
    totalCalls++;

    console.log(`[FLOW] Response has customerId, need customer preferences`);
    console.log(`  -> Query #4: GET /customers/cust-789`);
    totalCalls++;

    console.log(`[FLOW] Notification Service receives same event`);
    console.log(`  -> Query #5: GET /shipments/${shipmentId}`);
    console.log(`  -> Query #6: GET /customers/cust-789`);
    console.log(`  -> Query #7: GET /notification-preferences/cust-789`);
    totalCalls += 3;

    console.log(`[FLOW] Analytics Service receives same event`);
    console.log(`  -> Query #8-15: Various analytics queries...`);
    totalCalls += 8;

    console.log(`[SUMMARY] Query cascade demonstrated - typical pattern with clickbait events\n`);
  }
}

// ============================================================================
// SOLUTION: RICH EVENTS (CORRECT WAY)
// ============================================================================
/**
 * The right way - include complete context in events.
 * Events should be treated as an API between publisher and subscribers.
 * Include all information subscribers might need.
 */
class RichEventExample {
  constructor() {
    this.producer = null;
  }

  async init() {
    this.producer = kafka.producer();
    await this.producer.connect();
  }

  async disconnect() {
    await this.producer.disconnect();
  }

  /**
   * CORRECT: Events contain all necessary information
   * Subscribers don't need to query back for context
   */
  async publishShipmentUpdatesRightWay(shipmentId, updates) {
    console.log('\n[CORRECT] Rich Events (Correct approach)');
    console.log('━'.repeat(70));

    const events = [];
    const timestamp = new Date().toISOString();

    // Event 1: Shipment status changed with all relevant data
    events.push({
      eventType: 'ShipmentStatusChanged',
      shipmentId,
      status: 'picked_up',
      carrier: updates.carrierName,
      estimatedDelivery: updates.estimatedDelivery,
      timestamp,
    });

    // Event 2: Delay notification with complete information
    events.push({
      eventType: 'ShipmentDelayed',
      shipmentId,
      reason: 'Weather delay',
      newEstimate: '2026-01-25T10:00:00Z',
      timestamp,
    });

    // Event 3: Delivery estimate update with full context
    events.push({
      eventType: 'DeliveryEstimateUpdated',
      shipmentId,
      newEstimate: '2026-01-25T10:00:00Z',
      confidence: 'high',
      lastUpdate: timestamp,
      trackingUrl: `https://shipment-service.local/shipments/${shipmentId}/tracking`,
      timestamp,
    });

    const records = events.map(event => ({
      topic: 'shipment-events',
      messages: [
        {
          key: shipmentId,
          value: JSON.stringify(event),
          headers: {
            'event-type': event.eventType,
          },
        },
      ],
    }));

    await this.producer.sendBatch({ topicMessages: records });

    console.log(`[SUMMARY] Sent ${events.length} rich events with complete context`);
  }
}

// ============================================================================
// PRAGMATIC APPROACH: Forgettable Payload Pattern
// ============================================================================
/**
 * A middle ground - include a versioned URL for full details
 * This is useful for sensitive data, large payloads, or privacy concerns
 */
class ForgettablePayloadExample {
  constructor() {
    this.producer = null;
  }

  async init() {
    this.producer = kafka.producer();
    await this.producer.connect();
  }

  async disconnect() {
    await this.producer.disconnect();
  }

  /**
   * PRAGMATIC: Include versioned URL + essential data
   * Subscribers can fetch full details if needed, but have enough to act
   */
  async publishShipmentUpdatesPragmatically(shipmentId, updates, shipmentVersion) {
    console.log('\n[PRAGMATIC] Forgettable Payload Pattern (Balanced approach)');
    console.log('━'.repeat(70));

    const events = [];
    const timestamp = new Date().toISOString();

    // Include essential data + versioned URL for complete payload
    events.push({
      eventType: 'ShipmentStatusChanged',
      shipmentId,
      status: 'picked_up',
      carrier: updates.carrierName,
      estimatedDelivery: updates.estimatedDelivery,
      detailsUrl: `https://shipment-service.local/api/shipments/${shipmentId}/v${shipmentVersion}`,
      timestamp,
    });

    const records = events.map(event => ({
      topic: 'shipment-events',
      messages: [
        {
          key: shipmentId,
          value: JSON.stringify(event),
        },
      ],
    }));

    await this.producer.sendBatch({ topicMessages: records });

    console.log(`\n[SUBSCRIBER-ACTION] Subscriber has essential data to act immediately`);
    console.log(`[OPTIONAL] If full details needed: GET ${events[0].detailsUrl}`);
    console.log(`[BENEFIT] Versioned URL prevents race conditions`);

    console.log(`\n[WHEN-TO-USE] GOOD USE CASES FOR FORGETTABLE PAYLOAD:`);
    console.log('  1. Privacy/Security - don\'t broadcast sensitive data');
    console.log('  2. Large payloads - include summary, URL for full details');
    console.log('  3. GDPR compliance - centralize PII access control');
    console.log('  4. External webhooks - you don\'t control subscriber code');
    console.log('  5. Rate limiting - avoid sending huge event payloads\n');
  }
}

// ============================================================================
// EXPRESS API WITH DEMONSTRATIONS
// ============================================================================
const app = express();
app.use(express.json());

let clickbaitExample = new ClickbaitEventExample();
let richExample = new RichEventExample();
let pragmaticExample = new ForgettablePayloadExample();

app.post('/demo/clickbait', async (req, res) => {
  try {
    const { shipmentId, carrierId, carrierName, trackingNumber, address, city, country, estimatedDelivery } = req.body;

    await clickbaitExample.publishShipmentUpdatesWrongWay(shipmentId, {
      carrierId,
      carrierName,
      trackingNumber,
      address,
      city,
      country,
      estimatedDelivery,
    });

    await clickbaitExample.demonstrateCallExplosion(shipmentId);

    res.json({
      status: 'success',
      message: 'Events published (WRONG WAY - Clickbait Events)',
      problem: 'Subscribers must query for all details',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/demo/rich', async (req, res) => {
  try {
    const { shipmentId, carrierId, carrierName, trackingNumber, address, city, country, estimatedDelivery } = req.body;

    await richExample.publishShipmentUpdatesRightWay(shipmentId, {
      carrierId,
      carrierName,
      trackingNumber,
      address,
      city,
      country,
      estimatedDelivery,
    });

    res.json({
      status: 'success',
      message: 'Events published (CORRECT - Rich Events)',
      benefit: 'All data included, no queries needed',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/demo/forgettable-payload', async (req, res) => {
  try {
    const { shipmentId, carrierId, carrierName, trackingNumber, address, city, country, estimatedDelivery } = req.body;

    await pragmaticExample.publishShipmentUpdatesPragmatically(shipmentId, {
      carrierId,
      carrierName,
      trackingNumber,
      address,
      city,
      country,
      estimatedDelivery,
    }, '1.0');

    res.json({
      status: 'success',
      message: 'Events published (PRAGMATIC - Forgettable Payload)',
      approach: 'Essential data + versioned URL for full details',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'clickbait-event-demo' });
});

// ============================================================================
// STARTUP AND CLEANUP
// ============================================================================
const PORT = process.env.PORT || 3002;

async function startup() {
  try {
    console.log('\n' + '═'.repeat(70));
    console.log('CLICKBAIT EVENT PITFALL - EVENT MODELING DEMONSTRATION');
    console.log('═'.repeat(70));

    console.log(`\nConnecting to Kafka brokers: ${MSK_BROKERS.join(', ')}`);

    const kafkaConfig = await getKafkaConfig();
    kafka = new Kafka(kafkaConfig);

    await clickbaitExample.init();
    await richExample.init();
    await pragmaticExample.init();

    app.listen(PORT, () => {
      console.log(`\n[OK] Server running on http://localhost:${PORT}`);
      console.log('\n[ENDPOINTS] DEMO ENDPOINTS:\n');
      console.log('  1. Show WRONG way (Clickbait Events):');
      console.log(`     POST http://localhost:${PORT}/demo/clickbait`);
      console.log('     Body: {');
      console.log('       "shipmentId":"ship-123",');
      console.log('       "carrierId":"carrier-456",');
      console.log('       "carrierName":"FedEx",');
      console.log('       "trackingNumber":"794698476384",');
      console.log('       "address":"123 Main St",');
      console.log('       "city":"New York",');
      console.log('       "country":"USA",');
      console.log('       "estimatedDelivery":"2026-01-24T14:00:00Z"');
      console.log('     }');
      console.log('\n  2. Show CORRECT way (Rich Events):');
      console.log(`     POST http://localhost:${PORT}/demo/rich`);
      console.log('     (same body as clickbait)');
      console.log('\n  3. Show PRAGMATIC way (Forgettable Payload):');
      console.log(`     POST http://localhost:${PORT}/demo/forgettable-payload`);
      console.log('     (same body as clickbait)');
      console.log('\n' + '═'.repeat(70) + '\n');
    });

    process.on('SIGINT', async () => {
      console.log('\n\nShutting down...');
      await clickbaitExample.disconnect();
      await richExample.disconnect();
      await pragmaticExample.disconnect();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to connect to Kafka:', error.message);
    console.error('\n[WARNING] Configuration tips:');
    console.error('1. Set AWS_MSK_BROKERS: export AWS_MSK_BROKERS="broker1:9092,broker2:9092"');
    console.error('2. Ensure EC2 IAM role has permission: kafka-cluster:*');
    console.error('3. For local testing: export USE_IAM_AUTH=false');
    process.exit(1);
  }
}

startup();

module.exports = { ClickbaitEventExample, RichEventExample, ForgettablePayloadExample };
