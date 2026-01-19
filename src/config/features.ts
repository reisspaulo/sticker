/**
 * Feature Flags Configuration
 *
 * Controls which features are enabled/disabled at runtime.
 * Allows gradual rollout and easy rollback without code changes.
 */

export interface FeatureFlags {
  /**
   * USE_ZAPI: Switch WhatsApp API provider
   *
   * - false: Use Evolution API + Avisa API (current)
   * - true: Use Z-API only (migration target)
   *
   * Default: false (safe default - keep current behavior)
   */
  USE_ZAPI: boolean;

  /**
   * ZAPI_WEBHOOK_ENABLED: Enable Z-API webhook endpoint
   *
   * - false: Only Evolution webhook active
   * - true: Both Evolution and Z-API webhooks active (transition period)
   *
   * Default: false
   */
  ZAPI_WEBHOOK_ENABLED: boolean;
}

/**
 * Load feature flags from environment variables
 */
function loadFeatureFlags(): FeatureFlags {
  return {
    USE_ZAPI: process.env.USE_ZAPI === 'true',
    ZAPI_WEBHOOK_ENABLED: process.env.ZAPI_WEBHOOK_ENABLED === 'true',
  };
}

// Export singleton instance
export const featureFlags = loadFeatureFlags();

/**
 * Log feature flags on startup for visibility
 */
export function logFeatureFlags(): void {
  console.log('🚩 Feature Flags:');
  console.log(`  USE_ZAPI: ${featureFlags.USE_ZAPI ? '✅ ENABLED' : '❌ DISABLED'} (WhatsApp API provider)`);
  console.log(
    `  ZAPI_WEBHOOK_ENABLED: ${featureFlags.ZAPI_WEBHOOK_ENABLED ? '✅ ENABLED' : '❌ DISABLED'} (Z-API webhook)`
  );

  if (featureFlags.USE_ZAPI) {
    console.log('⚠️  Z-API mode is ACTIVE - using Z-API for all WhatsApp operations');
  } else {
    console.log('ℹ️  Evolution API mode is ACTIVE - using Evolution + Avisa APIs');
  }
}
