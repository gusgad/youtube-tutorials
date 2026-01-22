/**
 * STATE OBSESSION PITFALL - Event Modeling Anti-Pattern
 * 
 * This example demonstrates the "State Obsession" anti-pattern in Event Modeling.
 * State Obsession occurs when you model events around state changes instead of
 * what actually happened in the business. This leads to:
 * 
 * - Generic, meaningless events (BalanceUpdated instead of DepositRecorded)
 * - Loss of business context and intent
 * - Derived state instead of facts (storing balance instead of transaction amount)
 * - Inability to recreate what actually happened
 * - Problems with auditing and compliance
 * 
 * The mindset shift: Think "what happened" instead of "what is"
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
    clientId: 'state-obsession-demo-app',
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
// PITFALL 1: STATE OBSESSION (ANTI-PATTERN) - WRONG WAY
// ============================================================================
/**
 * The wrong way - modeling events around state changes instead of business facts.
 * Problems:
 * - Generic events that don't tell us what actually happened
 * - We lose important business context
 * - No way to understand the audit trail
 * - Difficult to debug or trace issues
 */
class StateObsessionExample {
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
   * WRONG: Modeling events around state change (balance updates)
   * We only emit a generic event that says "balance changed"
   * We lose all information about WHAT HAPPENED
   */
  async processTransactionsWrongWay(accountId, transactions) {
    console.log('\n[WRONG WAY] State Obsession (Anti-pattern)');
    console.log('━'.repeat(70));

    const events = [];
    let currentBalance = 0;
    const timestamp = new Date().toISOString();

    for (const transaction of transactions) {
      // Calculate new balance
      const amountDelta = transaction.type === 'deposit' 
        ? transaction.amount 
        : -transaction.amount;
      
      currentBalance += amountDelta;

      // WRONG: We only emit a generic state-change event
      events.push({
        eventType: 'BalanceUpdated', // Generic, meaningless
        accountId,
        balance: currentBalance, // Storing derived state, not the fact
        timestamp,
      });

      // Event published (generic balance update)
    }

    // Publish events
    const records = events.map(event => ({
      topic: 'bank-transactions',
      messages: [
        {
          key: accountId,
          value: JSON.stringify(event),
        },
      ],
    }));

    await this.producer.sendBatch({ topicMessages: records });

    console.log(`\n[PROBLEMS] PROBLEMS WITH THIS APPROACH:`);
    console.log('  1. We lost information about WHAT HAPPENED');
    console.log('  2. No business context - was it a deposit? withdrawal? transfer?');
    console.log('  3. We only have derived state (balance), not the facts (transactions)');
    console.log('  4. Impossible to audit or debug what actually occurred');
    console.log('  5. If balance calculation changes (taxes, fees), old events become useless');
    console.log('  6. No way to know the original transaction amount');
    console.log('  7. Consumers can\'t make business decisions based on event type\n');
  }

  /**
   * EVEN WORSE: Storing only the delta amount without transaction type
   * This is extremely dangerous for financial systems
   */
  async processTransactionsWrongWayV2(accountId, transactions) {
    console.log('\n[WORSE] State Obsession - Delta Only (Extremely Problematic)');
    console.log('━'.repeat(70));

    const events = [];
    let currentBalance = 0;
    const timestamp = new Date().toISOString();

    for (const transaction of transactions) {
      const amountDelta = transaction.type === 'deposit'
        ? transaction.amount
        : -transaction.amount;

      currentBalance += amountDelta;

      // EVEN WORSE: Generic event with only the delta
      events.push({
        eventType: 'BalanceUpdated',
        accountId,
        amountDelta, // We don't know if this is deposit or withdrawal
        newBalance: currentBalance,
        timestamp,
      });

      // Generic balance update sent (problematic)
    }

    console.log(`[SUMMARY] Sent ${transactions.length} generic 'BalanceUpdated' events instead of specific transaction events`);

    console.log(`\n[CRITICAL-PROBLEMS] CRITICAL PROBLEMS:`);
    console.log('  1. No information about transaction type');
    console.log('  2. Cannot identify fraud (unusual withdrawal patterns)');
    console.log('  3. Cannot handle regulatory requirements (transaction history)');
    console.log('  4. Cannot apply business rules (e.g., daily withdrawal limits)');
    console.log('  5. In case of error, cannot determine which transaction failed');
    console.log('  6. Compliance nightmare - no audit trail of actual events\n');
  }
}

