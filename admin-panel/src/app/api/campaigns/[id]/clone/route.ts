import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * POST /api/campaigns/[id]/clone
 * Clone a campaign with all its steps and messages
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, clone_messages = true, clone_settings = true } = body

    if (!name) {
      return NextResponse.json(
        { error: 'name is required for the new campaign' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get original campaign
    const { data: original, error: originalError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single()

    if (originalError || !original) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Check if name already exists
    const { data: existing } = await supabase
      .from('campaigns')
      .select('id')
      .eq('name', name)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'A campaign with this name already exists' },
        { status: 400 }
      )
    }

    // Create new campaign
    const newCampaign = {
      name,
      description: `Clone of ${original.name}`,
      campaign_type: original.campaign_type,
      trigger_config: original.trigger_config,
      target_filter: original.target_filter,
      cancel_condition: original.cancel_condition,
      status: 'draft', // Always start as draft
      priority: original.priority,
      max_users: original.max_users,
      settings: clone_settings ? original.settings : null,
      cloned_from: id,
      created_by: 'admin',
    }

    const { data: cloned, error: clonedError } = await supabase
      .from('campaigns')
      .insert(newCampaign)
      .select()
      .single()

    if (clonedError) {
      throw clonedError
    }

    // Clone steps
    const { data: originalSteps, error: stepsError } = await supabase
      .from('campaign_steps')
      .select('*')
      .eq('campaign_id', id)
      .order('step_order', { ascending: true })

    if (stepsError) {
      throw stepsError
    }

    const stepIdMap: Record<string, string> = {}

    for (const step of originalSteps || []) {
      const newStep = {
        campaign_id: cloned.id,
        step_order: step.step_order,
        step_key: step.step_key,
        delay_hours: step.delay_hours,
        send_window: step.send_window,
        variants: step.variants,
        variant_weights: step.variant_weights,
      }

      const { data: clonedStep, error: stepInsertError } = await supabase
        .from('campaign_steps')
        .insert(newStep)
        .select()
        .single()

      if (stepInsertError) {
        console.error('Error cloning step:', stepInsertError)
        continue
      }

      stepIdMap[step.id] = clonedStep.id

      // Clone messages for this step
      if (clone_messages) {
        const { data: originalMessages, error: messagesError } = await supabase
          .from('campaign_messages')
          .select('*')
          .eq('step_id', step.id)

        if (messagesError) {
          console.error('Error fetching messages:', messagesError)
          continue
        }

        for (const message of originalMessages || []) {
          const newMessage = {
            step_id: clonedStep.id,
            variant: message.variant,
            content_type: message.content_type,
            title: message.title,
            body: message.body,
            footer: message.footer,
            buttons: message.buttons,
            media: message.media,
          }

          await supabase.from('campaign_messages').insert(newMessage)
        }
      }
    }

    return NextResponse.json({
      success: true,
      campaign: cloned,
      steps_cloned: Object.keys(stepIdMap).length,
      messages_cloned: clone_messages,
    })
  } catch (error) {
    console.error('Error cloning campaign:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to clone campaign' },
      { status: 500 }
    )
  }
}
