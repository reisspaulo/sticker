#!/bin/bash
# ============================================================================
# Script de Verificação de Variáveis do Worker
# ============================================================================
# Compara variáveis esperadas (Doppler) vs reais (Worker na VPS)
# ============================================================================

set -e

echo ""
echo "🔍 VERIFICAÇÃO COMPLETA DE VARIÁVEIS DO WORKER"
echo "============================================================================"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# 1. Verificar pré-requisitos
# ============================================================================

echo "📋 1. Verificando pré-requisitos..."
echo ""

# Check Doppler CLI
if ! command -v doppler &> /dev/null; then
    echo -e "${RED}❌ Doppler CLI não encontrado!${NC}"
    echo "   Instale com: brew install dopplerhq/cli/doppler"
    exit 1
fi
echo -e "${GREEN}✅ Doppler CLI instalado${NC}"

# Check if authenticated
if ! doppler me &>/dev/null; then
    echo -e "${RED}❌ Doppler não autenticado!${NC}"
    echo "   Execute: doppler login"
    exit 1
fi
echo -e "${GREEN}✅ Doppler autenticado${NC}"

# Check vps-ssh
if ! command -v vps-ssh &> /dev/null; then
    echo -e "${RED}❌ vps-ssh não encontrado!${NC}"
    echo "   Configure conforme: docs/operations/QUICK-CHANGES-GUIDE.md"
    exit 1
fi
echo -e "${GREEN}✅ vps-ssh configurado${NC}"

# Check sshpass
if ! command -v sshpass &> /dev/null; then
    echo -e "${RED}❌ sshpass não encontrado!${NC}"
    echo "   Instale com: brew install hudochenkov/sshpass/sshpass"
    exit 1
fi
echo -e "${GREEN}✅ sshpass instalado${NC}"

echo ""

# ============================================================================
# 2. Listar projetos e configs disponíveis no Doppler
# ============================================================================

echo "📚 2. Projetos e Configs no Doppler..."
echo ""

echo -e "${BLUE}Projetos disponíveis:${NC}"
doppler projects 2>/dev/null | grep -E "sticker|brazyl|stepyo" || echo "   (filtrado: sticker, brazyl, stepyo)"
echo ""

echo -e "${BLUE}Configs do projeto 'sticker':${NC}"
doppler configs --project sticker 2>/dev/null || echo "   ❌ Projeto 'sticker' não encontrado"
echo ""

# ============================================================================
# 3. Buscar variáveis esperadas do Doppler (projeto sticker, config prd)
# ============================================================================

echo "🔐 3. Carregando variáveis esperadas do Doppler (sticker/prd)..."
echo ""

PROJECT="sticker"
CONFIG="prd"

# Variáveis críticas para o worker
declare -A EXPECTED_VARS

echo "   Carregando SUPABASE_URL..."
EXPECTED_VARS[SUPABASE_URL]=$(doppler secrets get SUPABASE_URL --plain --project "$PROJECT" --config "$CONFIG" 2>/dev/null || echo "NOT_FOUND")

echo "   Carregando SUPABASE_SERVICE_KEY..."
EXPECTED_VARS[SUPABASE_SERVICE_KEY]=$(doppler secrets get SUPABASE_SERVICE_KEY --plain --project "$PROJECT" --config "$CONFIG" 2>/dev/null || echo "NOT_FOUND")

echo "   Carregando REDIS_URL..."
# Redis URL é hardcoded no deploy-sticker.sh (linha 163)
EXPECTED_VARS[REDIS_URL]="redis://:YOUR_REDIS_PASSWORD@ytem-databases_redis:6379"

echo "   Carregando EVOLUTION_API_URL..."
# Evolution API URL é hardcoded (linha 164)
EXPECTED_VARS[EVOLUTION_API_URL]="http://evolution_evolution_api:8080"

echo "   Carregando EVOLUTION_API_KEY..."
EXPECTED_VARS[EVOLUTION_API_KEY]=$(doppler secrets get EVOLUTION_API_KEY --plain --project "$PROJECT" --config "$CONFIG" 2>/dev/null || echo "NOT_FOUND")

