import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import logger from '../config/logger';
import {
  createLink,
  getLinkById,
  listLinks,
  updateLink,
  deleteLink,
  getLinkStats,
  getLinksOverview,
} from '../services/linkService';
import type { CreateLinkInput, UpdateLinkInput } from '../types/links';

// Request body types
interface CreateLinkBody {
  original_url: string;
  title?: string;
  short_code?: string;
  campaign_id?: string;
  step_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
}

interface UpdateLinkBody {
  title?: string;
  short_code?: string;
  is_active?: boolean;
}

interface ListLinksQuery {
  page?: string;
  limit?: string;
  search?: string;
  campaign_id?: string;
  sort?: 'clicks_count' | 'created_at';
  order?: 'asc' | 'desc';
}

interface LinkParams {
  id: string;
}

export default async function linksRoutes(fastify: FastifyInstance) {
  // GET /links - List all links
  fastify.get(
    '/',
    async (request: FastifyRequest<{ Querystring: ListLinksQuery }>, reply: FastifyReply) => {
      try {
        const { page, limit, search, campaign_id, sort, order } = request.query;

        const result = await listLinks({
          page: page ? parseInt(page, 10) : undefined,
          limit: limit ? parseInt(limit, 10) : undefined,
          search,
          campaign_id,
          sort,
          order,
        });

        return reply.status(200).send(result);
      } catch (error) {
        logger.error({
          msg: 'Error listing links',
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        return reply.status(500).send({
          error: 'Failed to list links',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // GET /links/overview - Get overview stats
  fastify.get('/overview', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const overview = await getLinksOverview();
      return reply.status(200).send(overview);
    } catch (error) {
      logger.error({
        msg: 'Error getting links overview',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return reply.status(500).send({
        error: 'Failed to get overview',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // GET /links/:id - Get link by ID
  fastify.get(
    '/:id',
    async (request: FastifyRequest<{ Params: LinkParams }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        const link = await getLinkById(id);
        if (!link) {
          return reply.status(404).send({ error: 'Link not found' });
        }

        return reply.status(200).send(link);
      } catch (error) {
        logger.error({
          msg: 'Error getting link',
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        return reply.status(500).send({
          error: 'Failed to get link',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // GET /links/:id/stats - Get link statistics
  fastify.get(
    '/:id/stats',
    async (
      request: FastifyRequest<{ Params: LinkParams; Querystring: { days?: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const days = request.query.days ? parseInt(request.query.days, 10) : 30;

        // First check if link exists
        const link = await getLinkById(id);
        if (!link) {
          return reply.status(404).send({ error: 'Link not found' });
        }

        const stats = await getLinkStats(id, days);

        return reply.status(200).send({
          link,
          stats,
        });
      } catch (error) {
        logger.error({
          msg: 'Error getting link stats',
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        return reply.status(500).send({
          error: 'Failed to get link stats',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // POST /links - Create new link
  fastify.post(
    '/',
    async (request: FastifyRequest<{ Body: CreateLinkBody }>, reply: FastifyReply) => {
      try {
        const input: CreateLinkInput = request.body;

        if (!input.original_url) {
          return reply.status(400).send({ error: 'original_url is required' });
        }

        const link = await createLink(input);

        return reply.status(201).send(link);
      } catch (error) {
        logger.error({
          msg: 'Error creating link',
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        const message = error instanceof Error ? error.message : 'Unknown error';

        // Return 400 for validation errors
        if (
          message.includes('Invalid') ||
          message.includes('already in use') ||
          message.includes('format')
        ) {
          return reply.status(400).send({ error: message });
        }

        return reply.status(500).send({
          error: 'Failed to create link',
          message,
        });
      }
    }
  );

  // PATCH /links/:id - Update link
  fastify.patch(
    '/:id',
    async (
      request: FastifyRequest<{ Params: LinkParams; Body: UpdateLinkBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const input: UpdateLinkInput = request.body;

        // Check if link exists
        const existingLink = await getLinkById(id);
        if (!existingLink) {
          return reply.status(404).send({ error: 'Link not found' });
        }

        const link = await updateLink(id, input);

        return reply.status(200).send(link);
      } catch (error) {
        logger.error({
          msg: 'Error updating link',
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        const message = error instanceof Error ? error.message : 'Unknown error';

        if (message.includes('Invalid') || message.includes('already in use')) {
          return reply.status(400).send({ error: message });
        }

        return reply.status(500).send({
          error: 'Failed to update link',
          message,
        });
      }
    }
  );

  // DELETE /links/:id - Deactivate link
  fastify.delete(
    '/:id',
    async (request: FastifyRequest<{ Params: LinkParams }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        // Check if link exists
        const existingLink = await getLinkById(id);
        if (!existingLink) {
          return reply.status(404).send({ error: 'Link not found' });
        }

        await deleteLink(id);

        return reply.status(204).send();
      } catch (error) {
        logger.error({
          msg: 'Error deleting link',
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        return reply.status(500).send({
          error: 'Failed to delete link',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );
}
