import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * POST /api/campaigns/[id]/test
 * Send a test message from a campaign to a specific number
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { whatsapp_number, step_order, variant } = body

    if (!whatsapp_number) {
      return NextResponse.json(
        { error: 'whatsapp_number is required' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Get step and message
    let stepQuery = supabase
      .from('campaign_steps')
      .select(`
        *,
        messages:campaign_messages(*)
      `)
      .eq('campaign_id', id)

    if (step_order !== undefined && step_order !== null) {
      stepQuery = stepQuery.eq('step_order', step_order)
    } else {
      stepQuery = stepQuery.eq('step_order', 0) // Default to first step
    }

    const { data: steps, error: stepError } = await stepQuery.limit(1)

    if (stepError || !steps || steps.length === 0) {
      return NextResponse.json(
        { error: 'No step found for campaign' },
        { status: 404 }
      )
    }

    const step = steps[0]
    const messages = step.messages || []

    // Find the message for the variant or default
    let message = messages.find((m: { variant: string }) => m.variant === (variant || 'default'))
    if (!message && messages.length > 0) {
      message = messages[0]
    }

    if (!message) {
      return NextResponse.json(
        { error: 'No message found for this step' },
        { status: 404 }
      )
    }

    // Format the number
    const formattedNumber = whatsapp_number.replace(/\D/g, '')

    // Prepare the test result (in production, this would call the actual messaging API)
    // For now, we simulate the test and return the message that would be sent
    const testResult = {
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        type: campaign.campaign_type,
      },
      step: {
        key: step.step_key,
        order: step.step_order,
        delay_hours: step.delay_hours,
      },
      message: {
        id: message.id,
        variant: message.variant,
        content_type: message.content_type,
        title: message.title,
        body: message.body,
        footer: message.footer,
        buttons: message.buttons,
      },
      recipient: formattedNumber,
      // In production: actual delivery status from Evolution/Avisa API
      delivery_status: 'simulated',
      note: 'Test mode - message preview only. In production, this would send the actual message.',
    }

    // Log the test event
    await supabase.from('campaign_events').insert({
      campaign_id: id,
      event_type: 'test_sent',
      metadata: {
        recipient: formattedNumber,
        step_key: step.step_key,
        variant: message.variant,
        sent_by: 'admin',
      },
    })

    return NextResponse.json(testResult)
  } catch (error) {
    console.error('Error sending test message:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send test message' },
      { status: 500 }
    )
  }
}
