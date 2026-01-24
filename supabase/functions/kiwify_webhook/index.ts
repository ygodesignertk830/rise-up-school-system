// Serve this with Deno (Supabase Edge Functions)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Receber payload da Kiwify
        // A Kiwify envia os dados como form-data ou JSON. Geralmente JSON em webhooks modernos.
        const body = await req.json()
        console.log("Webhook received:", body)

        // 2. Validar Status do Pagamento
        // Kiwify status: 'paid', 'refunded', 'chargedback'
        const status = body.order_status;

        if (status !== 'paid') {
            return new Response(JSON.stringify({ message: 'Order not paid', status }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200, // Retornar 200 pra Kiwify não ficar tentando reenviar se não for erro nosso
            })
        }

        // 3. Extrair ID da Escola dos Parâmetros Personalizados
        // Na URL de checkout: ?school_id=... -> Kiwify repassa isso no objeto de params ou metadata
        // Kiwify structure varies, check documentation. Usually checks URL params passed during purchase.
        // Ou verificamos o email do comprador.

        const schoolId = body.x_custom_id || body.metadata?.school_id || null;
        const payerEmail = body.Customer?.email || body.email;

        let targetSchoolId = schoolId;

        if (!targetSchoolId && payerEmail) {
            // Tentar achar escola pelo email
            const { data: school } = await supabase
                .from('schools')
                .select('id')
                .eq('owner_email', payerEmail)
                .single();

            if (school) targetSchoolId = school.id;
        }

        if (!targetSchoolId) {
            throw new Error("Escola não identificada no pagamento.");
        }

        // 4. Desbloquear a Escola
        // Add 30 days to current date or existing due date
        const today = new Date();
        const nextDueDate = new Date(today.setDate(today.getDate() + 30)).toISOString().split('T')[0];

        const { error: updateError } = await supabase
            .from('schools')
            .update({
                active: true,
                subscription_due_date: nextDueDate, // Renova por 30 dias
            })
            .eq('id', targetSchoolId)

        if (updateError) throw updateError;

        return new Response(JSON.stringify({ message: 'School unlocked successfully', schoolId: targetSchoolId }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
