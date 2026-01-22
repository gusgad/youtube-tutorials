/**
 * "I'LL JUST ADD ONE MORE FIELD" PITFALL - Event Modeling Anti-Pattern
 * 
 * This example demonstrates the "I'll just add one more field" anti-pattern in Event Modeling.
 * It shows how adding "just one more field" for convenience can lead to:
 * 
 * - Loss of business context and precision
 * - Increased cognitive load when reading events
 * - Confusion about which properties are core vs. technical helpers
 * - "Spaghetti events" where too many fields are packed together
 * - Difficult to maintain and understand the original intent
 * - Redundant data that accumulates over time
 * - Events that lose their value as documentation
 * 
 * The key insight: By adding more information, we may actually lose precision.
 * 1 + 1 may equal 0 when events become cluttered.
 * 
 * Solutions presented:
 * 1. Event metadata for technical correlation
 * 2. Intelligent projection grouping/joins
 * 3. Accumulated data in read models (internal lists)
 * 4. Careful business analysis before adding fields
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
    clientId: 'add-field-anti-pattern-demo-app',
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
// PITFALL 1: ADDING FIELDS FOR CONVENIENCE (ANTI-PATTERN)
// ============================================================================
/**
 * The wrong way - continuously adding fields "just one more" for convenience
 * This demonstrates how the anti-pattern accumulates over time
 */
class AddFieldAntiPatternExample {
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
   * WRONG V1: Initial event design - clean and focused
   */
  async publishIncidentEventsV1(incidentId, customerId, details) {
    console.log('\n[WRONG-V1] Initial Design - Seems Fine');
    console.log('━'.repeat(70));

    const events = [];

    // Clean, business-focused event
    events.push({
      eventType: 'IncidentLogged',
      incidentId,
      customerId,
      description: details.description,
      severity: details.severity,
      loggedAt: new Date().toISOString(),
    });
    console.log('[EVENT] IncidentLogged');
    console.log('  Fields: incidentId, customerId, description, severity');

    events.push({
      eventType: 'IncidentResolved',
      incidentId,
      resolutionType: 'temporary_fix',
      resolvedAt: new Date().toISOString(),
    });
    console.log('[EVENT] IncidentResolved');
    console.log('  Fields: incidentId, resolutionType');

    const records = events.map((event, idx) => ({
      topic: 'support-incidents',
      messages: [
        {
          key: incidentId,
          value: JSON.stringify(event),
        },
      ],
    }));

    await this.producer.sendBatch({ topicMessages: records });

    console.log(`[SUMMARY] Sent V1 events (clean design)`);
  }

  async publishIncidentEventsV2(incidentId, customerId, details) {
    console.log('\n[WRONG-V2] "Just Add CustomerId" - First Addition');
    console.log('━'.repeat(70));

    const events = [];

    events.push({
      eventType: 'IncidentLogged',
      incidentId,
      customerId,
      description: details.description,
      severity: details.severity,
      loggedAt: new Date().toISOString(),
    });

    events.push({
      eventType: 'IncidentResolved',
      incidentId,
      customerId,
      resolutionType: 'temporary_fix',
      resolvedAt: new Date().toISOString(),
    });

    events.push({
      eventType: 'ResolutionAcknowledgedByCustomer',
      incidentId,
      customerId,
      acknowledgedAt: new Date().toISOString(),
    });

    const records = events.map(event => ({
      topic: 'support-incidents',
      messages: [
        {
          key: incidentId,
          value: JSON.stringify(event),
        },
      ],
    }));

    await this.producer.sendBatch({ topicMessages: records });

    console.log(`[SUMMARY] Sent V2 events (customerId added for convenience)`);
  }
}

// ============================================================================
// SOLUTION 1: USE EVENT METADATA
// ============================================================================
/**
 * The right way - keep events clean, use metadata for technical correlation
 * Events stay focused on business, metadata handles technical concerns
 */
class MetadataApproachExample {
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
   * CORRECT: Clean events with metadata for technical fields
   */
  async publishIncidentEventsWithMetadata(incidentId, customerId, details) {
    console.log('\n[CORRECT-1] Metadata Approach (Solution)');
    console.log('━'.repeat(70));

    const events = [];
    const timestamp = new Date().toISOString();

    events.push({
      eventType: 'IncidentLogged',
      incidentId,
      description: details.description,
      severity: details.severity,
      loggedAt: timestamp,
      metadata: {
        customerId,
        teamId: details.teamId,
        source: 'support-system',
      },
    });

    events.push({
      eventType: 'IncidentResolved',
      incidentId,
      resolutionType: 'temporary_fix',
      resolvedAt: timestamp,
      metadata: {
        customerId,
        teamId: details.teamId,
      },
    });

    events.push({
      eventType: 'IncidentClosed',
      incidentId,
      closedAt: timestamp,
      metadata: {
        customerId,
        teamId: details.teamId,
      },
    });

    const records = events.map(event => ({
      topic: 'support-incidents',
      messages: [
        {
          key: incidentId,
          value: JSON.stringify(event),
        },
      ],
    }));

    await this.producer.sendBatch({ topicMessages: records });

    console.log(`[SUMMARY] Sent events using metadata approach`);
  }
}

// ============================================================================
// SOLUTION 2: ACCUMULATED DATA IN READ MODELS
// ============================================================================
/**
 * Alternative approach - accumulate necessary data in read models
 * This avoids modifying events but keeps projections practical
 */
