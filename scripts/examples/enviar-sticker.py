#!/usr/bin/env python3
"""
Script para enviar stickers via Evolution API
"""

import requests
import base64
import sys
from pathlib import Path

# Configurações da API
API_URL = "http://localhost:8080"
API_KEY = "I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc="
INSTANCE = "meu-zap"


def enviar_sticker_url(numero, url_imagem):
    """
    Envia um sticker via URL

    Args:
        numero: Número do destinatário no formato 5511999999999
        url_imagem: URL da imagem (PNG, JPG, WebP)
    """
    endpoint = f"{API_URL}/message/sendSticker/{INSTANCE}"

    headers = {
        "apikey": API_KEY,
        "Content-Type": "application/json"
    }

    payload = {
        "number": numero,
        "sticker": url_imagem  # v2.2.3+ usa string direta
    }

    response = requests.post(endpoint, json=payload, headers=headers)
    return response.json()


def enviar_sticker_arquivo(numero, caminho_arquivo):
    """
    Envia um sticker a partir de um arquivo local

    Args:
        numero: Número do destinatário no formato 5511999999999
        caminho_arquivo: Caminho para o arquivo de imagem
    """
    # Ler o arquivo e converter para base64
    arquivo = Path(caminho_arquivo)

    if not arquivo.exists():
        return {"error": f"Arquivo não encontrado: {caminho_arquivo}"}

    # Detectar tipo MIME
    extensao = arquivo.suffix.lower()
    mime_types = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp'
    }

    mime_type = mime_types.get(extensao, 'image/png')

    # Ler e converter para base64
    with open(arquivo, 'rb') as f:
        imagem_base64 = base64.b64encode(f.read()).decode('utf-8')

    # Criar data URI
    data_uri = f"data:{mime_type};base64,{imagem_base64}"

    endpoint = f"{API_URL}/message/sendSticker/{INSTANCE}"

    headers = {
        "apikey": API_KEY,
        "Content-Type": "application/json"
    }

    payload = {
        "number": numero,
        "sticker": data_uri  # v2.2.3+ usa string direta
    }

    response = requests.post(endpoint, json=payload, headers=headers)
    return response.json()


def main():
    """Exemplo de uso"""
    print("=" * 50)
    print("Evolution API - Enviar Sticker")
    print("=" * 50)
    print()

    if len(sys.argv) < 3:
        print("Uso:")
        print("  python3 enviar-sticker.py <numero> <url_ou_arquivo>")
        print()
        print("Exemplos:")
        print("  # Via URL:")
        print("  python3 enviar-sticker.py 5511999999999 https://exemplo.com/sticker.png")
        print()
        print("  # Via arquivo local:")
        print("  python3 enviar-sticker.py 5511999999999 ./minha-imagem.png")
        print()
        return

    numero = sys.argv[1]
    origem = sys.argv[2]

    print(f"Destinatário: {numero}")
    print(f"Origem: {origem}")
    print()

    # Verificar se é URL ou arquivo
    if origem.startswith('http://') or origem.startswith('https://'):
        print("📡 Enviando via URL...")
        resultado = enviar_sticker_url(numero, origem)
    else:
        print("📁 Enviando arquivo local...")
        resultado = enviar_sticker_arquivo(numero, origem)

    print()
    print("Resultado:")
    print(resultado)


if __name__ == "__main__":
    main()
