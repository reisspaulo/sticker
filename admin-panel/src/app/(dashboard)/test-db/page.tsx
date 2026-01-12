'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'

export default function TestDbPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    async function checkUser() {
      console.log('🔍 Creating Supabase client (OLD LIB)...')
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      console.log('🔍 Getting user...')
      const { data: { user } } = await supabase.auth.getUser()
      console.log('🔍 User:', user)
      setUser(user)
    }
    checkUser()
  }, [])

  const testQuery = async () => {
    setLoading(true)
    try {
      console.log('🔍 TEST: Creating client (OLD LIB)...')
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      console.log('🔍 TEST: Getting session...')
      const { data: { session } } = await supabase.auth.getSession()
      console.log('🔍 TEST: Session:', !!session)

      console.log('🔍 TEST: Building query...')
      const query = supabase
        .from('stickers')
        .select('id, storage_path, tipo', { count: 'exact', head: true })

      console.log('🔍 TEST: Executing query...')
      const queryResult = await query
      console.log('🔍 TEST: Query completed!', queryResult)

      const { data, error, count } = queryResult

      console.log('🔍 TEST: Result:', { count, error })

      setResult({
        session: !!session,
        user: session?.user?.email || 'Not authenticated',
        totalStickers: count,
        error: error,
      })
    } catch (err) {
      console.error('🔍 TEST: Error caught:', err)
      setResult({ error: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Test Database (OLD LIB)</h1>

      <div className="space-y-2">
        <p>Current User: {user?.email || 'Not loaded'}</p>
        <p>User ID: {user?.id || 'N/A'}</p>
      </div>

      <Button onClick={testQuery} disabled={loading}>
        {loading ? 'Testing...' : 'Test Supabase Query (OLD LIB)'}
      </Button>

      {result && (
        <pre className="bg-muted p-4 rounded overflow-auto max-h-96">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}
