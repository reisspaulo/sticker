#!/bin/bash

# ============================================
# Setup do Doppler para Admin Panel
# ============================================
#
# Este script configura o Doppler e verifica
# se todas as variáveis necessárias existem.
#
# Uso: ./setup-doppler.sh
# ============================================

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 Setup do Doppler - Admin Panel"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verifica se o Doppler está instalado
if ! command -v doppler &> /dev/null; then
    echo "❌ Doppler CLI não está instalado!"
    echo ""
    echo "📚 Instale seguindo: docs/setup/DOPPLER-SETUP.md"
    echo ""
    echo "macOS:"
    echo "  brew install dopplerhq/cli/doppler"
    echo ""
    echo "Linux:"
    echo "  curl -sLf https://cli.doppler.com/install.sh | sh"
    echo ""
    exit 1
fi

echo "✅ Doppler CLI instalado"
echo ""

# Verifica se está autenticado
if ! doppler me &> /dev/null; then
    echo "❌ Você não está autenticado no Doppler!"
    echo ""
    echo "Execute:"
    echo "  doppler login"
    echo ""
    exit 1
fi

echo "✅ Autenticado no Doppler"
echo ""

# Configura o projeto
echo "🔧 Configurando projeto..."
echo ""
echo "Selecione:"
echo "  Project: sticker"
echo "  Config: dev"
echo ""

doppler setup

echo ""
echo "✅ Projeto configurado"
echo ""

# Verifica as variáveis necessárias
echo "🔍 Verificando variáveis de ambiente..."
echo ""

REQUIRED_VARS=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
)

MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
  if doppler secrets get "$var" --plain &> /dev/null; then
    echo "  ✅ $var"
  else
    echo "  ❌ $var (faltando!)"
    MISSING_VARS+=("$var")
  fi
done

echo ""

# Se houver variáveis faltando
if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "⚠️  VARIÁVEIS FALTANDO"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Configure os seguintes secrets no Doppler:"
    echo ""

    for var in "${MISSING_VARS[@]}"; do
      echo "  doppler secrets set $var=\"seu-valor-aqui\""
    done

    echo ""
    echo "📚 Obtenha os valores em:"
    echo "   https://supabase.com/dashboard/project/YOUR_SUPABASE_PROJECT_ID/settings/api"
    echo ""
    exit 1
fi

# Tudo OK
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ SETUP COMPLETO!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Agora você pode rodar:"
echo ""
echo "  doppler run -- npm run dev"
echo ""
echo "⚠️  Lembre-se: NUNCA rode 'npm run dev' diretamente!"
echo ""
