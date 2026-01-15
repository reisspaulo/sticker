import { NextResponse } from 'next/server'

interface AvisaQRResponse {
  status?: boolean
  data?: {
    data?: {
      QRCode?: string
    }
  }
  message?: string
}

interface AvisaStatusResponse {
  status?: boolean
  data?: {
    data?: {
      Connected?: boolean
      LoggedIn?: boolean
    }
  }
}

/**
 * GET /api/connections/avisa/qr
 * Get QR code for Avisa API reconnection
 */
export async function GET() {
  try {
    const AVISA_API_URL = process.env.AVISA_API_URL || 'https://www.avisaapi.com.br/api'
    const AVISA_API_TOKEN = process.env.AVISA_API_TOKEN

    if (!AVISA_API_TOKEN) {
      return NextResponse.json(
        { error: 'AVISA_API_TOKEN not configured' },
        { status: 500 }
      )
    }

    // First check if already connected
    const statusResponse = await fetch(`${AVISA_API_URL}/instance/status`, {
      headers: { Authorization: `Bearer ${AVISA_API_TOKEN}` },
    })

    if (statusResponse.ok) {
      const statusData: AvisaStatusResponse = await statusResponse.json()
      if (statusData?.data?.data?.Connected === true) {
        return NextResponse.json({
          alreadyConnected: true,
          message: 'Avisa API is already connected',
        })
      }
    }

    // Request QR code for connection
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(`${AVISA_API_URL}/instance/qr`, {
      headers: { Authorization: `Bearer ${AVISA_API_TOKEN}` },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: `Failed to get QR code: ${response.status} - ${errorText}` },
        { status: response.status }
      )
    }

    const data: AvisaQRResponse = await response.json()

    // Avisa API returns QR code in different formats
    const qrCode = data?.data?.data?.QRCode || null

    if (!qrCode) {
      return NextResponse.json(
        { error: 'No QR code returned from API. The instance may need to be restarted.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      qrCode,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error getting Avisa QR code:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get QR code' },
      { status: 500 }
    )
  }
}