// ============================================================================
// SOLUTION: BUSINESS-FACT EVENTS (CORRECT WAY)
// ============================================================================
/**
 * The right way - model events around business facts (what actually happened).
 * Each event represents a real, specific business operation.
 */
class BusinessFactEventsExample {
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
   * CORRECT: Model specific business events for each transaction type
   * Events represent FACTS about what happened
   */
  async processTransactionsRightWay(accountId, transactions) {
    console.log('\n[CORRECT] Business-Fact Events (Correct approach)');
    console.log('━'.repeat(70));

    const events = [];
    let currentBalance = 0;
    const timestamp = new Date().toISOString();

    for (const transaction of transactions) {
      let event;

      if (transaction.type === 'deposit') {
        currentBalance += transaction.amount;
        event = {
          eventType: 'DepositRecorded',
          accountId,
          amount: transaction.amount,
          balance: currentBalance,
          recordedAt: timestamp,
        };
      } else if (transaction.type === 'withdrawal') {
        currentBalance -= transaction.amount;
        event = {
          eventType: 'CashWithdrawnFromATM',
          accountId,
          amount: transaction.amount,
          balance: currentBalance,
          recordedAt: timestamp,
        };
      }

      events.push(event);
    }

    const records = events.map(event => ({
      topic: 'bank-transactions',
      messages: [
        {
          key: accountId,
          value: JSON.stringify(event),
          headers: {
            'event-type': event.eventType,
          },
        },
      ],
    }));

    await this.producer.sendBatch({ topicMessages: records });

    console.log(`[SUMMARY] Sent ${transactions.length} specific business-fact events`);
    console.log('  1. Events are FACTS - they represent what actually happened');
    console.log('  2. Clear business context - each event type tells a story');
    console.log('  3. Rich metadata - event has all relevant information for that operation');
    console.log('  4. Auditability - can reconstruct exactly what happened');
    console.log('  5. Business logic - consumers can act on specific events');
    console.log('  6. Fraud detection - can identify suspicious patterns');
    console.log('  7. Compliance - maintains complete transaction history');
    console.log('  8. Debuggability - can trace any issue to specific event\n');
  }
}

// ============================================================================
// PRAGMATIC APPROACH: Including Derived State for Performance
// ============================================================================
/**
 * In real systems, we can include derived state (like balance) in events
 * for optimization purposes, but it should never replace business facts.
 * The balance is supplementary information, not the primary event content.
 */
class PragmaticApproachExample {
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
   * PRAGMATIC: Include derived state as optimization, not replacement
   * The event still records the FACT, but includes helpful metadata
   */
  async processTransactionsPragmatically(accountId, transactions) {
    console.log('\n[PRAGMATIC] Business Facts + Derived State (Optimization)');
    console.log('━'.repeat(70));

    const events = [];
    let currentBalance = 0;
    const timestamp = new Date().toISOString();

    for (const transaction of transactions) {
      const previousBalance = currentBalance;

      if (transaction.type === 'deposit') {
        currentBalance += transaction.amount;
        const event = {
          eventType: 'DepositRecorded',
          accountId,
          amount: transaction.amount,
          previousBalance,
          currentBalance,
          recordedAt: timestamp,
        };
        events.push(event);
      }
    }

    const records = events.map(event => ({
      topic: 'bank-transactions',
      messages: [
        {
          key: accountId,
          value: JSON.stringify(event),
        },
      ],
    }));

    await this.producer.sendBatch({ topicMessages: records });

    console.log(`[SUMMARY] Sent ${transactions.length} events with pragmatic optimizations`);
  }
}