echo "   Carregando EVOLUTION_INSTANCE..."
EXPECTED_VARS[EVOLUTION_INSTANCE]=$(doppler secrets get EVOLUTION_INSTANCE --plain --project "$PROJECT" --config "$CONFIG" 2>/dev/null || echo "NOT_FOUND")

echo "   Carregando OPENAI_API_KEY..."
EXPECTED_VARS[OPENAI_API_KEY]=$(doppler secrets get OPENAI_API_KEY --plain --project "$PROJECT" --config "$CONFIG" 2>/dev/null || echo "NOT_FOUND")

echo "   Carregando LOG_LEVEL..."
EXPECTED_VARS[LOG_LEVEL]=$(doppler secrets get LOG_LEVEL --plain --project "$PROJECT" --config "$CONFIG" 2>/dev/null || echo "info")

echo ""
echo -e "${GREEN}✅ 8 variáveis carregadas do Doppler${NC}"
echo ""

# ============================================================================
# 4. Buscar variáveis reais do Worker na VPS
# ============================================================================

echo "🐳 4. Buscando variáveis do Worker na VPS..."
echo ""

# Encontrar o nome exato do serviço worker
WORKER_SERVICE=$(vps-ssh "docker service ls --filter 'name=sticker_worker' --format '{{.Name}}'" 2>/dev/null || echo "")

if [ -z "$WORKER_SERVICE" ]; then
    echo -e "${RED}❌ Serviço 'sticker_worker' não encontrado na VPS!${NC}"
    echo ""
    echo "Serviços disponíveis:"
    vps-ssh "docker service ls | grep sticker"
    exit 1
fi

echo -e "${GREEN}✅ Serviço encontrado: ${WORKER_SERVICE}${NC}"
echo ""

# Pegar variáveis de ambiente do worker via docker inspect
echo "   Inspecionando variáveis do worker..."

# Buscar task ID do worker
TASK_ID=$(vps-ssh "docker service ps ${WORKER_SERVICE} --filter 'desired-state=running' --format '{{.ID}}' | head -1" 2>/dev/null || echo "")

if [ -z "$TASK_ID" ]; then
    echo -e "${RED}❌ Nenhuma task rodando para ${WORKER_SERVICE}!${NC}"
    echo ""
    echo "Status do serviço:"
    vps-ssh "docker service ps ${WORKER_SERVICE}"
    exit 1
fi

echo -e "${GREEN}✅ Task rodando: ${TASK_ID}${NC}"
echo ""

# Buscar container ID da task
CONTAINER_ID=$(vps-ssh "docker inspect ${TASK_ID} --format '{{.Status.ContainerStatus.ContainerID}}' 2>/dev/null || echo ''" 2>/dev/null || echo "")

if [ -z "$CONTAINER_ID" ]; then
    echo -e "${YELLOW}⚠️  Não foi possível obter container ID via task, tentando método alternativo...${NC}"

    # Método alternativo: buscar containers diretamente
    CONTAINER_ID=$(vps-ssh "docker ps --filter 'name=${WORKER_SERVICE}' --format '{{.ID}}' | head -1" 2>/dev/null || echo "")

    if [ -z "$CONTAINER_ID" ]; then
        echo -e "${RED}❌ Não foi possível encontrar container do worker!${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Container ID: ${CONTAINER_ID}${NC}"
echo ""

# Extrair variáveis de ambiente do container
echo "   Extraindo variáveis de ambiente..."
declare -A ACTUAL_VARS

for VAR_NAME in "${!EXPECTED_VARS[@]}"; do
    VALUE=$(vps-ssh "docker exec ${CONTAINER_ID} printenv ${VAR_NAME} 2>/dev/null || echo 'NOT_SET'" 2>/dev/null || echo "ERROR_FETCHING")
    ACTUAL_VARS[$VAR_NAME]="$VALUE"
done

echo -e "${GREEN}✅ Variáveis extraídas do worker${NC}"
echo ""

