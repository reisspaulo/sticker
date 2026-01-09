#!/bin/bash

# 🔧 SETUP GIT HOOKS
#
# Instala os hooks de git para validação de documentação

echo "🔧 Instalando git hooks..."

# Copia pre-commit hook
if [ -f ".git-hooks/pre-commit" ]; then
  cp .git-hooks/pre-commit .git/hooks/pre-commit
  chmod +x .git/hooks/pre-commit
  echo "✅ Pre-commit hook instalado"
else
  echo "❌ Arquivo .git-hooks/pre-commit não encontrado"
  exit 1
fi

echo ""
echo "✅ Git hooks instalados com sucesso!"
echo ""
echo "📝 O pre-commit hook vai:"
echo "   1. Detectar mudanças em arquivos de fluxo"
echo "   2. Lembrar você de atualizar FLOWCHARTS.md"
echo "   3. Perguntar se quer continuar se não atualizou"
echo ""
