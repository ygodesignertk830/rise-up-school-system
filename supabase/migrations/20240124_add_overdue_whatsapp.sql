-- Add premium_whatsapp_overdue column to schools table
ALTER TABLE public.schools 
ADD COLUMN IF NOT EXISTS premium_whatsapp_overdue BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.schools.premium_whatsapp_overdue IS 'Módulo Premium: Alertas de WhatsApp para mensalidades em ATRASO';
