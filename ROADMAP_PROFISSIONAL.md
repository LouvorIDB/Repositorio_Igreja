# Roadmap Profissional e Arquitetural — LouvorIDB

## 🎯 Objetivo Geral
Evoluir o sistema **LouvorIDB** de um protótipo baseado em planilha (Google Sheets + Apps Script) para um produto **SaaS Profissional, Seguro e Multi-tenant** utilizando **Supabase (PostgreSQL)** como banco de dados e motor de autenticação server-side.

## 🛡️ Diretriz de Execução (Regra de Ouro)
O Agente e o Desenvolvedor devem executar **uma única micro-etapa atômica de cada vez**, testando a paridade funcional e aguardando aprovação explícita antes de avançar para o próximo passo. NENHUM CÓDIGO DEVE SER ALTERADO SEM AUTORIZAÇÃO PRÉVIA.

---

## 📌 HISTÓRICO DE ETAPAS CONCLUÍDAS (FASE 1)

- [x] **ETAPA 1: Modularização do JavaScript**: Fim do arquivo monolítico `index.html`. Separação em `/css/style.css` e `/js` (`config.js`, `utils.js`, `player.js`, `admin.js`, `culto-editor.js`, `app.js`) + Dev Server Vite.
- [x] **ETAPA 2: Autenticação Segura no Servidor**: Remoção da senha do cliente F12. Validação server-side via `validarSenha` no backend Apps Script com `ScriptProperties`.
- [x] **ETAPA 3: Comunicação API Transparente**: Remoção do `mode: 'no-cors'`. Retorno de payloads JSON estruturados, tratamento de erros no frontend e sincronização com `SpreadsheetApp.flush()`.
- [x] **ETAPA 4: Cache Local, PWA & UX**: Implementação do padrão *Stale-While-Revalidate* (`0ms`), PWA instalável com `manifest.json` + `sw.js` + ícones PNG 192/512, atalhos discretos de admin (`Ctrl+Shift+A` / 5 toques no título) e sistema de Toasts.

---

## 🚀 NOVO PLANO DE MIGRAÇÃO: SUPABASE (POSTGRESQL)

---

### FASE 5: Modelagem de Dados & Estruturação do Supabase (SQL & RLS)

#### **Etapa 5.1: Criação do Projeto e Schema Relacional Inicial (SQL)**
**Objetivo**: Criar o projeto no Supabase e executar o script DDL SQL inicial criando as tabelas estruturadas:
1. `churches` (Tenants: `id`, `name`, `slug`, `logo_url`, `theme_color`).
2. `profiles` (Usuários e Voluntários: `id`, `church_id`, `name`, `role`).
3. `songs` (Banco de Músicas: `id`, `church_id`, `title`, `artist`, `status`).
4. `song_versions` (Tons e Variações: `id`, `song_id`, `key`, `variation`, `drive_url`, `youtube_url`).
5. `services` (Cultos: `id`, `church_id`, `date`, `type`, `is_draft`, `is_hidden`).
6. `service_songs` (Músicas do Culto: `id`, `service_id`, `song_version_id`, `order`, `singers_list`).
7. `service_scales` (Escala de Instrumentistas: `id`, `service_id`, `guitar_player_id`, `drummer_id`, `keyboard_player_id`).

#### **Etapa 5.2: Configuração do Multi-Tenancy Nativo (Row Level Security - RLS)**
**Objetivo**: Habilitar RLS em todas as tabelas do PostgreSQL no Supabase e aplicar as políticas de segurança por tenant:
```sql
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolamento por Igreja" ON songs 
FOR ALL USING (church_id = (auth.jwt() ->> 'church_id')::uuid);
```
Garantindo isolamento total de dados entre diferentes igrejas desde o primeiro dia.

---

### FASE 6: Migração de Dados do Legado (Google Sheets ➔ Supabase)

#### **Etapa 6.1: Script de Exportação e Carga (Seeding)**
**Objetivo**: Ler a biblioteca de músicas (`Banco_Musicas` e `Musicas_Novas`), lista de cantores (`Cantores`) e histórico de cultos (`Playlists`) do Google Sheets e popular as tabelas relacionais do Supabase.

#### **Etapa 6.2: Validação da Paridade dos Dados Migrados**
**Objetivo**: Conferir a integridade dos dados migrados no painel do Supabase Studio (Table Editor), confirmando que todos os tons e links de mídia foram preservados.

---

### FASE 7: Substituição da API no Frontend (Desconexão do Apps Script)

#### **Etapa 7.1: Integração da SDK do Supabase em `js/config.js`**
**Objetivo**: Adicionar o cliente Supabase JS (`@supabase/supabase-js`) no projeto e inicializar o cliente em `js/config.js` utilizando `SUPABASE_URL` e `SUPABASE_ANON_KEY`.

#### **Etapa 7.2: Refatoração do Carregamento de Dados (`js/app.js`)**
**Objetivo**: Substituir `fetch(WEB_APP_URL)` por consultas declarativas `supabase.from('services').select(...)` em `js/app.js`, mantendo a camada de cache `localStorage`.

#### **Etapa 7.3: Refatoração da Autenticação Admin (`js/admin.js`)**
**Objetivo**: Substituir a validação via Apps Script por autenticação nativa via `supabase.auth.signInWithPassword()` ou sessão RLS.

#### **Etapa 7.4: Refatoração da Criação e Edição de Cultos (`js/culto-editor.js`)**
**Objetivo**: Substituir a chamada `salvarCulto` pelas operações relacionais `supabase.from('services').upsert(...)` e `supabase.from('service_songs').insert(...)`.

#### **Etapa 7.5: Refatoração das Ações `toggleOculto` e `moverMusicasNovas` (`js/admin.js` e `js/app.js`)**
**Objetivo**: Atualizar o status `is_hidden` via `UPDATE` simples e mover registros da tabela `songs` alterando `status = 'ativo'`.

---

### FASE 8: Homologação Final, Teste PWA e Desativação do Legado

#### **Etapa 8.1: Teste Integrado Fim-a-Fim no PWA**
**Objetivo**: Validar login, criação de cultos, filtro de repertório, reprodução de mídia e cache offline no aplicativo instalado no PC e celular operando via Supabase.

#### **Etapa 8.2: Descontinuação do Google Apps Script (`Código.js`)**
**Objetivo**: Arquivar os scripts legados da pasta `apps-script/` e homologar o aplicativo operando 100% com infraestrutura PostgreSQL no Supabase.