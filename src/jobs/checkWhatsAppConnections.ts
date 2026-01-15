import axios from 'axios';
import logger from '../config/logger';
import {
  alertWhatsAppDisconnected,
  alertWhatsAppReconnected,
} from '../services/alertService';

// Track previous connection state to detect changes
let previousEvolutionState: boolean | null = null;
let previousAvisaState: boolean | null = null;

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
 * Main job function - Check both WhatsApp API connections
 * Sends alerts when connection state changes
 */
export async function checkWhatsAppConnectionsJob(): Promise<void> {
  logger.info({ msg: '[CONNECTION_CHECK] Starting WhatsApp connection check' });

  try {
    // Check both APIs in parallel
    const [evolutionConnected, avisaConnected] = await Promise.all([
      checkEvolutionConnection(),
      checkAvisaConnection(),
    ]);

    // Evolution API state change detection
    if (previousEvolutionState !== null) {
      if (previousEvolutionState && !evolutionConnected) {
        // Was connected, now disconnected
        logger.warn({ msg: '[CONNECTION_CHECK] Evolution API DISCONNECTED!' });
        await alertWhatsAppDisconnected('evolution');
      } else if (!previousEvolutionState && evolutionConnected) {
        // Was disconnected, now connected
        logger.info({ msg: '[CONNECTION_CHECK] Evolution API RECONNECTED!' });
        await alertWhatsAppReconnected('evolution');
      }
    }
    previousEvolutionState = evolutionConnected;

    // Avisa API state change detection
    if (previousAvisaState !== null) {
      if (previousAvisaState && !avisaConnected) {
        // Was connected, now disconnected
        logger.warn({ msg: '[CONNECTION_CHECK] Avisa API DISCONNECTED!' });
        await alertWhatsAppDisconnected('avisa');
      } else if (!previousAvisaState && avisaConnected) {
        // Was disconnected, now connected
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
  evolution: { connected: boolean; checked: boolean };
  avisa: { connected: boolean; checked: boolean };
  timestamp: string;
}> {
  const [evolutionConnected, avisaConnected] = await Promise.all([
    checkEvolutionConnection(),
    checkAvisaConnection(),
  ]);

  return {
    evolution: { connected: evolutionConnected, checked: true },
    avisa: { connected: avisaConnected, checked: true },
    timestamp: new Date().toISOString(),
  };
}
