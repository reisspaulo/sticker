import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * DELETE /api/campaigns/suppression/[id]
 * Remove from suppression list
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { error } = await supabase
      .from('campaign_suppression_list')
      .delete()
      .eq('id', id)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Número removido da lista de supressão',
    })
  } catch (error) {
    console.error('Error removing from suppression list:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove from suppression list' },
      { status: 500 }
    )
  }
}
