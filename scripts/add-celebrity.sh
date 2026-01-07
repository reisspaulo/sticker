#!/bin/bash
# Script para adicionar celebridades ao sistema de reconhecimento facial
# Uso: ./scripts/add-celebrity.sh <nome> [pasta_com_fotos]
# Exemplo: ./scripts/add-celebrity.sh gretchen

set -e

# Diretório base do projeto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CELEBRIDADES_DIR="$PROJECT_DIR/celebridades"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Verifica argumentos
if [ -z "$1" ]; then
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  🎭 Adicionar Celebridade ao Reconhecimento Facial         ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}Uso:${NC}"
    echo "  ./scripts/add-celebrity.sh <nome>"
    echo ""
    echo -e "${YELLOW}Exemplos:${NC}"
    echo "  ./scripts/add-celebrity.sh gretchen"
    echo "  ./scripts/add-celebrity.sh patixa"
    echo "  ./scripts/add-celebrity.sh malevola"
    echo ""
    echo -e "${YELLOW}Pastas de fotos (coloque as fotos aqui):${NC}"
    echo "  celebridades/gretchen/"
    echo "  celebridades/patixa/"
    echo "  celebridades/malevola/"
    echo ""
    echo -e "${YELLOW}Comandos extras:${NC}"
    echo "  ./scripts/add-celebrity.sh --list       # Lista celebridades cadastradas"
    echo "  ./scripts/add-celebrity.sh --test <img> # Testa identificação em imagem"
    echo "  ./scripts/add-celebrity.sh --new <nome> # Cria pasta para nova celebridade"
    echo "  ./scripts/add-celebrity.sh --reprocess  # Reprocessa stickers com rosto não identificado"
    echo "  ./scripts/add-celebrity.sh --stats      # Mostra estatísticas de classificação"
    echo ""
    echo -e "${YELLOW}Dicas:${NC}"
    echo "  - Use 3-5 fotos por celebridade"
    echo "  - Fotos devem ter rosto visível e claro"
    echo "  - Formatos aceitos: jpg, jpeg, png, webp"
    exit 0
fi

# Verifica se Doppler está configurado
if ! command -v doppler &> /dev/null; then
    echo -e "${RED}❌ Doppler CLI não encontrado. Instale com: brew install dopplerhq/cli/doppler${NC}"
    exit 1
fi

# Obtém credenciais do Doppler
VPS_HOST=$(doppler secrets get VPS_HOST --plain --config prd --project brazyl 2>/dev/null)
VPS_USER=$(doppler secrets get VPS_USER --plain --config prd --project brazyl 2>/dev/null)
VPS_PASSWORD=$(doppler secrets get VPS_PASSWORD --plain --config prd --project brazyl 2>/dev/null)

if [ -z "$VPS_HOST" ] || [ -z "$VPS_USER" ] || [ -z "$VPS_PASSWORD" ]; then
    echo -e "${RED}❌ Não foi possível obter credenciais da VPS do Doppler${NC}"
    exit 1
fi

# Função para executar comando remoto
vps_exec() {
    SSHPASS="$VPS_PASSWORD" sshpass -e ssh -o StrictHostKeyChecking=no -o PreferredAuthentications=password -o PubkeyAuthentication=no "${VPS_USER}@${VPS_HOST}" "$@"
}

# Função para upload de arquivo
vps_upload() {
    local src="$1"
    local dest="$2"
    SSHPASS="$VPS_PASSWORD" sshpass -e scp -o StrictHostKeyChecking=no -o PreferredAuthentications=password -o PubkeyAuthentication=no "$src" "${VPS_USER}@${VPS_HOST}:$dest"
}

