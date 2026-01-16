/**
 * Fastify Type Augmentation
 *
 * Extends default Fastify types to support custom configurations
 * used in the Sticker Bot project.
 */

declare module 'fastify' {
  /**
   * Extend FastifyContextConfig to support rawBody option
   *
   * Used in Stripe webhook endpoint to preserve raw request body
   * for signature verification (required by Stripe API).
   *
   * @see src/routes/stripeWebhook.ts
   * @see src/server.ts (custom content type parser)
   */
  interface FastifyContextConfig {
    /**
     * Preserve raw request body (Buffer) for signature verification
     *
     * When enabled, the custom content type parser in server.ts
     * will attach the raw body to request.rawBody before parsing JSON.
     *
     * @example
     * ```typescript
     * fastify.post('/webhook', {
     *   config: { rawBody: true }
     * }, async (request, reply) => {
     *   const rawBody = request.rawBody; // Buffer
     * });
     * ```
     */
    rawBody?: boolean;
  }

  /**
   * Extend FastifyRequest to include rawBody property
   *
   * Attached by custom content type parser when config.rawBody is true.
   */
  interface FastifyRequest {
    /**
     * Raw request body as Buffer
     *
     * Set by custom content type parser in server.ts
     * Only available when route config has rawBody: true
     */
    rawBody?: Buffer;
  }
}

export {};
