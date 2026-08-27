# 📋 Roteiro de Tarefas (TASKS.md) — LouvorIDB SaaS & App Mobile

> **Objetivo Geral:** Saneamento da arquitetura web, migração de mídias para o Supabase Storage, isolamento multi-tenant (SaaS), suporte offline com IndexedDB, atualizações em tempo real e preparação do ambiente para exportação ao aplicativo móvel nativo (React Native).

---

## 📌 PARTE 1: TAREFAS CONCLUÍDAS DE INFRAESTRUTURA E BASE (ETAPAS 1 A 7)

### 🏗️ ETAPA 1: Arquitetura Limpa, State Manager & Modularização
- [x] **Tarefa 1.1: Criar o State Manager Centralizado (`js/store.js`)**
  - [x] Implementar a classe `Store` com padrões Getters, Setters e PubSub (listeners de eventos).
  - [x] Criar proxies transparentes via `Object.defineProperty` em `window` para garantir retrocompatibilidade com `dadosGlobais`, `usuarioLogado`, `isAdmin`, etc.
- [x] **Tarefa 1.2: Modularizar o Layout HTML em Partial Views (`views/`)**
  - [x] Criar o gerenciador dinâmico de visões `ViewLoader` em `js/router.js`.
  - [x] Extrair o HTML monolítico de `index.html` para visões dinâmicas: `views/secao-cultos.html`, `views/secao-repertorio.html`, `views/secao-novas.html`, `views/secao-midia.html`, `views/admin-panel.html` e `views/modais.html`.
  - [x] Transformar `index.html` em uma casca PWA ultra-leve.

---

### 💬 ETAPA 2: Painel Admin, Solicitações & Aprovação de Tom
- [x] **Tarefa 2.1: Reformular a Aba de Solicitações no Painel Admin**
  - [x] Sub-abas para **⏳ Pendentes** e **✅ Histórico** com badges e contadores.
  - [x] Filtro de busca por texto e categoria.
- [x] **Tarefa 2.2: Modal de Aprovação e Alteração de Tom**
  - [x] Unificar o seletor de músicas para listar tanto músicas do **Repertório Geral** quanto de **Músicas Novas** (em aprendizado).
  - [x] Adicionar alternância entre **✏️ Alterar Versão Existente** e **✨ Criar Nova Versão**.
  - [x] Persistência automática no Supabase `song_versions` e recarregamento dos dados locais.

---

### 🔐 ETAPA 3: Upload Físico de Mídia & Supabase Storage
- [x] **Tarefa 3.1: Utilitário de Upload (`uploadArquivoSupabase`)**
  - [x] Função utilitária em `js/admin.js` integrada ao SDK `@supabase/supabase-js`.
  - [x] Fallback automático para o bucket `media-inbox`.
- [x] **Tarefa 3.2: Formulários de Upload & Player Nativo**
  - [x] Adicionar seletores de arquivo (`<input type="file">`) nos modais de **Nova Música**, **Nova Versão** e **Aprovar & Ajustar Tom**.
  - [x] Atualizar o player de áudio do rodapé em `js/player.js` para renderizar o player nativo HTML5 (`<audio controls autoplay>`) ao carregar URLs do Supabase Storage.

---

### 📱 ETAPA 4: Gerenciador de Modo Offline com IndexedDB
- [x] **Tarefa 4.1: Gerenciador IndexedDB (`js/db.js`)**
  - [x] Criar `LocalDBManager` em `js/db.js` com object stores para `repertorio`, `novas`, `cultos`, `solicitacoes_offline` e `meta`.
  - [x] Integrar auto-persistência nos setters do `Store` (`js/store.js`).
- [x] **Tarefa 4.2: Leitura Offline e Fila de Sincronização**
  - [x] Implementar `carregarDadosOffline()` lendo do IndexedDB quando sem sinal (`!navigator.onLine`).
  - [x] Enfileirar solicitações de tom enviadas offline e sincronizar automaticamente ao reconectar via `sincronizarSolicitacoesOffline()`.
  - [x] Atualizar Service Worker `sw.js` (cache `louvor-idb-v2`) incluindo todas as visões de `views/` e suporte a `ignoreSearch`.

---

### 🔒 ETAPA 5: Isolamento Multi-Tenant & RLS no Supabase
- [x] **Tarefa 5.1: Script SQL RLS Multi-Tenant**
  - [x] Criar o script SQL `supabase_rls_multi_tenant.sql` com a função `SECURITY DEFINER get_user_church_id()` para eliminar a recursão infinita (erro PostgreSQL 42P17).
  - [x] Aplicar políticas RLS para `churches`, `services`, `songs`, `song_versions`, `profiles`, `availability_comments` e `ministries`.