# ============================================================================
# 5. Comparar variáveis esperadas vs reais
# ============================================================================

echo "🔍 5. Comparação: Doppler (Esperado) vs Worker (Real)"
echo "============================================================================"
echo ""

ISSUES_FOUND=0

for VAR_NAME in "${!EXPECTED_VARS[@]}"; do
    EXPECTED="${EXPECTED_VARS[$VAR_NAME]}"
    ACTUAL="${ACTUAL_VARS[$VAR_NAME]}"

    # Máscara para valores sensíveis
    if [[ $VAR_NAME == *"KEY"* ]] || [[ $VAR_NAME == *"SECRET"* ]] || [[ $VAR_NAME == *"TOKEN"* ]]; then
        EXPECTED_MASKED="${EXPECTED:0:30}...${EXPECTED: -10}"
        ACTUAL_MASKED="${ACTUAL:0:30}...${ACTUAL: -10}"
    else
        EXPECTED_MASKED="$EXPECTED"
        ACTUAL_MASKED="$ACTUAL"
    fi

    # Comparar
    if [ "$ACTUAL" = "NOT_SET" ]; then
        echo -e "${RED}❌ ${VAR_NAME}${NC}"
        echo "   Esperado: $EXPECTED_MASKED"
        echo "   Real:     ${RED}NÃO DEFINIDA${NC}"
        echo ""
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    elif [ "$ACTUAL" = "ERROR_FETCHING" ]; then
        echo -e "${YELLOW}⚠️  ${VAR_NAME}${NC}"
        echo "   Esperado: $EXPECTED_MASKED"
        echo "   Real:     ${YELLOW}ERRO AO BUSCAR${NC}"
        echo ""
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    elif [ "$EXPECTED" = "NOT_FOUND" ]; then
        echo -e "${YELLOW}⚠️  ${VAR_NAME}${NC}"
        echo "   Esperado: ${YELLOW}NÃO ENCONTRADA NO DOPPLER${NC}"
        echo "   Real:     $ACTUAL_MASKED"
        echo ""
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    elif [ "$EXPECTED" != "$ACTUAL" ]; then
        echo -e "${RED}❌ ${VAR_NAME}${NC}"
        echo "   Esperado: $EXPECTED_MASKED"
        echo "   Real:     $ACTUAL_MASKED"
        echo "   ${RED}>>> VALORES DIFERENTES <<<${NC}"
        echo ""
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    else
        echo -e "${GREEN}✅ ${VAR_NAME}${NC}"
        echo "   Valor: $EXPECTED_MASKED"
        echo ""
    fi
done

# ============================================================================
# 6. Resumo e recomendações
# ============================================================================

echo ""
echo "============================================================================"
echo "📊 RESUMO"
echo "============================================================================"
echo ""

if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ SUCESSO: Todas as variáveis estão corretas!${NC}"
    echo ""
    echo "O problema dos stickers faltando NÃO é causado por variáveis incorretas."
    echo "Investigar outras causas:"
    echo "  - Timeout de conexão com Supabase"
    echo "  - Worker crashando antes de salvar"
    echo "  - Problemas de rede entre VPS e Supabase"
    echo ""
else
    echo -e "${RED}❌ PROBLEMAS ENCONTRADOS: ${ISSUES_FOUND} variável(is) com problema${NC}"
    echo ""
    echo "🔧 AÇÕES RECOMENDADAS:"
    echo ""
    echo "1. Verificar se as variáveis estão corretas no Doppler:"
    echo "   doppler secrets --project sticker --config prd"
    echo ""
    echo "2. Se as variáveis estiverem corretas no Doppler, re-deploy:"
    echo "   ./deploy/deploy-sticker.sh prd"
    echo ""
    echo "3. Verificar logs do worker após re-deploy:"
    echo "   vps-ssh \"docker service logs sticker_worker --tail 100\""
    echo ""
fi

echo "============================================================================"
echo ""

# Retornar código de erro se houver problemas
exit $ISSUES_FOUND
