-- SQL-MVP-FASE1.sql
-- Script de criação das tabelas essenciais para o MVP Leaf by Ginkgo
-- Execute este script no SQL Editor do Supabase

-- 1. Habilitar extensão para UUIDs e Vetores (se ainda não estiver)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Tabela de Leads (CRM Básico)
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone TEXT UNIQUE NOT NULL,
    name TEXT,
    status TEXT DEFAULT 'novo' CHECK (status IN ('novo', 'qualificando', 'qualificado', 'handoff', 'convertido', 'perdido')),
    score INTEGER DEFAULT 0,
    interesse TEXT,
    origem TEXT DEFAULT 'whatsapp',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela de Mensagens (Histórico de Conversas)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'agent', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabela de Logs do Agente (Auditoria)
CREATE TABLE IF NOT EXISTS public.agent_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Função e Trigger para atualizar o updated_at automaticamente
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_leads_modtime ON public.leads;
CREATE TRIGGER update_leads_modtime
    BEFORE UPDATE ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- 6. Habilitar RLS (Row Level Security) - Configuração inicial permissiva para o MVP
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas para o MVP (Atenção: em produção real, restrinja isso)
CREATE POLICY "Permitir tudo para leads no MVP" ON public.leads FOR ALL USING (true);
CREATE POLICY "Permitir tudo para messages no MVP" ON public.messages FOR ALL USING (true);
CREATE POLICY "Permitir tudo para agent_logs no MVP" ON public.agent_logs FOR ALL USING (true);

-- Comentários para documentação
COMMENT ON TABLE public.leads IS 'Tabela principal de leads capturados pelo Brann.';
COMMENT ON TABLE public.messages IS 'Histórico de conversas entre o lead e o agente Brann.';
COMMENT ON TABLE public.agent_logs IS 'Registro de ações e decisões tomadas pelo agente.';
