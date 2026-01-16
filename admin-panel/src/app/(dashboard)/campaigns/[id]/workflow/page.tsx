'use client'

import { useCallback, useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  Panel,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Save,
  Play,
  Loader2,
  Zap,
  Clock,
  MessageSquare,
  GitBranch,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'

// Custom Node Components
interface NodeConfig {
  event?: string
  delay_hours?: number
  title?: string
  body?: string
  field?: string
  operator?: string
  value?: string
  reason?: string
}

function TriggerNode({ data }: { data: { label: string; config: NodeConfig } }) {
  return (
    <div className="px-4 py-3 shadow-lg rounded-lg bg-emerald-500 border-2 border-emerald-600 min-w-[150px]">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-white" />
        <span className="text-white font-medium text-sm">{data.label}</span>
      </div>
      {data.config?.event ? (
        <div className="mt-1 text-emerald-100 text-xs">
          Evento: {data.config.event}
        </div>
      ) : null}
    </div>
  )
}

function DelayNode({ data }: { data: { label: string; config: NodeConfig } }) {
  return (
    <div className="px-4 py-3 shadow-lg rounded-lg bg-amber-500 border-2 border-amber-600 min-w-[150px]">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-white" />
        <span className="text-white font-medium text-sm">{data.label}</span>
      </div>
      {data.config?.delay_hours !== undefined ? (
        <div className="mt-1 text-amber-100 text-xs">
          {data.config.delay_hours}h de espera
        </div>
      ) : null}
    </div>
  )
}

function MessageNode({ data }: { data: { label: string; config: NodeConfig } }) {
  return (
    <div className="px-4 py-3 shadow-lg rounded-lg bg-blue-500 border-2 border-blue-600 min-w-[150px] max-w-[200px]">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-white" />
        <span className="text-white font-medium text-sm">{data.label}</span>
      </div>
      {data.config?.body ? (
        <div className="mt-1 text-blue-100 text-xs line-clamp-2">
          {data.config.body.substring(0, 50)}...
        </div>
      ) : null}
    </div>
  )
}

function ConditionNode({ data }: { data: { label: string; config: NodeConfig } }) {
  // Format condition for display
  const formatCondition = () => {
    if (!data.config?.field || !data.config?.value) return null

    const { field, operator, value } = data.config
    switch (field) {
      case 'subscription_plan':
        return `Plano ${operator === '=' ? '=' : '≠'} ${value}`
      case 'twitter_feature_used':
        return value === 'true' ? 'Usou Twitter' : 'Não usou Twitter'
      case 'cleanup_feature_used':
        return value === 'true' ? 'Usou Cleanup' : 'Não usou Cleanup'
      case 'stickers_created':
        return `Figurinhas ${operator} ${value}`
      case 'days_since_signup':
        return `Dias cadastrado ${operator} ${value}`
      case 'button_clicked':
        return `Clicou: ${value}`
      default:
        return `${field} ${operator} ${value}`
    }
  }

  return (
    <div className="px-4 py-3 shadow-lg rounded-lg bg-purple-500 border-2 border-purple-600 min-w-[150px]">
      <div className="flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-white" />
        <span className="text-white font-medium text-sm">{data.label}</span>
      </div>
      {formatCondition() && (
        <div className="mt-1 text-purple-100 text-xs">
          {formatCondition()}
        </div>
      )}
    </div>
  )
}

function EndNode({ data }: { data: { label: string; config: NodeConfig } }) {
  return (
    <div className="px-4 py-3 shadow-lg rounded-lg bg-red-500 border-2 border-red-600 min-w-[120px]">
      <div className="flex items-center gap-2">
        <CheckCircle className="h-4 w-4 text-white" />
        <span className="text-white font-medium text-sm">{data.label}</span>
      </div>
    </div>
  )
}

const nodeTypes = {
  trigger: TriggerNode,
  delay: DelayNode,
  message: MessageNode,
  condition: ConditionNode,
  end: EndNode,
}

const defaultEdgeOptions = {
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed },
  style: { strokeWidth: 2 },
}