class ReadModelAccumulationExample {
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
   * CORRECT: Keep events clean, accumulate data in read model
   */
  async publishIncidentEventsWithReadModelAccumulation(incidentId, customerId, details) {
    console.log('\n[CORRECT-2] Read Model Accumulation (Alternative Solution)');
    console.log('━'.repeat(70));

    const events = [];
    const timestamp = new Date().toISOString();

    events.push({
      eventType: 'IncidentLogged',
      incidentId,
      customerId,
      description: details.description,
      severity: details.severity,
      loggedAt: timestamp,
    });

    events.push({
      eventType: 'IncidentResolved',
      incidentId,
      resolutionType: 'temporary_fix',
      resolvedAt: timestamp,
    });

    events.push({
      eventType: 'IncidentClosed',
      incidentId,
      closedAt: timestamp,
    });

    const records = events.map(event => ({
      topic: 'support-incidents',
      messages: [
        {
          key: incidentId,
          value: JSON.stringify(event),
        },
      ],
    }));

    await this.producer.sendBatch({ topicMessages: records });

    console.log(`[SUMMARY] Sent events using read model accumulation approach`);
  }
}

// ============================================================================
// EXPRESS API WITH DEMONSTRATIONS
// ============================================================================
const app = express();
app.use(express.json());

let antiPatternExample = new AddFieldAntiPatternExample();
let metadataExample = new MetadataApproachExample();
let readModelExample = new ReadModelAccumulationExample();

app.post('/demo/anti-pattern-progression', async (req, res) => {
  try {
    const { incidentId, customerId, description, severity, teamId, resolvedBy, closedBy, resolutionMinutes, satisfaction } = req.body;

    // Show how the anti-pattern evolves
    await antiPatternExample.publishIncidentEventsV1(incidentId, customerId, {
      description,
      severity,
      teamId,
      resolvedBy,
      closedBy,
      resolutionMinutes,
      satisfaction,
    });

    await antiPatternExample.publishIncidentEventsV2(incidentId, customerId, {
      description,
      severity,
      teamId,
      resolvedBy,
      closedBy,
      resolutionMinutes,
      satisfaction,
    });

    res.json({
      status: 'success',
      message: 'Anti-pattern progression demonstrated',
      warning: 'Fields added incrementally, complexity grows',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/demo/metadata-solution', async (req, res) => {
  try {
    const { incidentId, customerId, description, severity, teamId, resolvedBy, closedBy, resolutionMinutes, satisfaction } = req.body;

    await metadataExample.publishIncidentEventsWithMetadata(incidentId, customerId, {
      description,
      severity,
      teamId,
      resolvedBy,
      closedBy,
      resolutionMinutes,
      satisfaction,
      loggedBy: 'user-001',
    });

    res.json({
      status: 'success',
      message: 'Events published (CORRECT - Metadata Approach)',
      benefit: 'Clean events, technical correlation in metadata',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/demo/read-model-accumulation', async (req, res) => {
  try {
    const { incidentId, customerId, description, severity, teamId, resolvedBy, closedBy, resolutionMinutes, satisfaction } = req.body;

    await readModelExample.publishIncidentEventsWithReadModelAccumulation(incidentId, customerId, {
      description,
      severity,
      teamId,
      resolvedBy,
      closedBy,
      resolutionMinutes,
      satisfaction,
      loggedBy: 'user-001',
    });

    res.json({
      status: 'success',
      message: 'Events published (CORRECT - Read Model Accumulation)',
      benefit: 'Minimal events, intelligent read model handles correlation',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'add-field-anti-pattern-demo' });
});

// ============================================================================
// STARTUP AND CLEANUP
// ============================================================================
const PORT = process.env.PORT || 3003;

async function startup() {
  try {
    console.log('\n' + '═'.repeat(70));
    console.log('"I\'LL JUST ADD ONE MORE FIELD" PITFALL - EVENT MODELING DEMONSTRATION');
    console.log('═'.repeat(70));

    console.log(`\nConnecting to Kafka brokers: ${MSK_BROKERS.join(', ')}`);

    const kafkaConfig = await getKafkaConfig();
    kafka = new Kafka(kafkaConfig);

    await antiPatternExample.init();
    await metadataExample.init();
    await readModelExample.init();

    app.listen(PORT, () => {
      console.log(`\n[OK] Server running on http://localhost:${PORT}`);
      console.log('\n[ENDPOINTS] DEMO ENDPOINTS:\n');
      console.log('  1. Show anti-pattern progression (V1 -> V2 -> V3):');
      console.log(`     POST http://localhost:${PORT}/demo/anti-pattern-progression`);
      console.log('     Body: {');
      console.log('       "incidentId":"inc-123",');
      console.log('       "customerId":"cust-456",');
      console.log('       "description":"System is down",');
      console.log('       "severity":"critical",');
      console.log('       "teamId":"team-789",');
      console.log('       "resolvedBy":"agent-001",');
      console.log('       "closedBy":"agent-002",');
      console.log('       "resolutionMinutes":45,');
      console.log('       "satisfaction":9');
      console.log('     }');
      console.log('\n  2. Show metadata approach (CORRECT):');
      console.log(`     POST http://localhost:${PORT}/demo/metadata-solution`);
      console.log('     (same body as anti-pattern-progression)');
      console.log('\n  3. Show read model accumulation (CORRECT):');
      console.log(`     POST http://localhost:${PORT}/demo/read-model-accumulation`);
      console.log('     (same body as anti-pattern-progression)');
      console.log('\n' + '═'.repeat(70) + '\n');
    });

    process.on('SIGINT', async () => {
      console.log('\n\nShutting down...');
      await antiPatternExample.disconnect();
      await metadataExample.disconnect();
      await readModelExample.disconnect();
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

module.exports = { AddFieldAntiPatternExample, MetadataApproachExample, ReadModelAccumulationExample };
