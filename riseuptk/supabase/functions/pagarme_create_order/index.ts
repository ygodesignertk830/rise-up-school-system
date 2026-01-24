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

        const { schoolId, amount } = await req.json()
        const PAGARME_API_KEY = Deno.env.get('PAGARME_API_KEY') // User must set this secret

        if (!schoolId) throw new Error('School ID is required')
        if (!PAGARME_API_KEY) throw new Error('Pagar.me API Key not configured')

        // 1. Fetch school owner details for the customer object
        const { data: school } = await supabase.from('schools').select('name, owner_email').eq('id', schoolId).single()

        // Default or fetched customer info
        const customerName = school?.name || "Cliente Rise Up"
        const customerEmail = school?.owner_email || "financeiro@riseup.school"

        // 2. Create Order in Pagar.me V5
        const body = {
            items: [
                {
                    amount: amount || 25000, // Default 250.00 in cents
                    description: "Mensalidade Sistema Rise Up",
                    quantity: 1,
                    code: "SAAS-MONTHLY"
                }
            ],
            customer: {
                name: customerName,
                email: customerEmail,
                type: "individual",
                document: "00000000000", // Pagar.me sandbox requires valid format, usually CPF/CNPJ. For production, user should provide real data. Using dummy for now or logic to fetch from school if stored.
                phones: {
                    mobile_phone: {
                        country_code: "55",
                        area_code: "11",
                        number: "999999999"
                    }
                }
            },
            payments: [
                {
                    payment_method: "pix",
                    pix: {
                        expires_in: 3600 // 1 hour
                    }
                }
            ],
            metadata: {
                school_id: schoolId,
                system: "rise-up"
            }
        }

        const response = await fetch('https://api.pagar.me/core/v5/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + btoa(PAGARME_API_KEY + ':')
            },
            body: JSON.stringify(body)
        })

        const orderData = await response.json()

        if (response.status !== 200) {
            console.error("Pagar.me Error:", orderData)
            throw new Error(`Erro Pagar.me: ${JSON.stringify(orderData)}`)
        }

        // Extract QR Code
        const last Transaction = orderData.charges[0].last_transaction
        const qrCode = last Transaction.qr_code
        const qrCodeUrl = lastTransaction.qr_code_url

        return new Response(JSON.stringify({ qrCode, qrCodeUrl, orderId: orderData.id }), {
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
