/**
 * PROPERTY SOURCING PITFALL - Event Modeling Anti-Pattern
 * 
 * This example demonstrates the "Property Sourcing" anti-pattern in Event Modeling.
 * Property Sourcing occurs when you emit tiny, granular events for every single field change
 * (FirstNameChanged, LastNameChanged, EmailChanged, etc.) instead of grouping related
 * changes into meaningful business events.
 * 
 * The pitfall: Creates unmaintainable systems with hundreds of meaningless event types
 * The solution: Group related property changes into business-significant events
 * 
 * AWS MSK SETUP (with Terraform):
 * ================================
 * 1. EC2 instance needs an IAM role with MSK permissions
 * 2. Set environment variable: export AWS_MSK_BROKERS="broker1:9092,broker2:9092"
 * 3. Optional: export AWS_REGION="us-east-1" (defaults to us-east-1)
 * 4. Optional: export USE_IAM_AUTH=false (for local testing without IAM)
 * 
 * The EC2 instance automatically uses its IAM role for authentication with MSK.
 * NO need to set AWS_MSK_USERNAME or AWS_MSK_PASSWORD.
 * 
 * Required IAM policy for EC2:
 * {
 *   "Version": "2012-10-17",
 *   "Statement": [{
 *     "Effect": "Allow",
 *     "Action": "kafka-cluster:*",
 *     "Resource": "*"
 *   }]
 * }
 */

const express = require('express');
const { Kafka, logLevel } = require('kafkajs');

// ============================================================================
// LOCAL KAFKA CONFIGURATION (Docker)
// ============================================================================
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:29092').split(',');

const getKafkaConfig = () => {
  return {
    clientId: 'property-sourcing-demo',
    brokers: KAFKA_BROKERS,
    logLevel: logLevel.ERROR,
    connectionTimeout: 10000,
    requestTimeout: 30000,
  };
};

let kafka;

// ============================================================================
// PITFALL 1: PROPERTY SOURCING (ANTI-PATTERN) - WRONG WAY
// ============================================================================
/**
 * The wrong way - creating individual events for every field change.
 * This leads to:
 * - Hundreds of event types
 * - No business context
 * - Hard to maintain
 * - Consumers don't know which fields are significant
 * - Creates copy-paste problems
 */
class PropertySourcingExample {
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
   * WRONG: Creating separate events for each property change
   * When a user updates their personal data, we emit multiple tiny events
   */
  async updateUserDataWrongWay(userId, updates) {
    console.log('\n[WRONG WAY] Property Sourcing (Anti-pattern)');
    console.log('━'.repeat(70));

    const events = [];
    const timestamp = new Date().toISOString();

    // For each property change, create a separate event
    if (updates.firstName) {
      events.push({
        eventType: 'FirstNameChanged',
        userId,
        firstName: updates.firstName,
        changedAt: timestamp,
      });
    }

    if (updates.email) {
      events.push({
        eventType: 'EmailChanged',
        userId,
        email: updates.email,
        changedAt: timestamp,
      });
    }

    console.log(`  [EVENTS] Created ${events.length} tiny events instead of 1`);

    // Publish all these tiny events
    const records = events.map(event => ({
      topic: 'user-events',
      messages: [
        {
          key: userId,
          value: JSON.stringify(event),
          headers: {
            'correlation-id': `corr-${userId}-${Date.now()}`,
          },
        },
      ],
    }));

    await this.producer.sendBatch({ topicMessages: records });

    console.log(`\n[PROBLEMS] PROBLEMS WITH THIS APPROACH:`);
    console.log(`  1. Created ${events.length} separate events for one operation`);
    console.log('  2. No business context - we don\'t know WHY these changes happened');
    console.log('  3. Hard to track related changes (which fields changed together?)');
    console.log('  4. Difficult to handle transactions (what if some events fail?)');
    console.log('  5. Consumers must subscribe to multiple event types');
    console.log('  6. Scaling nightmare - add more fields = add more event types\n');
  }
}

// ============================================================================
// SOLUTION: BUSINESS-DRIVEN EVENTS (CORRECT WAY)
// ============================================================================
/**
 * The right way - create domain-driven events that represent business operations.
 * These events:
 * - Have business meaning
 * - Group related changes
 * - Are easier to maintain
 * - Consumers understand intent
 * - Scale better as domain grows
 */
