import { FastifyRequest, FastifyReply } from 'fastify';

export async function validateApiKey(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const apiKey = request.headers['apikey'] as string;
  const expectedApiKey = process.env.EVOLUTION_API_KEY;

  if (!expectedApiKey) {
    request.log.error('EVOLUTION_API_KEY not configured in environment');
    return reply.status(500).send({
      status: 'error',
      error: 'Server configuration error',
    });
  }

  if (!apiKey) {
    request.log.warn('Webhook request without API key');
    return reply.status(401).send({
      status: 'error',
      error: 'Missing API key',
      message: 'API key must be provided in the "apikey" header',
    });
  }

  if (apiKey !== expectedApiKey) {
    request.log.warn({ providedKey: apiKey.slice(0, 10) + '...' }, 'Invalid API key');
    return reply.status(403).send({
      status: 'error',
      error: 'Invalid API key',
    });
  }

  // API key is valid, continue
}
