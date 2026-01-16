'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Link2,
  Loader2,
  ArrowLeft,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function NewLinkPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [createdLink, setCreatedLink] = useState<{
    short_url: string
    short_code: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const [formData, setFormData] = useState({
    original_url: '',
    title: '',
    short_code: '',
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_content: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar link')
      }

      toast.success('Link criado com sucesso!')
      setCreatedLink({
        short_url: data.link.short_url,
        short_code: data.link.short_code,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar link')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (createdLink) {
      await navigator.clipboard.writeText(createdLink.short_url)
      setCopied(true)
      toast.success('Link copiado!')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (createdLink) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-500">
              <Check className="h-6 w-6" />
              Link Criado!
            </CardTitle>
            <CardDescription>
              Seu link foi criado com sucesso. Copie e compartilhe!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border bg-card p-4">
              <Label className="text-muted-foreground">Link Curto</Label>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-lg text-blue-400">
                  {createdLink.short_url}
                </code>
                <Button onClick={handleCopy} variant="outline">
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <a
                  href={createdLink.short_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setCreatedLink(null)
                  setFormData({
                    original_url: '',
                    title: '',
                    short_code: '',
                    utm_source: '',
                    utm_medium: '',
                    utm_campaign: '',
                    utm_content: '',
                  })
                }}
              >
                Criar outro link
              </Button>
              <Link href="/links">
                <Button>Ver todos os links</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/links">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Novo Link
          </CardTitle>
          <CardDescription>
            Crie um link curto rastreável para suas campanhas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* URL Original */}
            <div className="space-y-2">
              <Label htmlFor="original_url">URL de Destino *</Label>
              <Input
                id="original_url"
                name="original_url"
                type="url"
                placeholder="https://exemplo.com/pagina"
                value={formData.original_url}
                onChange={handleChange}
                required
              />
              <p className="text-xs text-muted-foreground">
                A URL para onde o link curto vai redirecionar
              </p>
            </div>

            {/* Título */}
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                name="title"
                placeholder="Nome para identificar o link"
                value={formData.title}
                onChange={handleChange}
              />
            </div>

            {/* Código Personalizado */}
            <div className="space-y-2">
              <Label htmlFor="short_code">Código Personalizado</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">fig.ytem.com.br/l/</span>
                <Input
                  id="short_code"
                  name="short_code"
                  placeholder="meu-link"
                  value={formData.short_code}
                  onChange={handleChange}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Deixe vazio para gerar automaticamente. Use apenas letras, números e hífens.
              </p>
            </div>

            {/* UTM Parameters */}
            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="font-medium">Parâmetros UTM (opcional)</h3>
              <p className="text-xs text-muted-foreground">
                Adicione automaticamente parâmetros UTM ao destino
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="utm_source">utm_source</Label>
                  <Input
                    id="utm_source"
                    name="utm_source"
                    placeholder="whatsapp"
                    value={formData.utm_source}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="utm_medium">utm_medium</Label>
                  <Input
                    id="utm_medium"
                    name="utm_medium"
                    placeholder="bot"
                    value={formData.utm_medium}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="utm_campaign">utm_campaign</Label>
                  <Input
                    id="utm_campaign"
                    name="utm_campaign"
                    placeholder="black-friday"
                    value={formData.utm_campaign}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="utm_content">utm_content</Label>
                  <Input
                    id="utm_content"
                    name="utm_content"
                    placeholder="cta-button"
                    value={formData.utm_content}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3">
              <Link href="/links">
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </Link>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Link
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
