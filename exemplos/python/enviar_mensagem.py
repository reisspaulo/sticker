#!/usr/bin/env python3
"""
Exemplo: Enviar mensagem de texto via Evolution API
"""

import requests

# Configurações
API_URL = "http://localhost:8080"
API_KEY = "I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc="
INSTANCE = "meu-whatsapp"


def enviar_texto(numero, mensagem):
    """
    Envia uma mensagem de texto

    Args:
        numero: Número do destinatário (ex: 5511999999999)
        mensagem: Texto da mensagem
    """
    endpoint = f"{API_URL}/message/sendText/{INSTANCE}"

    headers = {
        "apikey": API_KEY,
        "Content-Type": "application/json"
    }

    payload = {
        "number": numero,
        "text": mensagem
    }

    response = requests.post(endpoint, json=payload, headers=headers)

    if response.status_code == 200:
        print(f"✅ Mensagem enviada com sucesso!")
        return response.json()
    else:
        print(f"❌ Erro ao enviar mensagem: {response.status_code}")
        print(response.text)
        return None


if __name__ == "__main__":
    # Exemplo de uso
    numero_destino = "5511999999999"  # Substitua pelo número real
    mensagem = "Olá! Esta é uma mensagem de teste via Evolution API 🚀"

    resultado = enviar_texto(numero_destino, mensagem)
    print(resultado)
