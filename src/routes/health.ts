import { FastifyInstance } from 'fastify';
import { performHealthCheck, quickHealthCheck } from '../services/healthCheck';
import { runAllAlertChecks } from '../services/alerting';
import { getErrorStats, clearErrorCounters } from '../services/alertService';
import { messageRateLimiter } from '../utils/messageRateLimiter';

export default async function healthRoutes(fastify: FastifyInstance) {
  // Comprehensive health check endpoint
  fastify.get('/health', async (_request, reply) => {
    try {
      const health = await performHealthCheck();

      const statusCode =
        health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

      return reply.status(statusCode).send({
        ...health,
        version: '1.0.3',
        git_sha: process.env.GIT_COMMIT_SHA || 'unknown',
        deployed_at: process.env.DEPLOYED_AT || 'unknown',
      });
    } catch (error) {
      fastify.log.error({ msg: 'Health check failed', error });
      return reply.status(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: (error as Error).message,
      });
    }
  });

  // Quick ping endpoint
  fastify.get('/ping', async (_request, reply) => {
    const isHealthy = await quickHealthCheck();
    return reply.status(isHealthy ? 200 : 503).send({
      pong: isHealthy,
      timestamp: new Date().toISOString(),
    });
  });

  // Alerts endpoint
  fastify.get('/alerts', async (_request, reply) => {
    try {
      const alerts = await runAllAlertChecks();

      return reply.status(200).send({
        alerts,
        count: alerts.length,
        errors: alerts.filter((a) => a.type === 'error').length,
        warnings: alerts.filter((a) => a.type === 'warning').length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      fastify.log.error({ msg: 'Failed to run alert checks', error });
      return reply.status(500).send({
        error: 'Failed to run alert checks',
        message: (error as Error).message,
      });
    }
  });

  // RPC Error Statistics endpoint (new monitoring)
  fastify.get('/health/errors', async (_request, reply) => {
    try {
      const stats = getErrorStats();

      return reply.status(200).send({
        timestamp: new Date().toISOString(),
        errorStats: stats,
        totalErrorTypes: Object.keys(stats).length,
        summary: {
          activeErrors: Object.values(stats).reduce(
            (sum: number, stat: any) => sum + stat.count,
            0
          ),
          errorTypes: Object.keys(stats),
        },
      });
    } catch (error) {
      return reply.status(500).send({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Message Rate Limiter Stats endpoint (ANTI-SPAM monitoring)
  fastify.get('/health/rate-limiter', async (_request, reply) => {
    try {
      const stats = messageRateLimiter.getStats();

      // Determine health status based on queue size
      let status = 'healthy';
      if (stats.queueSize > 100) status = 'critical';
      else if (stats.queueSize > 50) status = 'warning';
      else if (stats.queueSize > 10) status = 'degraded';

      return reply.status(200).send({
        timestamp: new Date().toISOString(),
        status,
        rateLimiter: {
          ...stats,
          limit: 60, // messages per minute
          utilizationPercent: Math.round((stats.messagesInLastMinute / 60) * 100),
        },
        alerts: [
          ...(stats.queueSize > 100
            ? [
                {
                  severity: 'critical',
                  message: `Critical: ${stats.queueSize} messages queued. Possible burst attack.`,
                },
              ]
            : []),
          ...(stats.queueSize > 50
            ? [
                {
                  severity: 'warning',
                  message: `Warning: ${stats.queueSize} messages queued. High volume detected.`,
                },
              ]
            : []),
          ...(stats.messagesInLastMinute >= 60
            ? [
                {
                  severity: 'info',
                  message: 'Rate limit reached (60 msgs/min). Messages are being queued.',
                },
              ]
            : []),
        ],
      });
    } catch (error) {
      return reply.status(500).send({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Clear error counters endpoint (admin only)
  fastify.post('/health/errors/clear', async (request, reply) => {
    try {
      const adminToken = request.headers['x-admin-token'];
      const expectedToken = process.env.ADMIN_TOKEN || 'change-me-in-production';

      if (adminToken !== expectedToken) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid admin token',
        });
      }

      clearErrorCounters();

      fastify.log.info({ msg: 'Error counters manually cleared by admin' });

      return reply.status(200).send({
        status: 'ok',
        message: 'Error counters cleared successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return reply.status(500).send({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
