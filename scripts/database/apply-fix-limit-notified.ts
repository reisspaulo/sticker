/**
 * Script para aplicar a correção da função set_limit_notified_atomic
 *
 * Execução:
 * doppler run --config prd -- npx ts-node scripts/database/apply-fix-limit-notified.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

// Usar service role key para ter permissão de DDL
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

async function applyMigration() {
  console.log('🔧 Applying fix for set_limit_notified_atomic...\n');

  // A função corrigida - retorna boolean diretamente
  const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION set_limit_notified_atomic(p_user_id UUID)
    RETURNS boolean AS $$
    DECLARE
      v_was_already_notified boolean;
      v_today_start timestamptz;
      v_rows_affected int;
    BEGIN
      -- Calculate start of today (Brasilia timezone)
      v_today_start := date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';

      -- Atomic update: set limit_notified_at if not already set today
      UPDATE users
      SET
        limit_notified_at = NOW(),
        updated_at = NOW()
      WHERE id = p_user_id
        AND (limit_notified_at IS NULL OR limit_notified_at < v_today_start);

      GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

      -- If no rows updated, user was already notified today
      IF v_rows_affected = 0 THEN
        v_was_already_notified := true;
      ELSE
        v_was_already_notified := false;
      END IF;

      -- Return boolean directly (not wrapped in TABLE)
      RETURN v_was_already_notified;
    END;
    $$ LANGUAGE plpgsql;
  `;

  // Nota: Não podemos executar DDL diretamente via supabase-js
  // O usuário precisa executar no Supabase Dashboard > SQL Editor

  console.log('❌ Cannot execute DDL via supabase-js client.\n');
  console.log('📋 Please run the following SQL in Supabase Dashboard > SQL Editor:\n');
  console.log('='.repeat(60));
  console.log(createFunctionSQL);
  console.log('='.repeat(60));
  console.log('\n');

  // Testar a função atual
  console.log('🧪 Testing current function behavior...\n');

  const testUserId = 'c01cd1d1-b659-467f-a65c-b4e0c725fc11'; // Lost. user

  const { data, error } = await supabase.rpc('set_limit_notified_atomic', {
    p_user_id: testUserId,
  });

  if (error) {
    console.error('❌ Test failed:', error.message);
    return;
  }

  console.log('Result:', data);
  console.log('Type:', typeof data);

  if (typeof data === 'boolean') {
    console.log('\n✅ Function already returns boolean directly!');
  } else if (typeof data === 'object' && data !== null) {
    console.log('\n⚠️  Function still returns object:', JSON.stringify(data));
    console.log('Please apply the migration above to fix this.');
  }
}

applyMigration().catch(console.error);
