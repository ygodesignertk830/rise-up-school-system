# Guia de Configuração Pagar.me V5 (Pix Automático)

Este guia explica como ativar o sistema de Pix via API da Pagar.me para desbloqueio automático.

## 1. Obter Chaves de API (Pagar.me)

1.  Acesse seu Dashboard Pagar.me (versão 5).
2.  Vá em **Configurações** > **Chaves de API**.
3.  Copie a **Chave Secreta** (inicia com `sk_` ou `ak_`). Se for teste, usa `sk_test_...`.

## 2. Configurar Segredos no Supabase

Para que a função funcione, ela precisa dessa chave.
1.  Vá no seu painel Supabase > **Project Settings** > **Edge Functions** (ou Secrets).
2.  Adicione um novo segredo:
    *   **Name**: `PAGARME_API_KEY`
    *   **Value**: (Cole sua chave secreta da Pagar.me aqui)

## 3. Deploy das Functions

Você precisa criar e fazer deploy das duas funções que deixei na pasta `supabase/functions/`:
1.  `pagarme_create_order`: Gera o QR Code.
2.  `pagarme_webhook`: Recebe a confirmação.

## 4. Configurar Webhook na Pagar.me

Para o desbloqueio funcionar, a Pagar.me precisa avisar o Supabase.
1.  No Dashboard Pagar.me > **Configurações** > **Webhooks**.
2.  Criar Webhook.
3.  **URL**: URL da sua function `pagarme_webhook` (ex: `https://seu-ref.supabase.co/functions/v1/pagarme_webhook`).
4.  **Eventos**: Selecione `order.paid` e `charge.paid`.

## 5. Pronto!

Agora, no painel do sistema, ao clicar em "Gerar Pix", o QR Code será gerado usando sua conta Pagar.me.
