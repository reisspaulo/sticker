'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'

export default function TestSimpleQueryPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const runQuery = async () => {
    console.log('[TEST] ========== STARTING QUERY TEST ==========')
    setLoading(true)
    setResult(null)

    try {
      console.log('[TEST] Step 1: Creating client...')
      const supabase = createClient()
      console.log('[TEST] Step 2: Client created')

      console.log('[TEST] Step 3: Getting session...')
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      console.log('[TEST] Step 4: Session result:', { hasSession: !!session, error: sessionError })

      console.log('[TEST] Step 5: Building query...')
      const query = supabase
        .from('stickers')
        .select('id', { count: 'exact', head: true })

      console.log('[TEST] Step 6: Executing query (with 5s timeout)...')

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          console.log('[TEST] ⏰ TIMEOUT FIRED!')
          reject(new Error('Query timeout after 5s'))
        }, 5000)
      })

      const queryResult = await Promise.race([query, timeoutPromise])

      console.log('[TEST] Step 7: Query completed!', queryResult)

      setResult({
        success: true,
        session: !!session,
        count: (queryResult as any).count,
        error: (queryResult as any).error
      })
    } catch (err) {
      console.error('[TEST] ❌ Error:', err)
      setResult({
        success: false,
        error: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setLoading(false)
      console.log('[TEST] ========== TEST COMPLETE ==========')
    }
  }

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Teste Simples de Query</h1>

      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Este teste executa uma query Supabase com logs detalhados.
          Abra o console do browser (F12) para ver os logs.
        </p>

        <Button
          onClick={runQuery}
          disabled={loading}
          size="lg"
        >
          {loading ? 'Executando...' : 'Executar Query'}
        </Button>

        {result && (
          <div className="mt-4 p-4 rounded-lg bg-muted">
            <h3 className="font-bold mb-2">Resultado:</h3>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
