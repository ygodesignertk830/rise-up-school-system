# 🌌 Rise UP School System - Mapa de Funcionalidades

Este documento lista todas as funcionalidades implementadas e ativas no sistema, servindo como um guia de capacidades da plataforma.

## 🔑 1. Autenticação e Segurança
- [x] **Login Seguro**: Autenticação via Supabase com proteção de rotas.
- [x] **Níveis de Acesso**: Diferenciação entre `Super Admin` (Gestor do SaaS) e `Escola` (Diretores/Secretaria).
- [x] **Bloqueio de Inadimplência**: Sistema que bloqueia automaticamente o acesso da escola caso a assinatura do sistema esteja vencida.

## 👥 2. Gestão de Alunos e Turmas
- [x] **Cadastro Completo**: Nome, Foto, Valor da Mensalidade, Data de Matrícula e Turma.
- [x] **Gestão de Turmas**: Criação e edição de turmas para organização dos alunos.
- [x] **Dossiê do Aluno**: Painel individual para cada aluno mostrando histórico financeiro e dados cadastrais.
- [x] **Status Automático**: Identificação visual de alunos ativos ou com pendências.

## 💰 3. Financeiro Inteligente (Destaque)
- [x] **Geração Automática**: O sistema gera mensalidades automaticamente todo mês com base no dia de vencimento de cada aluno.
- [x] **Cálculo de Juros (Real-Time)**:
    - 1% de multa fixa após o vencimento.
    - 0.1% de juros por dia de atraso.
- [x] **Gestão de Perdão de Dívida**:
    - Botão **PERDOAR**: Remove os juros de uma parcela atrasada.
    - Botão **RESTAURAR**: Permite desfazer o perdão, voltando a cobrar os juros calculados.
- [x] **Filtros Financeiros**: Visualização por pagos, pendentes e atrasados.

## 📝 4. Pedagógico (Diário de Classe)
- [x] **Frequência Diária**: Registro de presença/falta de forma simples e intuitiva.
- [x] **Registro de Conteúdo**: Campo para descrever a matéria ministrada em cada aula.
- [x] **Exportação PDF Mensal (Premium)**:
    - Layout Horizontal (Landscape).
    - Temática Espacial (Fundo Deep Space e Estrelas).
    - **Filtro de Dias Úteis**: Gera o relatório apenas de Segunda a Sexta.
    - **Anotação P/F**: Marcadores claros para Presente (P) e Falta (F).
    - **Resumo de Matéria**: Inclui no final do PDF tudo o que foi ensinado no mês.

## 🎨 5. Interface e Experiência do Usuário (UI/UX)
- [x] **Tema Dark Premium**: Design moderno em tons de Slate e Safira.
- [x] **Alertas Customizados**: Uso de `SweetAlert2` para confirmações e notificações elegantes.
- [x] **Animações Fluidas**: Feedback visual via `Framer Motion` em listas e modais.
- [x] **Responsive Design**: Adaptado para Desktop e Tablets.

---
*Atualizado em: 23/01/2026*
