import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface RouteParams {
  params: Promise<{ id: string }>
}

interface WorkflowNode {
  id: string
  node_key: string
  node_type: string
  label: string
  config: {
    delay_hours?: number
    title?: string
    body?: string
    content_type?: string
    buttons?: { id: string; text: string }[]
    field?: string
    operator?: string
    value?: string
    event?: string
    reason?: string
  }
}

interface WorkflowEdge {
  source_node_key: string
  target_node_key: string
  edge_type: string
}

/**
 * POST /api/campaigns/[id]/workflow/convert
 * Convert workflow to campaign_steps
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get workflow
    const { data: nodes, error: nodesError } = await supabase
      .from('campaign_workflow_nodes')
      .select('*')
      .eq('campaign_id', id)

    if (nodesError) throw nodesError

    const { data: edges, error: edgesError } = await supabase
      .from('campaign_workflow_edges')
      .select('*')
      .eq('campaign_id', id)

    if (edgesError) throw edgesError

    if (!nodes || nodes.length === 0) {
      return NextResponse.json(
        { error: 'Workflow vazio. Adicione nós ao workflow.' },
        { status: 400 }
      )
    }

    // Validate workflow
    const validation = validateWorkflow(nodes, edges || [])
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      )
    }

    // Convert to steps
    const steps = convertToSteps(nodes, edges || [])

    // Delete existing steps and messages
    const { data: existingSteps } = await supabase
      .from('campaign_steps')
      .select('id')
      .eq('campaign_id', id)

    if (existingSteps && existingSteps.length > 0) {
      const stepIds = existingSteps.map(s => s.id)

      await supabase
        .from('campaign_messages')
        .delete()
        .in('step_id', stepIds)

      await supabase
        .from('campaign_steps')
        .delete()
        .eq('campaign_id', id)
    }

    // Insert new steps
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]

      const { data: insertedStep, error: stepError } = await supabase
        .from('campaign_steps')
        .insert({
          campaign_id: id,
          step_order: i,
          step_key: step.step_key,
          delay_hours: step.delay_hours,
        })
        .select()
        .single()

      if (stepError) throw stepError

      // Insert message for this step
      if (step.message) {
        const { error: messageError } = await supabase
          .from('campaign_messages')
          .insert({
            step_id: insertedStep.id,
            variant: 'default',
            content_type: step.message.content_type || 'text',
            title: step.message.title || '',
            body: step.message.body || '',
            buttons: step.message.buttons,
          })

        if (messageError) throw messageError
      }
    }

    return NextResponse.json({
      success: true,
      stepsCreated: steps.length,
      steps: steps,
    })
  } catch (error) {
    console.error('Error converting workflow:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao converter workflow' },
      { status: 500 }
    )
  }
}

function validateWorkflow(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  // Check for trigger node
  const triggerNodes = nodes.filter(n => n.node_type === 'trigger')
  if (triggerNodes.length === 0) {
    return { valid: false, error: 'Workflow precisa de um nó de início (trigger)', details: 'missing_trigger' }
  }
  if (triggerNodes.length > 1) {
    return { valid: false, error: 'Workflow pode ter apenas um nó de início', details: 'multiple_triggers' }
  }

  // Check for end node
  const endNodes = nodes.filter(n => n.node_type === 'end')
  if (endNodes.length === 0) {
    return { valid: false, error: 'Workflow precisa de um nó de fim', details: 'missing_end' }
  }

  // Check for orphan nodes (no incoming or outgoing edges)
  const connectedNodes = new Set<string>()
  edges.forEach(e => {
    connectedNodes.add(e.source_node_key)
    connectedNodes.add(e.target_node_key)
  })

  // Trigger doesn't need incoming edges
  // End doesn't need outgoing edges
  for (const node of nodes) {
    if (node.node_type === 'trigger') {
      const hasOutgoing = edges.some(e => e.source_node_key === node.node_key)
      if (!hasOutgoing) {
        return { valid: false, error: `Nó "${node.label}" não está conectado a nada`, details: 'orphan_node' }
      }
    } else if (node.node_type === 'end') {
      const hasIncoming = edges.some(e => e.target_node_key === node.node_key)
      if (!hasIncoming) {
        return { valid: false, error: `Nó "${node.label}" não recebe conexão`, details: 'orphan_node' }
      }
    } else {
      const hasIncoming = edges.some(e => e.target_node_key === node.node_key)
      const hasOutgoing = edges.some(e => e.source_node_key === node.node_key)
      if (!hasIncoming || !hasOutgoing) {
        return { valid: false, error: `Nó "${node.label}" não está completamente conectado`, details: 'orphan_node' }
      }
    }
  }

  return { valid: true }
}

function convertToSteps(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  const steps: {
    step_key: string
    delay_hours: number
    message?: {
      content_type: string
      title: string
      body: string
      buttons?: { id: string; text: string }[]
    }
  }[] = []

  // Find trigger node
  const trigger = nodes.find(n => n.node_type === 'trigger')
  if (!trigger) return steps

  // Traverse the graph from trigger
  const visited = new Set<string>()
  const queue: { nodeKey: string; accumulatedDelay: number }[] = [
    { nodeKey: trigger.node_key, accumulatedDelay: trigger.config.delay_hours || 0 }
  ]

  let stepOrder = 0

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current.nodeKey)) continue
    visited.add(current.nodeKey)

    const node = nodes.find(n => n.node_key === current.nodeKey)
    if (!node) continue

    // Process based on node type
    if (node.node_type === 'message') {
      steps.push({
        step_key: node.node_key,
        delay_hours: current.accumulatedDelay,
        message: {
          content_type: node.config.content_type || 'text',
          title: node.config.title || '',
          body: node.config.body || '',
          buttons: node.config.buttons,
        },
      })
      stepOrder++
    }

    // Find outgoing edges and add to queue
    const outgoingEdges = edges.filter(e => e.source_node_key === current.nodeKey)
    for (const edge of outgoingEdges) {
      const targetNode = nodes.find(n => n.node_key === edge.target_node_key)
      if (targetNode && !visited.has(targetNode.node_key)) {
        let additionalDelay = 0
        if (targetNode.node_type === 'delay') {
          additionalDelay = targetNode.config.delay_hours || 0
        }
        queue.push({
          nodeKey: targetNode.node_key,
          accumulatedDelay: current.accumulatedDelay + additionalDelay,
        })
      }
    }
  }

  return steps
}