class DomainDrivenEventsExample {
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
   * RIGHT: Create a single domain event that represents the business operation
   * All related changes are grouped into ONE event with business meaning
   */
  async updateUserDataRightWay(userId, updates) {
    console.log('\n[CORRECT] RIGHT WAY: Domain-Driven Events (Correct approach)');
    console.log('━'.repeat(70));

    const timestamp = new Date().toISOString();

    // Create ONE event that represents the business operation
    const event = {
      eventType: 'UserPersonalInfoUpdated',
      userId,
      firstName: updates.firstName,
      email: updates.email,
      changedAt: timestamp,
    };

    // Publish the single domain event
    await this.producer.sendBatch({
      topicMessages: [
        {
          topic: 'user-events',
          messages: [
            {
              key: userId,
              value: JSON.stringify(event),
              headers: {
                'correlation-id': `corr-${userId}-${Date.now()}`,
                'event-type': 'UserPersonalInfoUpdated',
              },
            },
          ],
        },
      ],
    });

    console.log(`  [EVENT] UserPersonalInfoUpdated (single event)`);
    console.log(`  Changed: ${Object.keys(updates).join(', ')}`);

    console.log(`\n[BENEFITS] BENEFITS OF THIS APPROACH:`);
    console.log('  1. Single event for one business operation (atomic)');
    console.log('  2. Clear business intent and context');
    console.log('  3. Easy to track which fields changed together');
    console.log('  4. Atomic - all-or-nothing transaction');
    console.log('  5. Consumers subscribe to meaningful domain events');
    console.log('  6. Scales well - adding fields doesn\'t multiply event types\n');
  }
}

// ============================================================================
// BUSINESS SIGNIFICANCE RULE
// ============================================================================
/**
 * When SHOULD you create separate field-change events?
 * Only when the field change itself triggers significant business workflows.
 */
class BusinessSignificantEventsExample {
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
   * APPROPRIATE: Create dedicated events only for business-significant field changes
   */
  async handleBusinessSignificantEvents(userId, updates) {
    console.log('\n[SIGNIFICANT] BUSINESS-SIGNIFICANT EVENTS (Acceptable)');
    console.log('━'.repeat(70));

    const events = [];
    const timestamp = new Date().toISOString();

    // ACCEPTABLE: Email change is business-significant
    // (triggers verification workflow, notification changes, etc.)
    if (updates.email) {
      events.push({
        eventType: 'EmailAddressVerificationRequested',
        userId,
        newEmail: updates.email,
        verificationToken: `token-${Date.now()}`,
        requestedAt: timestamp,
        reason: 'User changed email in profile update',
      });
      console.log(`  [EVENT] EmailAddressVerificationRequested`);
      console.log(`     -> Triggers: verification email, pending status, etc.`);
    }

    // ACCEPTABLE: Marital status change is business-significant
    // (triggers tax calculations, insurance updates, benefits eligibility, etc.)
    if (updates.maritalStatus) {
      events.push({
        eventType: 'MaritalStatusChanged',
        userId,
        previousStatus: 'single', // Would come from projection
        newStatus: updates.maritalStatus,
        changedAt: timestamp,
        reason: 'User updated personal information',
      });
      console.log(`  [EVENT] MaritalStatusChanged`);
      console.log(`     -> Triggers: benefits recalculation, notifications, etc.`);
    }

    // ACCEPTABLE: Account balance update is business-significant
    // (triggers fraud detection, limits adjustment, notifications, etc.)
    if (updates.accountBalance !== undefined) {
      events.push({
        eventType: 'AccountBalanceUpdated',
        userId,
        newBalance: updates.accountBalance,
        changedAt: timestamp,
        reason: 'Administrative adjustment',
      });
      console.log(`  [EVENT] AccountBalanceUpdated`);
      console.log(`     -> Triggers: fraud checks, alerts, audit logging, etc.`);
    }

    // NOT ACCEPTABLE: First name alone is not business-significant
    // (just cosmetic, no workflows triggered)
    // Keep it in UserPersonalInfoUpdated event instead

    if (events.length > 0) {
      const records = events.map(event => ({
        topic: 'user-events',
        messages: [
          {
            key: userId,
            value: JSON.stringify(event),
          },
        ],
      }));

      await this.producer.sendBatch({ topicMessages: records });
    }

    console.log(`\n[DECISION] DECISION RULE:`);
    console.log(`  [YES] Create separate event if:`);
    console.log(`     - It triggers significant business workflows`);
    console.log(`     - Other domains need to react to this change`);
    console.log(`     - It has compliance/audit importance`);
    console.log(`     Examples: EmailChanged, MaritalStatusChanged, AccountBalanceUpdated`);
    console.log(`\n  [NO] DON'T create separate event if:`);
    console.log(`     - It's just cosmetic/display purposes`);
    console.log(`     - No workflows are triggered`);
    console.log(`     - It's part of a larger operation`);
    console.log(`     Examples: FirstName, LastName, PhoneNumber\n`);
  }
}