// Define node data type for React Flow
interface WorkflowNodeData extends Record<string, unknown> {
  label: string
  config: NodeConfig
  nodeType: string
  dbId?: string
}

type WorkflowNode = Node<WorkflowNodeData>

export default function WorkflowPage() {
  const params = useParams()
  const router = useRouter()
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[])
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [converting, setConverting] = useState(false)
  const [campaignName, setCampaignName] = useState('')

  // Node editing
  const [editingNode, setEditingNode] = useState<WorkflowNode | null>(null)
  const [nodeLabel, setNodeLabel] = useState('')
  const [nodeConfig, setNodeConfig] = useState<NodeConfig>({})

  // Load workflow
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // Get campaign name
        const campaignRes = await fetch(`/api/campaigns/${params.id}`)
        if (campaignRes.ok) {
          const campaignData = await campaignRes.json()
          setCampaignName(campaignData.campaign?.name || '')
        }

        // Get workflow
        const res = await fetch(`/api/campaigns/${params.id}/workflow`)
        if (res.ok) {
          const data = await res.json()
          if (data.nodes.length > 0) {
            setNodes(data.nodes)
            setEdges(data.edges)
          } else {
            // Set default nodes for new workflow
            setNodes([
              {
                id: 'trigger_start',
                type: 'trigger',
                position: { x: 250, y: 50 },
                data: { label: 'Início', config: { event: 'user_enrolled' }, nodeType: 'trigger' },
              },
              {
                id: 'end_complete',
                type: 'end',
                position: { x: 250, y: 400 },
                data: { label: 'Fim', config: { reason: 'completed' }, nodeType: 'end' },
              },
            ])
          }
        }
      } catch (error) {
        console.error('Error loading workflow:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [params.id, setNodes, setEdges])

  const onConnect = useCallback(
    (connection: Connection) => {
      const edge = {
        ...connection,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed },
        data: { edgeType: 'default' },
      }
      setEdges((eds) => addEdge(edge, eds))
    },
    [setEdges]
  )

  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    const workflowNode = node as WorkflowNode
    setEditingNode(workflowNode)
    setNodeLabel(workflowNode.data.label || '')
    setNodeConfig(workflowNode.data.config || {})
  }, [])

  const addNode = (type: string) => {
    const id = `${type}_${Date.now()}`
    const labels: Record<string, string> = {
      trigger: 'Início',
      delay: 'Espera',
      message: 'Mensagem',
      condition: 'Condição',
      end: 'Fim',
    }

    const newNode: Node = {
      id,
      type,
      position: { x: 250, y: 200 },
      data: {
        label: labels[type] || type,
        config: {},
        nodeType: type,
      },
    }
    setNodes((nds) => [...nds, newNode])
  }

  const deleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId))
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
    setEditingNode(null)
  }

  const updateNode = () => {
    if (!editingNode) return

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === editingNode.id) {
          return {
            ...n,
            data: {
              ...n.data,
              label: nodeLabel,
              config: nodeConfig,
            },
          }
        }
        return n
      })
    )
    setEditingNode(null)
  }

  const saveWorkflow = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/campaigns/${params.id}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges }),
      })

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Erro ao salvar')
        return
      }

      alert('Workflow salvo com sucesso!')
    } catch (error) {
      console.error('Error saving workflow:', error)
      alert('Erro ao salvar workflow')
    } finally {
      setSaving(false)
    }
  }

  const convertWorkflow = async () => {
    setConverting(true)
    try {
      // First save
      await fetch(`/api/campaigns/${params.id}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges }),
      })

      // Then convert
      const res = await fetch(`/api/campaigns/${params.id}/workflow/convert`, {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Erro ao converter workflow')
        return
      }

      alert(`Workflow convertido! ${data.stepsCreated} steps criados.`)
      router.push(`/campaigns/${params.id}`)
    } catch (error) {
      console.error('Error converting workflow:', error)
      alert('Erro ao converter workflow')
    } finally {
      setConverting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/campaigns/${params.id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Editor de Workflow</h1>
            <p className="text-sm text-muted-foreground">{campaignName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={saveWorkflow} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
          <Button onClick={convertWorkflow} disabled={converting}>
            {converting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Aplicar ao Campaign
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <Card className="h-[700px]">
        <CardContent className="p-0 h-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDoubleClick={onNodeDoubleClick}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            <Controls />

            {/* Toolbar */}
            <Panel position="top-left" className="bg-card p-3 rounded-lg shadow-lg border">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground mb-2">Adicionar Nó</p>
                <div className="flex flex-col gap-1">
                  <Button variant="outline" size="sm" onClick={() => addNode('trigger')} className="justify-start">
                    <Zap className="h-4 w-4 mr-2 text-emerald-500" />
                    Início
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addNode('delay')} className="justify-start">
                    <Clock className="h-4 w-4 mr-2 text-amber-500" />
                    Espera
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addNode('message')} className="justify-start">
                    <MessageSquare className="h-4 w-4 mr-2 text-blue-500" />
                    Mensagem
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addNode('condition')} className="justify-start">
                    <GitBranch className="h-4 w-4 mr-2 text-purple-500" />
                    Condição
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addNode('end')} className="justify-start">
                    <CheckCircle className="h-4 w-4 mr-2 text-red-500" />
                    Fim
                  </Button>
                </div>
              </div>
            </Panel>

            {/* Help */}
            <Panel position="bottom-left" className="bg-card p-3 rounded-lg shadow-lg border">
              <p className="text-xs text-muted-foreground">
                Duplo clique em um nó para editar.<br />
                Arraste das bordas para conectar.
              </p>
            </Panel>
          </ReactFlow>
        </CardContent>
      </Card>

      {/* Node Edit Dialog */}
      <Dialog open={!!editingNode} onOpenChange={() => setEditingNode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Nó</DialogTitle>
            <DialogDescription>
              Configure as propriedades do nó
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={nodeLabel}
                onChange={(e) => setNodeLabel(e.target.value)}
                placeholder="Nome do nó"
              />
            </div>

            {/* Type-specific fields */}
            {editingNode?.type === 'trigger' && (
              <div className="space-y-2">
                <Label>Evento Disparador</Label>
                <Select
                  value={String(nodeConfig.event || '')}
                  onValueChange={(v) => setNodeConfig({ ...nodeConfig, event: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user_enrolled">Usuário inscrito</SelectItem>
                    <SelectItem value="user_created">Usuário criado</SelectItem>
                    <SelectItem value="limit_hit">Limite atingido</SelectItem>
                    <SelectItem value="first_sticker">Primeira figurinha</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {editingNode?.type === 'delay' && (
              <div className="space-y-2">
                <Label>Horas de Espera</Label>
                <Input
                  type="number"
                  value={String(nodeConfig.delay_hours || 0)}
                  onChange={(e) => setNodeConfig({ ...nodeConfig, delay_hours: parseInt(e.target.value) })}
                  min={0}
                />
              </div>
            )}

            {editingNode?.type === 'message' && (
              <>
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input
                    value={String(nodeConfig.title || '')}
                    onChange={(e) => setNodeConfig({ ...nodeConfig, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Corpo da Mensagem</Label>
                  <Textarea
                    value={String(nodeConfig.body || '')}
                    onChange={(e) => setNodeConfig({ ...nodeConfig, body: e.target.value })}
                    rows={4}
                  />
                </div>
              </>
            )}

            {editingNode?.type === 'condition' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Defina a condição para ramificar o fluxo. Conecte a saída &quot;Sim&quot; e &quot;Não&quot; aos próximos nós.
                </p>

                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <Label className="text-sm font-medium">Se o usuário...</Label>

                  {/* Field selector with friendly names */}
                  <Select
                    value={String(nodeConfig.field || '')}
                    onValueChange={(v) => {
                      // Reset operator and value when field changes
                      const defaultOp = ['twitter_feature_used', 'cleanup_feature_used'].includes(v) ? '=' : '='
                      setNodeConfig({ ...nodeConfig, field: v, operator: defaultOp, value: '' })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha uma condição..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="subscription_plan">Tem plano igual a</SelectItem>
                      <SelectItem value="twitter_feature_used">Usou recurso Twitter</SelectItem>
                      <SelectItem value="cleanup_feature_used">Usou recurso Cleanup</SelectItem>
                      <SelectItem value="stickers_created">Criou X figurinhas</SelectItem>
                      <SelectItem value="days_since_signup">Cadastrado há X dias</SelectItem>
                      <SelectItem value="button_clicked">Clicou em botão</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Conditional operator and value based on field type */}
                  {nodeConfig.field === 'subscription_plan' && (
                    <div className="flex items-center gap-2">
                      <Select
                        value={String(nodeConfig.operator || '=')}
                        onValueChange={(v) => setNodeConfig({ ...nodeConfig, operator: v })}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="=">é igual a</SelectItem>
                          <SelectItem value="!=">não é igual a</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={String(nodeConfig.value || '')}
                        onValueChange={(v) => setNodeConfig({ ...nodeConfig, value: v })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Plano" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="basic">Basic</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                          <SelectItem value="ultra">Ultra</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(nodeConfig.field === 'twitter_feature_used' || nodeConfig.field === 'cleanup_feature_used') && (
                    <Select
                      value={String(nodeConfig.value || '')}
                      onValueChange={(v) => setNodeConfig({ ...nodeConfig, operator: '=', value: v })}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Sim</SelectItem>
                        <SelectItem value="false">Não</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {(nodeConfig.field === 'stickers_created' || nodeConfig.field === 'days_since_signup') && (
                    <div className="flex items-center gap-2">
                      <Select
                        value={String(nodeConfig.operator || '>')}
                        onValueChange={(v) => setNodeConfig({ ...nodeConfig, operator: v })}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value=">">maior que</SelectItem>
                          <SelectItem value=">=">maior ou igual</SelectItem>
                          <SelectItem value="<">menor que</SelectItem>
                          <SelectItem value="<=">menor ou igual</SelectItem>
                          <SelectItem value="=">igual a</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        value={String(nodeConfig.value || '')}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, value: e.target.value })}
                        placeholder="0"
                        className="w-24"
                        min={0}
                      />
                    </div>
                  )}

                  {nodeConfig.field === 'button_clicked' && (
                    <Input
                      value={String(nodeConfig.value || '')}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, operator: '=', value: e.target.value })}
                      placeholder="ID do botão (ex: btn_start)"
                    />
                  )}
                </div>

                {/* Preview of the condition */}
                {nodeConfig.field && nodeConfig.value && (
                  <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                    <p className="text-sm font-medium text-purple-400 flex items-center gap-2">
                      <GitBranch className="h-4 w-4" />
                      Condição configurada:
                    </p>
                    <p className="text-sm mt-1">
                      {nodeConfig.field === 'subscription_plan' && `Plano ${nodeConfig.operator === '=' ? 'é' : 'não é'} "${nodeConfig.value}"`}
                      {nodeConfig.field === 'twitter_feature_used' && `${nodeConfig.value === 'true' ? 'Usou' : 'Não usou'} Twitter`}
                      {nodeConfig.field === 'cleanup_feature_used' && `${nodeConfig.value === 'true' ? 'Usou' : 'Não usou'} Cleanup`}
                      {nodeConfig.field === 'stickers_created' && `Criou ${nodeConfig.operator} ${nodeConfig.value} figurinhas`}
                      {nodeConfig.field === 'days_since_signup' && `Cadastrado há ${nodeConfig.operator} ${nodeConfig.value} dias`}
                      {nodeConfig.field === 'button_clicked' && `Clicou no botão "${nodeConfig.value}"`}
                    </p>
                  </div>
                )}
              </div>
            )}

            {editingNode?.type === 'end' && (
              <div className="space-y-2">
                <Label>Motivo</Label>
                <Select
                  value={String(nodeConfig.reason || '')}
                  onValueChange={(v) => setNodeConfig({ ...nodeConfig, reason: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Completou</SelectItem>
                    <SelectItem value="converted">Converteu</SelectItem>
                    <SelectItem value="cancelled">Cancelou</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between">
            <Button
              variant="destructive"
              onClick={() => editingNode && deleteNode(editingNode.id)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingNode(null)}>
                Cancelar
              </Button>
              <Button onClick={updateNode}>
                Salvar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
