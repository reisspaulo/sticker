import { NextResponse } from 'next/server'

interface EvolutionConnectResponse {
  base64?: string
  pairingCode?: string
  code?: string
  instance?: {
    state?: string
  }
}

/**
 * GET /api/connections/evolution/qr
 * Get QR code for Evolution API reconnection
 */
export async function GET() {
  try {
    const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://your-evolution-api.com'
    const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY
    const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'meu-zap'

    if (!EVOLUTION_API_KEY) {
      return NextResponse.json(
        { error: 'EVOLUTION_API_KEY not configured' },
        { status: 500 }
      )
    }

    // First check if already connected
    const statusResponse = await fetch(
      `${EVOLUTION_API_URL}/instance/connectionState/${EVOLUTION_INSTANCE}`,
      {
        headers: { apikey: EVOLUTION_API_KEY },
      }
    )

    if (statusResponse.ok) {
      const statusData = await statusResponse.json()
      if (statusData?.instance?.state === 'open') {
        return NextResponse.json({
          alreadyConnected: true,
          message: 'Evolution API is already connected',
        })
      }
    }

    // Request QR code for connection
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(
      `${EVOLUTION_API_URL}/instance/connect/${EVOLUTION_INSTANCE}`,
      {
        headers: { apikey: EVOLUTION_API_KEY },
        signal: controller.signal,
      }
    )

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: `Failed to get QR code: ${response.status} - ${errorText}` },
        { status: response.status }
      )
    }

    const data: EvolutionConnectResponse = await response.json()

    if (!data.base64 && !data.code) {
      return NextResponse.json(
        { error: 'No QR code returned from API' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      qrCode: data.base64 || null,
      pairingCode: data.pairingCode || data.code || null,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error getting Evolution QR code:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get QR code' },
      { status: 500 }
    )
  }
}