// ============================================================================
// EXPRESS API WITH DEMONSTRATIONS
// ============================================================================
const app = express();
app.use(express.json());

let wrongWayExample = new StateObsessionExample();
let rightWayExample = new BusinessFactEventsExample();
let pragmaticExample = new PragmaticApproachExample();

app.post('/demo/wrong-way', async (req, res) => {
  try {
    const { accountId, transactions } = req.body;

    await wrongWayExample.processTransactionsWrongWay(accountId, transactions);

    res.json({
      status: 'success',
      message: 'Events published (WRONG WAY - State Obsession)',
      pitfall: 'Generic state-change events without business context',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/demo/wrong-way-v2', async (req, res) => {
  try {
    const { accountId, transactions } = req.body;

    await wrongWayExample.processTransactionsWrongWayV2(accountId, transactions);

    res.json({
      status: 'success',
      message: 'Events published (WORSE - State Obsession V2)',
      pitfall: 'Delta-only events with no transaction type information',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/demo/right-way', async (req, res) => {
  try {
    const { accountId, transactions } = req.body;

    await rightWayExample.processTransactionsRightWay(accountId, transactions);

    res.json({
      status: 'success',
      message: 'Events published (CORRECT - Business Facts)',
      bestPractice: 'Specific events representing actual business operations',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/demo/pragmatic', async (req, res) => {
  try {
    const { accountId, transactions } = req.body;

    await pragmaticExample.processTransactionsPragmatically(accountId, transactions);

    res.json({
      status: 'success',
      message: 'Events published (PRAGMATIC - Facts + Optimization)',
      approach: 'Business facts as primary, derived state as optimization',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'state-obsession-demo' });
});

// ============================================================================
// STARTUP AND CLEANUP
// ============================================================================
const PORT = process.env.PORT || 3001;

async function startup() {
  try {
    console.log('\n' + '═'.repeat(70));
    console.log('STATE OBSESSION PITFALL - EVENT MODELING DEMONSTRATION');
    console.log('═'.repeat(70));

    console.log(`\nConnecting to Kafka brokers: ${MSK_BROKERS.join(', ')}`);

    const kafkaConfig = await getKafkaConfig();
    kafka = new Kafka(kafkaConfig);

    await wrongWayExample.init();
    await rightWayExample.init();
    await pragmaticExample.init();

    app.listen(PORT, () => {
      console.log(`\n[OK] Server running on http://localhost:${PORT}`);
      console.log('\n[ENDPOINTS] DEMO ENDPOINTS:\n');
      console.log('  1. Show WRONG way (Generic balance events):');
      console.log(`     POST http://localhost:${PORT}/demo/wrong-way`);
      console.log('     Body: {"accountId":"acc123","transactions":[');
      console.log('       {"type":"deposit","amount":50,"source":"wire_transfer"},');
      console.log('       {"type":"withdrawal","amount":20,"atmId":"atm456"}');
      console.log('     ]}');
      console.log('\n  2. Show WORSE way (Delta-only events):');
      console.log(`     POST http://localhost:${PORT}/demo/wrong-way-v2`);
      console.log('     (same body as wrong-way)');
      console.log('\n  3. Show CORRECT way (Business-fact events):');
      console.log(`     POST http://localhost:${PORT}/demo/right-way`);
      console.log('     (same body as wrong-way)');
      console.log('\n  4. Show PRAGMATIC way (Facts + derived state):');
      console.log(`     POST http://localhost:${PORT}/demo/pragmatic`);
      console.log('     (same body as wrong-way)');
      console.log('\n' + '═'.repeat(70) + '\n');
    });

    process.on('SIGINT', async () => {
      console.log('\n\nShutting down...');
      await wrongWayExample.disconnect();
      await rightWayExample.disconnect();
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

module.exports = { StateObsessionExample, BusinessFactEventsExample, PragmaticApproachExample };
