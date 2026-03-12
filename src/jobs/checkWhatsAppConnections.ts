import axios from 'axios';
import logger from '../config/logger';
import { alertWhatsAppDisconnected, alertWhatsAppReconnected } from '../services/alertService';
import { featureFlags } from '../config/features';

// Track previous connection state to detect changes
let previousEvolutionState: boolean | null = null;
let previousAvisaState: boolean | null = null;
let previousMetaState: boolean | null = null;

interface EvolutionStatusResponse {
  instance?: {
    state: string;
  };
}

interface AvisaStatusResponse {
  status?: boolean;
  data?: {
    data?: {
      Connected?: boolean;
      LoggedIn?: boolean;
    };
  };
}

/**
 * Check Evolution API connection status
 */
async function checkEvolutionConnection(): Promise<boolean> {
  try {
    const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
    const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
    const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'meu-zap';

    if (!EVOLUTION_API_KEY) {
      logger.warn({ msg: '[CONNECTION_CHECK] EVOLUTION_API_KEY not set, skipping check' });
      return true; // Don't alert if not configured
    }

    const response = await axios.get<EvolutionStatusResponse>(
      `${EVOLUTION_API_URL}/instance/connectionState/${EVOLUTION_INSTANCE}`,
      {
        headers: { apikey: EVOLUTION_API_KEY },
        timeout: 10000,
      }
    );

    const isConnected = response.data?.instance?.state === 'open';

    logger.debug({
      msg: '[CONNECTION_CHECK] Evolution API status',
      state: response.data?.instance?.state,
      isConnected,
    });

    return isConnected;
  } catch (error) {
    logger.error({
      msg: '[CONNECTION_CHECK] Failed to check Evolution API',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Check Avisa API connection status
 */
async function checkAvisaConnection(): Promise<boolean> {
  try {
    const AVISA_API_URL = process.env.AVISA_API_URL || 'https://www.avisaapi.com.br/api';
    const AVISA_API_TOKEN = process.env.AVISA_API_TOKEN;

    if (!AVISA_API_TOKEN) {
      logger.warn({ msg: '[CONNECTION_CHECK] AVISA_API_TOKEN not set, skipping check' });
      return true; // Don't alert if not configured
    }

    const response = await axios.get<AvisaStatusResponse>(`${AVISA_API_URL}/instance/status`, {
      headers: { Authorization: `Bearer ${AVISA_API_TOKEN}` },
      timeout: 10000,
    });

    const isConnected = response.data?.data?.data?.Connected === true;

    logger.debug({
      msg: '[CONNECTION_CHECK] Avisa API status',
      connected: response.data?.data?.data?.Connected,
      loggedIn: response.data?.data?.data?.LoggedIn,
      isConnected,
    });

    return isConnected;
  } catch (error) {
    logger.error({
      msg: '[CONNECTION_CHECK] Failed to check Avisa API',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Check Meta Cloud API connection status
 */
async function checkMetaConnection(): Promise<boolean> {
  try {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.META_API_VERSION || 'v22.0';

    if (!accessToken || !phoneNumberId) {
      logger.warn({ msg: '[CONNECTION_CHECK] Meta API credentials not set, skipping check' });
      return false;
    }

    const response = await axios.get(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      }
    );

    const isConnected = !!response.data?.id;

    logger.debug({
      msg: '[CONNECTION_CHECK] Meta Cloud API status',
      phoneNumberId: response.data?.id,
      displayName: response.data?.verified_name || response.data?.display_phone_number,
      isConnected,
    });

    return isConnected;
  } catch (error) {
    logger.error({
      msg: '[CONNECTION_CHECK] Failed to check Meta Cloud API',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Main job function - Check WhatsApp API connections based on active provider
 * Sends alerts when connection state changes
 */
export async function checkWhatsAppConnectionsJob(): Promise<void> {
  logger.info({ msg: '[CONNECTION_CHECK] Starting WhatsApp connection check' });

  try {
    // When using Meta Cloud API, only check Meta - skip legacy providers
    if (featureFlags.USE_META) {
      const metaConnected = await checkMetaConnection();

      if (previousMetaState !== null) {
        if (previousMetaState && !metaConnected) {
          logger.warn({ msg: '[CONNECTION_CHECK] Meta Cloud API DISCONNECTED!' });
          await alertWhatsAppDisconnected('meta');
        } else if (!previousMetaState && metaConnected) {
          logger.info({ msg: '[CONNECTION_CHECK] Meta Cloud API RECONNECTED!' });
          await alertWhatsAppReconnected('meta');
        }
      }
      previousMetaState = metaConnected;

      logger.info({
        msg: '[CONNECTION_CHECK] WhatsApp connection check completed',
        provider: 'meta',
        meta: metaConnected ? 'connected' : 'disconnected',
      });
      return;
    }

    // Legacy: Check Evolution + Avisa APIs in parallel
    const [evolutionConnected, avisaConnected] = await Promise.all([
      checkEvolutionConnection(),
      checkAvisaConnection(),
    ]);

    // Evolution API state change detection
    if (previousEvolutionState !== null) {
      if (previousEvolutionState && !evolutionConnected) {
        logger.warn({ msg: '[CONNECTION_CHECK] Evolution API DISCONNECTED!' });
        await alertWhatsAppDisconnected('evolution');
      } else if (!previousEvolutionState && evolutionConnected) {
        logger.info({ msg: '[CONNECTION_CHECK] Evolution API RECONNECTED!' });
        await alertWhatsAppReconnected('evolution');
      }
    }
    previousEvolutionState = evolutionConnected;

    // Avisa API state change detection
    if (previousAvisaState !== null) {
      if (previousAvisaState && !avisaConnected) {
        logger.warn({ msg: '[CONNECTION_CHECK] Avisa API DISCONNECTED!' });
        await alertWhatsAppDisconnected('avisa');
      } else if (!previousAvisaState && avisaConnected) {
        logger.info({ msg: '[CONNECTION_CHECK] Avisa API RECONNECTED!' });
        await alertWhatsAppReconnected('avisa');
      }
    }
    previousAvisaState = avisaConnected;

    logger.info({
      msg: '[CONNECTION_CHECK] WhatsApp connection check completed',
      evolution: evolutionConnected ? 'connected' : 'disconnected',
      avisa: avisaConnected ? 'connected' : 'disconnected',
    });
  } catch (error) {
    logger.error({
      msg: '[CONNECTION_CHECK] Error during connection check',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get current connection status (for API/dashboard)
 */
export async function getConnectionStatus(): Promise<{
  provider: string;
  meta?: { connected: boolean; checked: boolean };
  evolution?: { connected: boolean; checked: boolean };
  avisa?: { connected: boolean; checked: boolean };
  timestamp: string;
}> {
  if (featureFlags.USE_META) {
    const metaConnected = await checkMetaConnection();
    return {
      provider: 'meta',
      meta: { connected: metaConnected, checked: true },
      timestamp: new Date().toISOString(),
    };
  }

  const [evolutionConnected, avisaConnected] = await Promise.all([
    checkEvolutionConnection(),
    checkAvisaConnection(),
  ]);

  return {
    provider: featureFlags.USE_ZAPI ? 'zapi' : 'evolution',
    evolution: { connected: evolutionConnected, checked: true },
    avisa: { connected: avisaConnected, checked: true },
    timestamp: new Date().toISOString(),
  };
}
