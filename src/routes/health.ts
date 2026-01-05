import { FastifyInstance } from 'fastify';
import { performHealthCheck, quickHealthCheck } from '../services/healthCheck';
import { runAllAlertChecks } from '../services/alerting';

export default async function healthRoutes(fastify: FastifyInstance) {
  // Comprehensive health check endpoint
  fastify.get('/health', async (_request, reply) => {
    try {
      const health = await performHealthCheck();

      const statusCode =
        health.status === 'healthy' ? 200 :
        health.status === 'degraded' ? 200 :
        503;

      return reply.status(statusCode).send({
        ...health,
        version: '1.0.1', // Test zero-downtime deployment
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
        errors: alerts.filter(a => a.type === 'error').length,
        warnings: alerts.filter(a => a.type === 'warning').length,
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
}