// ============================================================================
// EXPRESS API WITH DEMONSTRATIONS
// ============================================================================
const app = express();
app.use(express.json());

let wrongWayExample = new PropertySourcingExample();
let rightWayExample = new DomainDrivenEventsExample();
let significantExample = new BusinessSignificantEventsExample();

// Demo endpoint: Show the WRONG way (Property Sourcing)
app.post('/demo/wrong-way', async (req, res) => {
  try {
    const { userId, firstName, lastName, email, phoneNumber } = req.body;

    await wrongWayExample.updateUserDataWrongWay(userId, {
      firstName,
      lastName,
      email,
      phoneNumber,
    });

    res.json({
      status: 'success',
      message: 'Events published (WRONG WAY - Property Sourcing)',
      pitfallType: 'property-sourcing',
      problemDescription: 'Created multiple tiny events instead of one domain event',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Demo endpoint: Show the RIGHT way (Domain-Driven)
app.post('/demo/right-way', async (req, res) => {
  try {
    const { userId, firstName, lastName, email, phoneNumber } = req.body;

    await rightWayExample.updateUserDataRightWay(userId, {
      firstName,
      lastName,
      email,
      phoneNumber,
    });

    res.json({
      status: 'success',
      message: 'Event published (RIGHT WAY - Domain-Driven)',
      bestPractice: 'Created single domain event grouping related changes',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Demo endpoint: Show when individual events ARE appropriate
app.post('/demo/business-significant', async (req, res) => {
  try {
    const { userId, email, maritalStatus, accountBalance } = req.body;

    await significantExample.handleBusinessSignificantEvents(userId, {
      email,
      maritalStatus,
      accountBalance,
    });

    res.json({
      status: 'success',
      message: 'Business-significant events published',
      rule: 'Only create separate events for business-significant field changes',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'property-sourcing-demo' });
});

// ============================================================================
// STARTUP AND CLEANUP
// ============================================================================
const PORT = process.env.PORT || 3000;

async function startup() {
  try {
    console.log('\n' + '═'.repeat(70));
    console.log('PROPERTY SOURCING PITFALL - EVENT MODELING DEMONSTRATION');
    console.log('═'.repeat(70));

    console.log(`\nConnecting to Kafka brokers: ${KAFKA_BROKERS.join(', ')}`);
    
    // Initialize Kafka with proper configuration
    const kafkaConfig = getKafkaConfig();
    kafka = new Kafka(kafkaConfig);

    await wrongWayExample.init();
    await rightWayExample.init();
    await significantExample.init();

    app.listen(PORT, () => {
      console.log(`\n[OK] Server running on http://localhost:${PORT}`);
      console.log('\n[ENDPOINTS] DEMO ENDPOINTS:\n');
      console.log('  1. Show WRONG way (Property Sourcing):');
      console.log(`     POST http://localhost:${PORT}/demo/wrong-way`);
      console.log('     Body: {"userId":"user123","firstName":"John","lastName":"Doe","email":"john@example.com","phoneNumber":"+1234567890"}');
      console.log('  2. Show RIGHT way (Domain-Driven):');
      console.log(`     POST http://localhost:${PORT}/demo/right-way`);
      console.log('     Body: {"userId":"user123","firstName":"John","lastName":"Doe","email":"john@example.com","phoneNumber":"+1234567890"}');
      console.log('  3. Show Business-Significant approach:');
      console.log(`     POST http://localhost:${PORT}/demo/business-significant`);
      console.log('     Body: {"userId":"user123","email":"john@newmail.com","maritalStatus":"married","accountBalance":5000}');
      console.log('\n' + '═'.repeat(70) + '\n');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\nShutting down...');
      await wrongWayExample.disconnect();
      await rightWayExample.disconnect();
      await significantExample.disconnect();
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

module.exports = { PropertySourcingExample, DomainDrivenEventsExample, BusinessSignificantEventsExample };
