#!/usr/bin/env tsx

/**
 * Standalone Health Check Script
 * Can be run independently or via cron
 */

// Load environment variables FIRST
import { config } from 'dotenv';
config();

import { performHealthCheck } from '../src/services/healthCheck';
import { runAllAlertChecks } from '../src/services/alerting';
import logger from '../src/config/logger';

async function main() {
  try {
    logger.info('Running health check...');

    // Perform health check
    const health = await performHealthCheck();

    console.log('\n=== HEALTH CHECK RESULTS ===\n');
    console.log(`Overall Status: ${health.status.toUpperCase()}`);
    console.log(`Timestamp: ${health.timestamp}`);
    console.log('\nServices:');
    Object.entries(health.services).forEach(([name, status]) => {
      console.log(`  ${name}: ${status.status} ${status.responseTime ? `(${status.responseTime}ms)` : ''}`);
    });

    console.log('\nSystem:');
    console.log(`  Uptime: ${Math.floor(health.system.uptime / 60)} minutes`);
    console.log(`  Memory: ${health.system.memory.percentage.toFixed(1)}%`);
    console.log(`  Storage: ${health.system.storage.percentage.toFixed(1)}%`);

    if (health.alerts.length > 0) {
      console.log('\nAlerts:');
      health.alerts.forEach((alert) => {
        console.log(`  - ${alert}`);
      });
    }

    // Run alert checks
    logger.info('Running alert checks...');
    const alerts = await runAllAlertChecks();

    if (alerts.length > 0) {
      console.log('\n=== SYSTEM ALERTS ===\n');
      alerts.forEach((alert) => {
        console.log(`[${alert.type.toUpperCase()}] ${alert.category}: ${alert.message}`);
        if (alert.details) {
          console.log(`  Details: ${JSON.stringify(alert.details, null, 2)}`);
        }
      });
    } else {
      console.log('\n=== NO ALERTS ===\n');
    }

    // Exit with appropriate code
    if (health.status === 'unhealthy') {
      process.exit(1);
    } else if (health.status === 'degraded' || alerts.some(a => a.type === 'error')) {
      process.exit(2);
    } else {
      process.exit(0);
    }
  } catch (error) {
    logger.error({ error }, 'Health check script failed');
    console.error('Health check failed:', error);
    process.exit(1);
  }
}

main();
