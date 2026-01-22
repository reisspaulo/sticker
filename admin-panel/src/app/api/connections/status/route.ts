import { NextResponse } from 'next/server'

interface EvolutionStatusResponse {
  instance?: {
    state: string
    profileName?: string
    profilePictureUrl?: string
  }
}

interface AvisaStatusResponse {
  status?: boolean
  data?: {
    data?: {
      Connected?: boolean
      LoggedIn?: boolean
      Jid?: string
    }
  }
}

interface ConnectionResult {
  connected: boolean
  lastChecked: string
  details?: {
    state?: string
    profileName?: string
    profilePicture?: string
    jid?: string
    loggedIn?: boolean
  }
  error?: string
}

/**
 * Check Evolution API connection status
 */
async function checkEvolutionConnection(): Promise<ConnectionResult> {
  const lastChecked = new Date().toISOString()

  try {
    const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://your-evolution-api.com'
    const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY
    const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'meu-zap'

    if (!EVOLUTION_API_KEY) {
      return {
        connected: false,
        lastChecked,
        error: 'EVOLUTION_API_KEY not configured',
      }
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(
      `${EVOLUTION_API_URL}/instance/connectionState/${EVOLUTION_INSTANCE}`,
      {
        headers: { apikey: EVOLUTION_API_KEY },
        signal: controller.signal,
      }
    )

    clearTimeout(timeoutId)

    if (!response.ok) {
      return {
        connected: false,
        lastChecked,
        error: `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    const data: EvolutionStatusResponse = await response.json()
    const isConnected = data?.instance?.state === 'open'

    return {
      connected: isConnected,
      lastChecked,
      details: {
        state: data?.instance?.state,
        profileName: data?.instance?.profileName,
        profilePicture: data?.instance?.profilePictureUrl,
      },
    }
  } catch (error) {
    return {
      connected: false,
      lastChecked,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Check Avisa API connection status
 */
async function checkAvisaConnection(): Promise<ConnectionResult> {
  const lastChecked = new Date().toISOString()

  try {
    const AVISA_API_URL = process.env.AVISA_API_URL || 'https://www.avisaapi.com.br/api'
    const AVISA_API_TOKEN = process.env.AVISA_API_TOKEN

    if (!AVISA_API_TOKEN) {
      return {
        connected: false,
        lastChecked,
        error: 'AVISA_API_TOKEN not configured',
      }
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(`${AVISA_API_URL}/instance/status`, {
      headers: { Authorization: `Bearer ${AVISA_API_TOKEN}` },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return {
        connected: false,
        lastChecked,
        error: `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    const data: AvisaStatusResponse = await response.json()
    // Avisa API must be both Connected AND LoggedIn to be truly connected
    const isConnected = data?.data?.data?.Connected === true && data?.data?.data?.LoggedIn === true

    return {
      connected: isConnected,
      lastChecked,
      details: {
        state: isConnected ? 'connected' : 'disconnected',
        loggedIn: data?.data?.data?.LoggedIn,
        jid: data?.data?.data?.Jid,
      },
    }
  } catch (error) {
    return {
      connected: false,
      lastChecked,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * GET /api/connections/status
 * Returns the connection status of both WhatsApp APIs
 */
export async function GET() {
  try {
    // Check both APIs in parallel
    const [evolution, avisa] = await Promise.all([
      checkEvolutionConnection(),
      checkAvisaConnection(),
    ])

    return NextResponse.json({
      evolution,
      avisa,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error checking connections:', error)
    return NextResponse.json(
      { error: 'Failed to check connections' },
      { status: 500 }
    )
  }
}
