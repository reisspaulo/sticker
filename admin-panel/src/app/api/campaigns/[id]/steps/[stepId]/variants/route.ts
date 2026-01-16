import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface RouteParams {
  params: Promise<{ id: string; stepId: string }>
}

/**
 * GET /api/campaigns/[id]/steps/[stepId]/variants
 * Get all variants for a step
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id, stepId } = await params
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get step with variants
    const { data: step, error: stepError } = await supabase
      .from('campaign_steps')
      .select('id, step_key, variants, variant_weights')
      .eq('id', stepId)
      .eq('campaign_id', id)
      .single()

    if (stepError) {
      throw stepError
    }

    // Get messages for this step (each variant)
    const { data: messages, error: messagesError } = await supabase
      .from('campaign_messages')
      .select('*')
      .eq('step_id', stepId)
      .order('variant')

    if (messagesError) {
      throw messagesError
    }

    return NextResponse.json({
      step,
      messages: messages || [],
      variants: step?.variants || ['default'],
      weights: step?.variant_weights || { default: 100 },
    })
  } catch (error) {
    console.error('Error fetching variants:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao buscar variantes' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/campaigns/[id]/steps/[stepId]/variants
 * Add a new variant to a step
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id, stepId } = await params
    const body = await request.json()
    const { variant_name, message, weight } = body

    if (!variant_name) {
      return NextResponse.json(
        { error: 'Nome da variante é obrigatório' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get current step
    const { data: step, error: stepError } = await supabase
      .from('campaign_steps')
      .select('variants, variant_weights')
      .eq('id', stepId)
      .eq('campaign_id', id)
      .single()

    if (stepError) {
      throw stepError
    }

    // Update variants array
    const currentVariants = step?.variants || ['default']
    if (currentVariants.includes(variant_name)) {
      return NextResponse.json(
        { error: 'Variante já existe' },
        { status: 400 }
      )
    }

    const newVariants = [...currentVariants, variant_name]

    // Update weights
    const currentWeights = step?.variant_weights || { default: 100 }
    const newWeight = weight || Math.floor(100 / newVariants.length)

    // Redistribute weights
    const totalWeight = 100
    const weightPerVariant = Math.floor(totalWeight / newVariants.length)
    const newWeights: Record<string, number> = {}

    newVariants.forEach((v, i) => {
      if (i === newVariants.length - 1) {
        // Last variant gets the remainder
        newWeights[v] = totalWeight - (weightPerVariant * (newVariants.length - 1))
      } else {
        newWeights[v] = weightPerVariant
      }
    })

    // Update step
    const { error: updateError } = await supabase
      .from('campaign_steps')
      .update({
        variants: newVariants,
        variant_weights: newWeights,
        updated_at: new Date().toISOString(),
      })
      .eq('id', stepId)

    if (updateError) {
      throw updateError
    }

    // Create message for the new variant
    if (message) {
      const { error: messageError } = await supabase
        .from('campaign_messages')
        .insert({
          step_id: stepId,
          variant: variant_name,
          content_type: message.content_type || 'text',
          title: message.title || '',
          body: message.body || '',
          footer: message.footer || null,
          buttons: message.buttons || null,
        })

      if (messageError) {
        throw messageError
      }
    }

    return NextResponse.json({
      success: true,
      variants: newVariants,
      weights: newWeights,
    })
  } catch (error) {
    console.error('Error adding variant:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao adicionar variante' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/campaigns/[id]/steps/[stepId]/variants
 * Update variant weights
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id, stepId } = await params
    const body = await request.json()
    const { weights } = body

    if (!weights || typeof weights !== 'object') {
      return NextResponse.json(
        { error: 'Pesos das variantes são obrigatórios' },
        { status: 400 }
      )
    }

    // Validate weights sum to 100
    const totalWeight = Object.values(weights as Record<string, number>).reduce((sum, w) => sum + w, 0)
    if (totalWeight !== 100) {
      return NextResponse.json(
        { error: 'A soma dos pesos deve ser 100%' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { error } = await supabase
      .from('campaign_steps')
      .update({
        variant_weights: weights,
        updated_at: new Date().toISOString(),
      })
      .eq('id', stepId)
      .eq('campaign_id', id)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, weights })
  } catch (error) {
    console.error('Error updating weights:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao atualizar pesos' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/campaigns/[id]/steps/[stepId]/variants
 * Remove a variant from a step
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id, stepId } = await params
    const { searchParams } = new URL(request.url)
    const variantName = searchParams.get('variant')

    if (!variantName) {
      return NextResponse.json(
        { error: 'Nome da variante é obrigatório' },
        { status: 400 }
      )
    }

    if (variantName === 'default') {
      return NextResponse.json(
        { error: 'Não é possível remover a variante default' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get current step
    const { data: step, error: stepError } = await supabase
      .from('campaign_steps')
      .select('variants, variant_weights')
      .eq('id', stepId)
      .eq('campaign_id', id)
      .single()

    if (stepError) {
      throw stepError
    }

    // Remove variant
    const currentVariants = step?.variants || ['default']
    const newVariants = currentVariants.filter((v: string) => v !== variantName)

    if (newVariants.length === 0) {
      newVariants.push('default')
    }

    // Redistribute weights
    const weightPerVariant = Math.floor(100 / newVariants.length)
    const newWeights: Record<string, number> = {}

    newVariants.forEach((v: string, i: number) => {
      if (i === newVariants.length - 1) {
        newWeights[v] = 100 - (weightPerVariant * (newVariants.length - 1))
      } else {
        newWeights[v] = weightPerVariant
      }
    })

    // Update step
    const { error: updateError } = await supabase
      .from('campaign_steps')
      .update({
        variants: newVariants,
        variant_weights: newWeights,
        updated_at: new Date().toISOString(),
      })
      .eq('id', stepId)

    if (updateError) {
      throw updateError
    }

    // Delete messages for this variant
    const { error: deleteError } = await supabase
      .from('campaign_messages')
      .delete()
      .eq('step_id', stepId)
      .eq('variant', variantName)

    if (deleteError) {
      console.error('Error deleting variant messages:', deleteError)
    }

    return NextResponse.json({
      success: true,
      variants: newVariants,
      weights: newWeights,
    })
  } catch (error) {
    console.error('Error removing variant:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao remover variante' },
      { status: 500 }
    )
  }
}
