

# Maqz Itinerário — Plano de Implementação

## Visão Geral
Sistema interno de gestão de tarefas e itinerários para empresa de máquinas de costura, acessível via navegador e instalável como PWA no Android. Equipe de até 10 pessoas.

---

## 🎨 Identidade Visual & Layout
- Paleta: **Azul** (primária), **Laranja** (destaque/ações), **Branco** (fundo), **Preto** (texto)
- Design moderno e limpo com botões grandes e ícones claros
- Responsivo para desktop e mobile
- Sidebar de navegação no desktop, bottom navigation no mobile

---

## Fase 1 — Core do Sistema

### 1. Autenticação & Usuários
- Login com email/senha via Supabase Auth
- 3 níveis de permissão: **Administrador**, **Aplicador de Tarefas**, **Funcionário**
- Tabela de roles separada (segurança contra escalação de privilégio)
- Apenas o Administrador cria usuários e define permissões
- Perfil básico do usuário (nome, setor, avatar)

### 2. Setores
- CRUD de setores (apenas Admin)
- Setores iniciais: Balcão, Vendas, Montagem e Entregas, Manutenção
- Associação de funcionários a setores

### 3. Sistema de Tarefas (módulo principal)
- Criação de tarefas com todos os campos obrigatórios:
  - Tipo (Entrega, Retirada, Venda, Manutenção, Garantia, Administrativo, Suporte)
  - Setor, Responsáveis (múltiplos), Cliente (nome, telefone, endereço, CEP)
  - Máquina, Data/Hora, Prazo, Prioridade, Valor (opcional), Observações, Status
- Status: Pendente → Em andamento → Concluído → Cancelado
- **Check de conclusão**: cada responsável marca individualmente; tarefa só conclui quando TODOS confirmam
- Atribuição para múltiplos funcionários de setores diferentes
- Transferência de tarefas e alteração de prazos (apenas quem criou)
- Detecção automática de atraso

### 4. Comunicação na Tarefa
- Campo de comentários dentro de cada tarefa
- Histórico visível com autor e data/hora

### 5. Histórico Completo
- Log automático de: criação, edições, mudanças de prazo, transferências, status
- Visível na tarefa e no painel do Admin

### 6. Visualizações
- **Lista de tarefas** com filtros: funcionário, setor, data, status, prioridade
- **Calendário** semanal e diário com as tarefas
- Dashboard simples do funcionário (minhas tarefas do dia)

### 7. PWA (App Instalável)
- Configuração para instalação no celular via navegador
- Ícone e splash screen com a marca Maqz
- Página de instrução de instalação

---

## Fase 2 — Expansão (futuro)

### 8. Notificações
- Notificações internas no app (sino com badge)
- Push notifications via service worker
- Notificação por e-mail (via Edge Function + Resend)
- Estrutura preparada para futura integração WhatsApp (campo de telefone já coletado)

### 9. Relatórios & Dashboard Admin
- Relatórios por: funcionário, setor, período, tipo, status, valor
- Dashboard com: tarefas abertas, concluídas, atrasadas, produtividade por funcionário
- Exportação de dados

---

## 🗄️ Banco de Dados (Supabase / Lovable Cloud)
- **profiles**: dados do usuário
- **user_roles**: permissões (admin, task_applier, employee)
- **sectors**: setores editáveis
- **tasks**: tarefas com todos os campos
- **task_assignees**: responsáveis por tarefa (muitos-para-muitos)
- **task_comments**: comentários nas tarefas
- **task_history**: log de alterações
- **notifications**: notificações internas

Todas as tabelas com RLS (Row-Level Security) baseada em roles.

