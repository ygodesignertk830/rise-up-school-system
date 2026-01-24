# Guia de Integração Kiwify & Desbloqueio Automático

Este guia explica como configurar seu produto na Kiwify para que, quando uma escola pagar a fatura, o sistema Rise UP a desbloqueie automaticamente.

## Passo 1: Configurar a Edge Function (Cérebro)

1.  Acesse seu painel do **Supabase** > **Edge Functions**.
2.  Crie uma nova função chamada `kiwify_webhook`.
3.  Cole o conteúdo do arquivo `supabase/functions/kiwify_webhook/index.ts` que criei no seu projeto.
4.  Faça o deploy da função (se estiver usando CLI) ou cole no editor online do Supabase se disponível.
5.  Anote a **URL da Função** gerada (ex: `https://seu-projeto.supabase.co/functions/v1/kiwify_webhook`).

## Passo 2: Configurar o Webhook na Kiwify

1.  Acesse sua conta **Kiwify**.
2.  Vá em **Apps** > **Webhooks**.
3.  Clique em **Criar Webhook**.
4.  **Nome**: Desbloqueio Rise UP.
5.  **URL do Webhook**: Cole a URL da função do Passo 1.
6.  **Eventos**: Marque `Compra Aprovada` (Order Approved/Paid).
7.  Em **Produtos**, selecione o produto da mensalidade do seu sistema.
8.  Salvar.

## Passo 3: Configurar o Link de Pagamento no App

1.  No arquivo `App.tsx` do projeto, procure pela linha:
    ```javascript
    const baseUrl = "https://pay.kiwify.com.br/SEU_LINK_AQUI";
    ```
2.  Substitua `SEU_LINK_AQUI` pelo código do seu checkout da Kiwify (ex: `5e9f8a...`).

## Como Funciona o Fluxo

1.  Quando a escola está bloqueada, o usuário clica em "Pagar Agora".
2.  O sistema envia ele para a Kiwify carregando o ID da Escola invisivelmente.
3.  O usuário paga (Pix cai na hora).
4.  A Kiwify avisa seu Supabase via Webhook.
5.  O Supabase recebe o aviso, acha a escola e muda o status para `Ativo` e adiciona `30 dias` ao vencimento.
6.  Na próxima vez que o usuário atualizar a página (F5), o acesso estará liberado.