- [x] **Tarefa 5.2: Filtro Duplo de Tenant no Frontend**
  - [x] Atualizar `carregarDados()` em `js/app.js` para identificar a igreja ativa (`currentChurchId`) e filtrar todas as consultas pelo parâmetro `church_id`.

---

### 🚀 ETAPA 6: Onboarding Autônomo SaaS (Cadastrar Minha Igreja)
- [x] **Tarefa 6.1: Modal de Cadastro Público (`views/modais.html`)**
  - [x] Modal `#modal-cadastro-igreja` para registro autônomo com nome da igreja, identificador da igreja e cor do tema.
  - [x] Inclusão de botão em destaque no cabeçalho superior do site.
- [x] **Tarefa 6.2: Provisionamento Automático (`js/app.js`)**
  - [x] Inserir igreja em `churches`, provisionar ministério padrão (*Ministério de Louvor & Adoração*), criar usuário no Supabase Auth (`signUp`) e perfil de Administrador em `profiles`.

---

### ⚡ ETAPA 7: Gestão de Conflitos em Tempo Real (Supabase Realtime UI)
- [x] **Tarefa 7.1: Assinatura de Canais Realtime (`js/app.js`)**
  - [x] Implementar `inicializarRealtimeListeners()` escutando as tabelas `services`, `availability_comments`, `songs` e `song_versions`.
  - [x] Atualizar telas instantaneamente e disparar Toasts amigáveis quando outro usuário realiza edições simultâneas.

---

## 📌 PARTE 2: PRÓXIMAS ETAPAS E PLANO DE EXECUÇÃO DETALHADO (A REALIZAR)

### 📄 ETAPA 8: Exportação de Scripts Nativos para o Holyrics (`h.hly`)
- [x] **Tarefa 8.1: Utilitário de Geração de Script Holyrics (`js/holyrics-exporter.js`)**
  - [x] Criar módulo para geração de scripts nativos JavaScript do Holyrics (`h.hly('AddToPlaylist', { items: [...] })`).
  - [x] Suporte à captura e persistência do `holyrics_id` na importação de JSON do Holyrics (`js/admin.js`).
- [x] **Tarefa 8.2: Interface de Exportação nos Cultos (`js/app.js`)**
  - [x] Adicionar botões **📋 Copiar Script Holyrics** e **📥 Baixar .js** em cada card de culto.
  - [x] Permitir copiar com 1 clique direto para a área de transferência ou baixar o arquivo `.js`.

---

### 🛡️ ETAPA 9: Reforço de Permissões Granulares (RBAC & Gestão de Ministérios)
- [ ] **Tarefa 9.1: Gerenciamento Avançado de Ministérios e Papéis no Admin**
  - [ ] Interface para criação e edição de ministérios customizados (ex: Mídia, Dança, Infantil, Louvor).
  - [ ] Atribuição de instrumentos e responsabilidades aos voluntários.
- [ ] **Tarefa 9.2: Controle Estrito de Acesso a Botões e Telas por Papel**
  - [ ] Garantir que membros comuns só visualizem cultos e repertórios liberados.
  - [ ] Restringir ações de exclusão e edição estritamente aos papéis de `admin` e `lider`.

---

### 📲 ETAPA 10: Otimização PWA, Service Worker & Experiência Mobile Web
- [ ] **Tarefa 10.1: Prompt Personalizado de Instalação do PWA**
  - [ ] Criar banner discreto na tela inicial convidando o usuário a instalar o aplicativo na tela inicial do celular.
  - [ ] Configurar atalhos rápidos (*shortcuts*) no `manifest.json` para abrir direto no repertório ou nos cultos.
- [ ] **Tarefa 10.2: Estratégias Avançadas de Caching para Mídias e Imagens**
  - [ ] Implementar cache Stale-While-Revalidate no Service Worker para capas, ícones e mídias.
  - [ ] Gerenciamento de cota de armazenamento para evitar extrapolar limites do navegador.

---

### 📱 ETAPA 11: Preparação de APIs REST & Modelo de Dados para React Native
- [ ] **Tarefa 11.1: Documentação de Schemas Relacionais e Contratos de API**
  - [ ] Mapeamento completo das rotas do Supabase (`REST API` e `Auth`) para fácil reutilização pelo aplicativo nativo em React Native / Expo.
  - [ ] Padronização das respostas JSON de cultos, versões de músicas e escalas.
