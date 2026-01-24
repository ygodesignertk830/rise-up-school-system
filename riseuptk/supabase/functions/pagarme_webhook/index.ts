// Serve this with Deno (Supabase Edge Functions)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const body = await req.json()
        console.log("Pagar.me Webhook:", body)

        // Pagar.me V5 structure: body.type and body.data
        const eventType = body.type
        const data = body.data

        if (eventType === 'order.paid' || eventType === 'charge.paid') {
            const schoolId = data.metadata?.school_id || data.order?.metadata?.school_id

            if (schoolId) {
                console.log(`Pagamento confirmado para escola: ${schoolId}`)

                // Desbloqueia
                const today = new Date();
                const nextDueDate = new Date(today.setDate(today.getDate() + 30)).toISOString().split('T')[0];

                await supabase.from('schools').update({
                    active: true,
                    subscription_due_date: nextDueDate
                }).eq('id', schoolId)

                return new Response(JSON.stringify({ message: "Unlocked" }), { status: 200 })
            }
        }

        return new Response(JSON.stringify({ message: "Received" }), { status: 200 })

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400 })
    }
})
