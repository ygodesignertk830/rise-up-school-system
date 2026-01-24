-- Create the authorized_access table
CREATE TABLE IF NOT EXISTS public.authorized_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'school_admin' CHECK (role IN ('school_admin', 'super_admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.authorized_access ENABLE ROW LEVEL SECURITY;

-- Policy: Only super_admins can manage authorized_access
CREATE POLICY "Super admins can manage authorized_access" 
ON public.authorized_access
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.role = 'super_admin'
    )
);

-- Policy: Authenticated users can read their own authorized_access (for login logic)
CREATE POLICY "Users can read their own entry"
ON public.authorized_access
FOR SELECT
USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
);
