import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * DELETE /api/campaigns/optouts/[id]
 * Remove opt-out (user wants to receive campaigns again)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { error } = await supabase
      .from('campaign_optouts')
      .delete()
      .eq('id', id)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Opt-out removido com sucesso',
    })
  } catch (error) {
    console.error('Error removing optout:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove optout' },
      { status: 500 }
    )
  }
}
