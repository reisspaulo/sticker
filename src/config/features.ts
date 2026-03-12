/**
 * Feature Flags Configuration
 *
 * Controls which features are enabled/disabled at runtime.
 * Allows gradual rollout and easy rollback without code changes.
 */

export interface FeatureFlags {
  /**
   * USE_ZAPI: Switch WhatsApp API provider to Z-API
   *
   * - false: Use Evolution API + Avisa API (legacy)
   * - true: Use Z-API only
   *
   * Default: false
   */
  USE_ZAPI: boolean;

  /**
   * USE_META: Switch WhatsApp API provider to Meta Cloud API (official)
   *
   * - false: Use current provider (Evolution or Z-API)
   * - true: Use Meta Cloud API (official WhatsApp Business Platform)
   *
   * Takes precedence over USE_ZAPI when both are true.
   *
   * Default: false
   */
  USE_META: boolean;

  /**
   * ZAPI_WEBHOOK_ENABLED: Enable Z-API webhook endpoint
   *
   * - false: Only Evolution webhook active
   * - true: Both Evolution and Z-API webhooks active (transition period)
   *
   * Default: false
   */
  ZAPI_WEBHOOK_ENABLED: boolean;

  /**
   * META_WEBHOOK_ENABLED: Enable Meta Cloud API webhook endpoint
   *
   * - false: Meta webhook not active
   * - true: Meta webhook active at /webhook/meta
   *
   * Default: false
   */
  META_WEBHOOK_ENABLED: boolean;
}

/**
 * Load feature flags from environment variables
 */
function loadFeatureFlags(): FeatureFlags {
  return {
    USE_ZAPI: process.env.USE_ZAPI === 'true',
    USE_META: process.env.USE_META === 'true',
    ZAPI_WEBHOOK_ENABLED: process.env.ZAPI_WEBHOOK_ENABLED === 'true',
    META_WEBHOOK_ENABLED: process.env.META_WEBHOOK_ENABLED === 'true',
  };
}

// Export singleton instance
export const featureFlags = loadFeatureFlags();

/**
 * Log feature flags on startup for visibility
 */
export function logFeatureFlags(): void {
  console.log('🚩 Feature Flags:');
  console.log(
    `  USE_META: ${featureFlags.USE_META ? '✅ ENABLED' : '❌ DISABLED'} (Meta Cloud API)`
  );
  console.log(
    `  USE_ZAPI: ${featureFlags.USE_ZAPI ? '✅ ENABLED' : '❌ DISABLED'} (Z-API provider)`
  );
  console.log(
    `  META_WEBHOOK_ENABLED: ${featureFlags.META_WEBHOOK_ENABLED ? '✅ ENABLED' : '❌ DISABLED'} (Meta webhook)`
  );
  console.log(
    `  ZAPI_WEBHOOK_ENABLED: ${featureFlags.ZAPI_WEBHOOK_ENABLED ? '✅ ENABLED' : '❌ DISABLED'} (Z-API webhook)`
  );

  if (featureFlags.USE_META) {
    console.log('🟢 Meta Cloud API mode is ACTIVE - using official WhatsApp Business Platform');
  } else if (featureFlags.USE_ZAPI) {
    console.log('⚠️  Z-API mode is ACTIVE - using Z-API for all WhatsApp operations');
  } else {
    console.log('ℹ️  Evolution API mode is ACTIVE - using Evolution + Avisa APIs');
  }
}
