import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/campaigns/[id]/workflow
 * Get workflow nodes and edges for a campaign
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get nodes
    const { data: nodes, error: nodesError } = await supabase
      .from('campaign_workflow_nodes')
      .select('*')
      .eq('campaign_id', id)
      .order('created_at')

    if (nodesError) throw nodesError

    // Get edges
    const { data: edges, error: edgesError } = await supabase
      .from('campaign_workflow_edges')
      .select('*')
      .eq('campaign_id', id)

    if (edgesError) throw edgesError

    // Transform to React Flow format
    const flowNodes = (nodes || []).map(node => ({
      id: node.node_key,
      type: node.node_type,
      position: { x: node.position_x, y: node.position_y },
      data: {
        label: node.label || node.node_key,
        config: node.config,
        nodeType: node.node_type,
        dbId: node.id,
      },
    }))

    const flowEdges = (edges || []).map(edge => ({
      id: `${edge.source_node_key}-${edge.target_node_key}-${edge.edge_type}`,
      source: edge.source_node_key,
      target: edge.target_node_key,
      type: edge.edge_type === 'default' ? 'smoothstep' : 'smoothstep',
      label: edge.label,
      data: {
        edgeType: edge.edge_type,
        condition: edge.condition,
        dbId: edge.id,
      },
      animated: edge.edge_type !== 'default',
      style: getEdgeStyle(edge.edge_type),
    }))

    return NextResponse.json({
      nodes: flowNodes,
      edges: flowEdges,
      rawNodes: nodes || [],
      rawEdges: edges || [],
    })
  } catch (error) {
    console.error('Error fetching workflow:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao buscar workflow' },
      { status: 500 }
    )
  }
}

function getEdgeStyle(edgeType: string) {
  switch (edgeType) {
    case 'yes':
      return { stroke: '#22c55e', strokeWidth: 2 }
    case 'no':
      return { stroke: '#ef4444', strokeWidth: 2 }
    case 'timeout':
      return { stroke: '#f59e0b', strokeWidth: 2 }
    case 'else':
      return { stroke: '#8b5cf6', strokeWidth: 2 }
    default:
      return { stroke: '#64748b', strokeWidth: 2 }
  }
}

/**
 * POST /api/campaigns/[id]/workflow
 * Save entire workflow (nodes and edges)
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()
    const { nodes, edges } = body

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Delete existing workflow
    await supabase
      .from('campaign_workflow_edges')
      .delete()
      .eq('campaign_id', id)

    await supabase
      .from('campaign_workflow_nodes')
      .delete()
      .eq('campaign_id', id)

    // Insert nodes
    if (nodes && nodes.length > 0) {
      const nodesToInsert = nodes.map((node: {
        id: string
        type: string
        position: { x: number; y: number }
        data: { label?: string; config?: Record<string, unknown>; nodeType?: string }
      }) => ({
        campaign_id: id,
        node_key: node.id,
        node_type: node.type || node.data?.nodeType || 'message',
        label: node.data?.label || node.id,
        position_x: Math.round(node.position.x),
        position_y: Math.round(node.position.y),
        config: node.data?.config || {},
      }))

      const { error: insertNodesError } = await supabase
        .from('campaign_workflow_nodes')
        .insert(nodesToInsert)

      if (insertNodesError) throw insertNodesError
    }

    // Insert edges
    if (edges && edges.length > 0) {
      const edgesToInsert = edges.map((edge: {
        source: string
        target: string
        label?: string
        data?: { edgeType?: string; condition?: Record<string, unknown> }
      }) => ({
        campaign_id: id,
        source_node_key: edge.source,
        target_node_key: edge.target,
        edge_type: edge.data?.edgeType || 'default',
        label: edge.label,
        condition: edge.data?.condition,
      }))

      const { error: insertEdgesError } = await supabase
        .from('campaign_workflow_edges')
        .insert(edgesToInsert)

      if (insertEdgesError) throw insertEdgesError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving workflow:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao salvar workflow' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/campaigns/[id]/workflow
 * Update specific node or edge
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()
    const { type, nodeKey, updates } = body

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (type === 'node') {
      const { error } = await supabase
        .from('campaign_workflow_nodes')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('campaign_id', id)
        .eq('node_key', nodeKey)

      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating workflow:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao atualizar workflow' },
      { status: 500 }
    )
  }
}
