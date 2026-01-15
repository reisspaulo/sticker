import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface UpdateUserBody {
  subscription_plan?: 'free' | 'premium' | 'ultra'
  subscription_status?: 'active' | 'canceled' | 'expired' | null
  subscription_ends_at?: string | null
  daily_limit?: number
  daily_count?: number
  bonus_credits_today?: number
}

/**
 * GET /api/users/[id]
 * Get user details
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch user' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/users/[id]
 * Update user data
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body: UpdateUserBody = await request.json()
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get current user data for logging
    const { data: currentUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Build update object with only allowed fields
    const allowedFields = [
      'subscription_plan',
      'subscription_status',
      'subscription_ends_at',
      'daily_limit',
      'daily_count',
      'bonus_credits_today',
    ]

    const updateData: Record<string, unknown> = {}
    const changes: Record<string, { from: unknown; to: unknown }> = {}

    for (const field of allowedFields) {
      if (field in body) {
        const newValue = body[field as keyof UpdateUserBody]
        const oldValue = currentUser[field]

        // Only include if value actually changed
        if (newValue !== oldValue) {
          updateData[field] = newValue
          changes[field] = { from: oldValue, to: newValue }
        }
      }
    }

    // Handle subscription plan change - set appropriate dates
    if (updateData.subscription_plan && updateData.subscription_plan !== 'free') {
      if (!updateData.subscription_ends_at && !currentUser.subscription_ends_at) {
        // Set default 30 days if upgrading and no end date specified
        const endsAt = new Date()
        endsAt.setDate(endsAt.getDate() + 30)
        updateData.subscription_ends_at = endsAt.toISOString()
        updateData.subscription_status = 'active'
        updateData.subscription_starts_at = new Date().toISOString()
      }
    }

    // If changing to free, clear subscription dates
    if (updateData.subscription_plan === 'free') {
      updateData.subscription_status = null
      updateData.subscription_ends_at = null
      updateData.subscription_starts_at = null
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No changes to apply',
        user: currentUser,
      })
    }

    // Update user
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    // Log the change
    await supabase.from('usage_logs').insert({
      user_number: currentUser.whatsapp_number,
      action: 'admin_user_edit',
      details: {
        admin_action: true,
        changes,
        timestamp: new Date().toISOString(),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser,
      changes,
    })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update user' },
      { status: 500 }
    )
  }
}
