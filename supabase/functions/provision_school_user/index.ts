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
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { email, password, school_id, role } = await req.json()

        if (!email || !password || !school_id) {
            throw new Error('Email, password and school_id are required')
        }

        // 1. Create Auth User
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { school_id, role }
        })

        if (authError) throw authError

        // 2. Create Public Profile
        const { error: profileError } = await supabaseAdmin
            .from('users')
            .upsert({
                id: authUser.user.id,
                email: email.toLowerCase(),
                role: role || 'school_admin',
                school_id
            })

        if (profileError) throw profileError

        // 3. Create Authorization Record (for tracking)
        const { error: accessError } = await supabaseAdmin
            .from('authorized_access')
            .upsert({
                email: email.toLowerCase(),
                school_id,
                role: role || 'school_admin'
            })

        if (accessError) throw accessError

        return new Response(
            JSON.stringify({ message: 'User provisioned successfully', user_id: authUser.user.id }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
