import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import logger from '../config/logger';
import { getLinkByCode } from '../services/linkService';
import { recordClick, getClientIP } from '../services/clickService';

interface RedirectParams {
  code: string;
}

export default async function redirectRoutes(fastify: FastifyInstance) {
  // GET /:code - Redirect to original URL with tracking
  fastify.get(
    '/:code',
    async (request: FastifyRequest<{ Params: RedirectParams }>, reply: FastifyReply) => {
      const startTime = Date.now();
      const { code } = request.params;

      try {
        // Get link by code
        const link = await getLinkByCode(code);

        if (!link) {
          logger.warn({
            msg: 'Link not found for redirect',
            code,
          });

          // Return 404 page or redirect to main site
          return reply.status(404).send({
            error: 'Link not found',
            message: 'This link does not exist or has been deactivated',
          });
        }

        // Build final URL with UTM params if present
        let finalUrl = link.original_url;

        if (link.utm_source || link.utm_medium || link.utm_campaign || link.utm_content) {
          const url = new URL(link.original_url);
          if (link.utm_source) url.searchParams.set('utm_source', link.utm_source);
          if (link.utm_medium) url.searchParams.set('utm_medium', link.utm_medium);
          if (link.utm_campaign) url.searchParams.set('utm_campaign', link.utm_campaign);
          if (link.utm_content) url.searchParams.set('utm_content', link.utm_content);
          finalUrl = url.toString();
        }

        // Record click in background (don't await)
        const clientIP = getClientIP({
          headers: request.headers as Record<string, string | string[] | undefined>,
          ip: request.ip,
        });

        const refererHeader = request.headers['referer'] || request.headers['referrer'];
        const referer = Array.isArray(refererHeader) ? refererHeader[0] : refererHeader || null;

        recordClick({
          link_id: link.id,
          ip_address: clientIP,
          user_agent: request.headers['user-agent'] || null,
          referer,
        });

        const processingTime = Date.now() - startTime;

        logger.info({
          msg: 'Redirect processed',
          code,
          linkId: link.id,
          processingTime,
          clientIP: clientIP?.substring(0, 10) + '...', // Log partial IP for privacy
        });

        // Redirect to original URL
        return reply.redirect(302, finalUrl);
      } catch (error) {
        const processingTime = Date.now() - startTime;

        logger.error({
          msg: 'Error processing redirect',
          error: error instanceof Error ? error.message : 'Unknown error',
          code,
          processingTime,
        });

        // On error, still try to redirect if we have the URL
        return reply.status(500).send({
          error: 'Failed to process redirect',
          message: 'Please try again later',
        });
      }
    }
  );
}