# Comando --list
if [ "$1" == "--list" ]; then
    echo -e "${BLUE}📋 Celebridades cadastradas:${NC}"
    vps_exec "python3 /opt/face-recognition/scripts/face_classifier.py list"
    echo ""
    echo -e "${BLUE}📁 Pastas locais (celebridades/):${NC}"
    for dir in "$CELEBRIDADES_DIR"/*/; do
        if [ -d "$dir" ]; then
            nome=$(basename "$dir")
            fotos=$(find "$dir" -maxdepth 1 -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.webp" \) 2>/dev/null | wc -l | tr -d ' ')
            echo "   • $nome/: $fotos fotos"
        fi
    done
    exit 0
fi

# Comando --new (criar pasta para nova celebridade)
if [ "$1" == "--new" ]; then
    if [ -z "$2" ]; then
        echo -e "${RED}❌ Especifique o nome da celebridade${NC}"
        echo "Uso: ./scripts/add-celebrity.sh --new <nome>"
        exit 1
    fi
    NOVO_NOME=$(echo "$2" | tr '[:upper:]' '[:lower:]')  # lowercase
    NOVA_PASTA="$CELEBRIDADES_DIR/$NOVO_NOME"

    if [ -d "$NOVA_PASTA" ]; then
        echo -e "${YELLOW}⚠️  Pasta já existe: celebridades/$NOVO_NOME/${NC}"
    else
        mkdir -p "$NOVA_PASTA"
        echo -e "${GREEN}✅ Pasta criada: celebridades/$NOVO_NOME/${NC}"
    fi
    echo -e "${BLUE}   Coloque 3-5 fotos nessa pasta e execute:${NC}"
    echo "   ./scripts/add-celebrity.sh $NOVO_NOME"
    exit 0
fi

# Comando --test
if [ "$1" == "--test" ]; then
    if [ -z "$2" ]; then
        echo -e "${RED}❌ Especifique a imagem para testar${NC}"
        echo "Uso: ./scripts/add-celebrity.sh --test <caminho_imagem>"
        exit 1
    fi

    IMG_PATH="$2"
    if [ ! -f "$IMG_PATH" ]; then
        echo -e "${RED}❌ Imagem não encontrada: $IMG_PATH${NC}"
        exit 1
    fi

    echo -e "${BLUE}🔍 Testando identificação...${NC}"

    # Upload da imagem
    REMOTE_TMP="/tmp/test_$(date +%s).jpg"
    vps_upload "$IMG_PATH" "$REMOTE_TMP"

    # Identifica
    vps_exec "python3 /opt/face-recognition/scripts/face_classifier.py identify $REMOTE_TMP -v"

    # Limpa
    vps_exec "rm -f $REMOTE_TMP"
    exit 0
fi

# Comando --stats (estatísticas de classificação)
if [ "$1" == "--stats" ]; then
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  📊 Estatísticas de Classificação                          ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # Obtém credenciais do Supabase
    SUPABASE_URL=$(doppler secrets get SUPABASE_URL --plain --config prd --project sticker 2>/dev/null)
    SUPABASE_KEY=$(doppler secrets get SUPABASE_SERVICE_KEY --plain --config prd --project sticker 2>/dev/null)

    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
        echo -e "${RED}❌ Não foi possível obter credenciais do Supabase${NC}"
        exit 1
    fi

    # Query estatísticas
    STATS=$(curl -s "${SUPABASE_URL}/rest/v1/rpc/get_classification_stats" \
        -H "apikey: ${SUPABASE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_KEY}" 2>/dev/null || echo "[]")

    # Query direta se a função não existir
    STATS=$(curl -s "${SUPABASE_URL}/rest/v1/stickers?select=face_detected,celebrity_id" \
        -H "apikey: ${SUPABASE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_KEY}" 2>/dev/null)

    # Conta usando jq ou python
    if command -v python3 &> /dev/null; then
        echo "$STATS" | python3 -c "
import json, sys
data = json.load(sys.stdin)
total = len(data)
pending = sum(1 for d in data if d.get('face_detected') is None)
no_face = sum(1 for d in data if d.get('face_detected') == False)
has_face_no_celeb = sum(1 for d in data if d.get('face_detected') == True and d.get('celebrity_id') is None)
has_celeb = sum(1 for d in data if d.get('celebrity_id') is not None)

print(f'  Total de stickers:           {total}')
print(f'  Pendentes (não processados): {pending}')
print(f'  Sem rosto detectado:         {no_face}')
print(f'  Rosto, não é celebridade:    {has_face_no_celeb}')
print(f'  Celebridade identificada:    {has_celeb}')
"
    else
        echo -e "${YELLOW}Python3 não encontrado, mostrando dados brutos${NC}"
    fi

    echo ""
    echo -e "${BLUE}📦 Stickers por Pack:${NC}"

    PACKS=$(curl -s "${SUPABASE_URL}/rest/v1/sticker_packs?select=name,slug,sticker_pack_items(count)&pack_type=eq.celebrity" \
        -H "apikey: ${SUPABASE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_KEY}" 2>/dev/null)

    if command -v python3 &> /dev/null; then
        echo "$PACKS" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    for pack in data:
        name = pack.get('name', 'Unknown')
        items = pack.get('sticker_pack_items', [])
        count = items[0].get('count', 0) if items else 0
        print(f'  • {name}: {count} figurinhas')
except:
    print('  Erro ao carregar packs')
"
    fi

    exit 0
fi

# Comando --reprocess (reprocessa stickers com rosto não identificado)
if [ "$1" == "--reprocess" ]; then
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  🔄 Reprocessar Stickers                                   ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # Obtém credenciais do Supabase
    SUPABASE_URL=$(doppler secrets get SUPABASE_URL --plain --config prd --project sticker 2>/dev/null)
    SUPABASE_KEY=$(doppler secrets get SUPABASE_SERVICE_KEY --plain --config prd --project sticker 2>/dev/null)

    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
        echo -e "${RED}❌ Não foi possível obter credenciais do Supabase${NC}"
        exit 1
    fi

    # Conta quantos serão afetados
    COUNT=$(curl -s "${SUPABASE_URL}/rest/v1/stickers?select=id&face_detected=eq.true&celebrity_id=is.null" \
        -H "apikey: ${SUPABASE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_KEY}" \
        -H "Prefer: count=exact" \
        -I 2>/dev/null | grep -i "content-range" | grep -oE '[0-9]+$' || echo "0")

    if [ "$COUNT" == "0" ] || [ -z "$COUNT" ]; then
        # Tenta contar de outra forma
        COUNT=$(curl -s "${SUPABASE_URL}/rest/v1/stickers?select=id&face_detected=eq.true&celebrity_id=is.null" \
            -H "apikey: ${SUPABASE_KEY}" \
            -H "Authorization: Bearer ${SUPABASE_KEY}" 2>/dev/null | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
    fi

    echo -e "${YELLOW}📊 Stickers com rosto mas sem celebridade: ${COUNT}${NC}"
    echo ""

    if [ "$COUNT" == "0" ]; then
        echo -e "${GREEN}✅ Nenhum sticker para reprocessar!${NC}"
        exit 0
    fi

    echo -e "${YELLOW}Isso vai resetar ${COUNT} stickers para serem reprocessados no próximo ciclo.${NC}"
    echo ""
    read -p "Confirma? (s/N): " CONFIRM

    if [ "$CONFIRM" != "s" ] && [ "$CONFIRM" != "S" ]; then
        echo -e "${YELLOW}Cancelado.${NC}"
        exit 0
    fi

    echo ""
    echo -e "${YELLOW}🔄 Resetando stickers...${NC}"

    # Executa o UPDATE via Supabase
    RESULT=$(curl -s -X PATCH "${SUPABASE_URL}/rest/v1/stickers?face_detected=eq.true&celebrity_id=is.null" \
        -H "apikey: ${SUPABASE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_KEY}" \
        -H "Content-Type: application/json" \
        -H "Prefer: return=minimal" \
        -d '{"face_detected": null, "face_classified_at": null}' 2>/dev/null)

    echo -e "${GREEN}✅ ${COUNT} stickers resetados!${NC}"
    echo ""
    echo -e "${BLUE}Próximos passos:${NC}"
    echo "  O worker vai reprocessar automaticamente na próxima hora."
    echo "  Ou execute manualmente na VPS:"
    echo "    /opt/face-recognition/scripts/run_face_worker.sh"

    exit 0
fi

# Adicionar celebridade
NOME=$(echo "$1" | tr '[:upper:]' '[:lower:]')  # lowercase
PASTA_FOTOS="$2"

# Se não especificou pasta, usa a padrão
if [ -z "$PASTA_FOTOS" ]; then
    PASTA_FOTOS="$CELEBRIDADES_DIR/$NOME"
fi

if [ ! -d "$PASTA_FOTOS" ]; then
    echo -e "${RED}❌ Pasta não encontrada: $PASTA_FOTOS${NC}"
    echo ""
    echo -e "${YELLOW}Crie a pasta e adicione fotos:${NC}"
    echo "  mkdir -p celebridades/$NOME"
    echo "  # coloque 3-5 fotos na pasta"
    echo "  ./scripts/add-celebrity.sh $NOME"
    exit 1
fi

# Conta fotos
FOTOS=($(find "$PASTA_FOTOS" -maxdepth 1 -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.webp" \)))
NUM_FOTOS=${#FOTOS[@]}

if [ $NUM_FOTOS -eq 0 ]; then
    echo -e "${RED}❌ Nenhuma foto encontrada em: $PASTA_FOTOS${NC}"
    echo "Formatos aceitos: jpg, jpeg, png, webp"
    exit 1
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🎭 Adicionando: ${YELLOW}$NOME${BLUE}                                     ${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}📸 Encontradas $NUM_FOTOS fotos${NC}"

# Cria pasta remota
REMOTE_DIR="/opt/face-recognition/referencias/$NOME"
echo -e "${YELLOW}📁 Criando pasta remota: $REMOTE_DIR${NC}"
vps_exec "mkdir -p $REMOTE_DIR && rm -f $REMOTE_DIR/*"

# Upload das fotos
echo -e "${YELLOW}📤 Enviando fotos...${NC}"
COUNT=0
for foto in "${FOTOS[@]}"; do
    COUNT=$((COUNT + 1))
    FILENAME=$(basename "$foto")
    EXT="${FILENAME##*.}"
    NEW_NAME="${NOME}_${COUNT}.$(echo "$EXT" | tr '[:upper:]' '[:lower:]')"

    echo -e "   [$COUNT/$NUM_FOTOS] $FILENAME -> $NEW_NAME"
    vps_upload "$foto" "$REMOTE_DIR/$NEW_NAME"
done

# Processa embeddings
echo ""
echo -e "${YELLOW}🧠 Processando reconhecimento facial...${NC}"
vps_exec "python3 /opt/face-recognition/scripts/face_classifier.py add $NOME"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ ${NOME} adicionada com sucesso!                         ${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Próximos passos:${NC}"
echo "  - Testar: ./scripts/add-celebrity.sh --test <imagem>"
echo "  - Listar: ./scripts/add-celebrity.sh --list"
