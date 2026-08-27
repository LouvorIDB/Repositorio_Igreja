# Planos Futuros e Análise do Projeto — LouvorIDB

Este documento apresenta uma análise profunda da estrutura atual do projeto, lista o status das funcionalidades e traça um roteiro estratégico para comercialização (SaaS) e transformação em aplicativos nativos (Android/iOS).

---

## 1. Análise Profunda dos Arquivos do Projeto

### Arquivos de Configuração e Raiz
*   **`index.html`**
    *   **O que faz:** É o ponto de entrada principal (Single Page Application - SPA). Contém toda a estrutura de UI (Modais, Abas de Navegação, Painel de Admin, Cards).
    *   **Importância:** Crítica. Define a interface com a qual o usuário interage.
    *   **Mudanças para Comercialização:** Atualmente o arquivo é monolítico (mais de 1000 linhas) e mistura todas as telas (usuário comum e admin). Para escalar como um SaaS, a interface precisará ser componentizada (usando um framework como React/Next.js ou Vue.js).
*   **`sw.js` & `manifest.json`**
    *   **O que faz:** Configuram a aplicação como um PWA (Progressive Web App). O `sw.js` (Service Worker) lida com o cache offline (*Stale-While-Revalidate*) e interceptação de requisições. O `manifest.json` define como o app é instalado na tela inicial.
    *   **Importância:** Alta, pois garante o funcionamento offline em ensaios de igreja onde a internet pode falhar.
    *   **Mudanças para Comercialização:** O cache atual é genérico. Será necessário implementar estratégias mais robustas (ex: cachear PDFs de cifras, áudios offline) e suporte a Notificações Push para avisar músicos sobre mudanças de escala.
*   **`package.json` & `package-lock.json`**
    *   **O que faz:** Gerencia as dependências do projeto (Vite, Supabase-js).
    *   **Importância:** Estrutural.

### Diretório `/css/`
*   **`style.css`**
    *   **O que faz:** Regras CSS complementares (já que a maioria do estilo é gerada pelo TailwindCSS via CDN no `index.html`).
    *   **Importância:** Baixa.
    *   **Mudanças para Comercialização:** Migrar o Tailwind do CDN para um processo de *build* (PostCSS) para otimizar o tamanho final do CSS, removendo classes não utilizadas (PurgeCSS).

### Diretório `/js/` (Lógica da Aplicação)
*   **`config.js`**
    *   **O que faz:** Inicializa o cliente do Supabase e define as variáveis de estado globais (`dadosGlobais`, `usuarioLogado`, `isAdmin`).
    *   **Importância:** Alta. Centraliza o estado.
    *   **Mudanças para Comercialização:** Variáveis globais não são escaláveis. O estado precisará ser gerenciado por bibliotecas dedicadas (Redux, Zustand, ou Vuex) para evitar comportamentos inesperados entre abas e modais.
*   **`app.js`**
    *   **O que faz:** Lógica principal da visão do usuário. Faz as consultas (queries) no Supabase, renderiza as listas de cultos, repertório e gerencia a autenticação e permissões baseadas em funções (RBAC).
    *   **Importância:** Crítica.
    *   **Mudanças para Comercialização:** O arquivo mistura requisições ao banco de dados com manipulação direta do DOM (`innerHTML`). Para um produto SaaS comercial, a camada de UI deve ser estritamente separada da camada de dados (arquitetura MVC ou similar).
*   **`admin.js`**
    *   **O que faz:** Gerencia as rotinas restritas a líderes/administradores (criar ministérios, aprovar músicas novas, editar repertório, configurações globais).
    *   **Importância:** Alta.
    *   **Mudanças para Comercialização:** Adicionar validações de segurança severas tanto no *client-side* quanto no *server-side* (Supabase RLS) para garantir que um admin de uma igreja não altere dados de outra igreja (Multi-tenancy isolation).
*   **`culto-editor.js`**
    *   **O que faz:** Controlador exclusivo para o fluxo de "Montar/Editar Culto" (adicionar músicas, definir ordem, escalar músicos e cantores).
    *   **Importância:** Alta. É o núcleo do produto para os líderes.
    *   **Mudanças para Comercialização:** Precisa de suporte a edições simultâneas (Realtime). Se dois líderes editarem a mesma escala ao mesmo tempo, um pode sobrescrever o outro. O Supabase Realtime deve ser ativado para esta funcionalidade.
*   **`player.js`**
    *   **O que faz:** Gerencia a reprodução de mídias (Vídeos do YouTube, Áudios de VS do Google Drive).
    *   **Importância:** Média/Alta.
    *   **Mudanças para Comercialização:** O Google Drive costuma bloquear reproduções em massa via iframe ou links diretos quando o tráfego aumenta. Para uso comercial pesado, os arquivos VS precisarão ser migrados para o Supabase Storage ou AWS S3.
*   **`utils.js`**
    *   **O que faz:** Funções de apoio (Toasts, extração de IDs, formatação de datas).
    *   **Importância:** Média.

---

## 2. Funcionalidades do Site e Pontos de Melhoria

### Funcionalidades Presentes:
1.  **Montagem e Escala de Cultos:** Funcional.
2.  **Gerenciamento de Repertório Geral e Músicas Novas:** Funcional.
3.  **Transposição de Cifras Dinâmica:** Funcional.
4.  **Autenticação e Permissões (RBAC):** Funcional (baseado no Supabase).
5.  **Multi-tenancy:** O banco suporta múltiplas igrejas (via `church_id`), mas o frontend precisa de aprimoramentos no onboarding.
6.  **Importação do Holyrics:** Funcional via JSON.

### O que está inacabado, precisa de otimização ou alteração:
1.  **Onboarding de Novas Igrejas (Inacabado):** O site não possui uma "Landing Page" clara onde uma nova igreja se cadastra, cria seu "Tenant" (espaço) e assina um plano. Atualmente foca apenas no login de quem já está no banco.
2.  **Painel de Solicitações (Inacabado):** Usuários podem pedir "Ajustes de tom" e "Sugestões de Culto", mas a visualização do lado do admin (Aba Solicitações) e o fluxo de aprovação/rejeição precisam ser mais fluídos.
3.  **Arquitetura do Frontend (Otimização Extrema):** O Vanilla JS foi excelente para validar o MVP, mas para escalar e manter um time de desenvolvedores na comercialização, reescrever a camada visual em **React.js (Next.js)** ou **Vue.js** é um requisito vital.
4.  **Armazenamento de Mídia (Alteração):** Depender do Google Drive e links abertos do YouTube pode gerar quebras por mudanças nas políticas dessas empresas. O ideal é o upload direto no Supabase Storage.
5.  **Offline Total (Otimização):** O Service Worker faz cache da estrutura do app, mas para ler letras e cifras no celular 100% offline (Modo Avião durante o culto), os dados devem ser sincronizados em bancos locais no navegador (IndexedDB).

---

## 3. Plano Estratégico: Transformação para Aplicativo Android/iOS

Dado que o backend no Supabase já expõe APIs RESTFul, a migração para mobile é altamente viável e foca puramente no Frontend.

### Opção 1: O Caminho Rápido (PWA Embalado)
Como o projeto já é um PWA moderno, podemos gerar arquivos `.apk` e `.aab` (Android) e submeter à Apple Store envelopando o site atual em uma "WebView" nativa usando tecnologias como **Capacitor** ou **PWA Builder / Bubblewrap**.
*   **Prós:** Custos quase zero, base de código única, tempo de lançamento de 1 semana.
*   **Contras:** Experiência de usuário um pouco inferior à um app nativo; limitações com reprodução de áudio em background do celular.

### Opção 2: O Caminho Robusto e Comercial (Recomendado)
Desenvolver aplicativos nativos híbridos utilizando **React Native** com **Expo**.
*   **Fase 1: Configuração do Expo e Supabase**
    *   Iniciar um projeto React Native (Expo).
    *   Instalar a SDK do `@supabase/supabase-js`.
    *   Compartilhar as mesmas consultas SQL e lógicas de RLS que já existem hoje. O backend não sofre 1 linha de alteração.
*   **Fase 2: Reconstrução das Telas Principais (Mobile-first)**
    *   Tela de Login nativa com biometria (FaceID/TouchID).
    *   Feed de Cultos: Lista vertical com os próximos eventos da escala do músico logado.
    *   Modo "Palco" (Stage Mode): Uma tela que impede a tela do celular de desligar (`expo-keep-awake`) e exibe as cifras em alto contraste (Dark Mode absoluto).
*   **Fase 3: Funcionalidades Nativas Extras**
    *   **Notificações Push nativas:** Avisar músicos "Você foi escalado para Domingo", "Nova música adicionada ao repertório".
    *   **Player de Áudio em Background:** O músico pode ouvir o 'VS' da música mesmo bloqueando a tela do celular.
*   **Fase 4: Publicação (Lojas)**
    *   Submissão na Google Play Store.
    *   Submissão na Apple App Store (requer conta de desenvolvedor Apple e adequação às políticas estritas da Apple para apps SaaS).
*   **Prós:** Experiência Premium, alto engajamento, valor percebido como produto SaaS comercial é muito maior.
*   **Contras:** Requer tempo de desenvolvimento médio (1 a 3 meses) para reescrever as interfaces visuais em componentes React Native.

### Resumo para Comercialização
1. Estabelecer o fluxo de cobrança (Stripe Integration).
2. Construir a Landing Page Comercial (Marketing, Planos, Preços).
3. Reescrever o portal Web para React/Next.js focando em manutenção.
4. Lançar o App Mobile (React Native) voltado para a experiência do Músico (Visualização de Escala, Letras/Cifras offline e Player de Áudio).

---

## 4. Plano de Integração com o WhatsApp (Notificação de Escalas)

Para automatizar e facilitar a comunicação com os músicos e cantores escalados nos cultos, a implementação de envios de mensagens via WhatsApp será um grande diferencial no sistema SaaS. Abaixo está o roteiro sugerido:

### Opção 1: Geração de Link Dinâmico (Frontend/Gratuito)
A forma mais simples e inicial, sem custos de API, é gerar links utilizando a API nativa do WhatsApp (`wa.me`).
*   **Como funciona:** No painel do "Culto", após finalizar a montagem, o administrador terá acesso a um botão "Notificar Escala". O sistema varrerá a lista de músicos escalados, coletará os telefones no banco de dados (`profiles`), formatará uma mensagem amigável (ex: *"Olá [Nome], você foi escalado para o culto de [Data] tocando [Instrumento]. Confira o repertório clicando aqui: [Link do Site]"*) e abrirá o WhatsApp Web ou o App nativo para o líder apenas clicar em "Enviar" um por um.
*   **Vantagem:** Desenvolvimento extremamente rápido e custo zero.
*   **Desvantagem:** Requer ação manual do líder/admin para cada integrante.

### Opção 2: Integração com a WhatsApp Cloud API (Automático/SaaS)
Para a versão SaaS final, o sistema deve enviar mensagens de forma automática e "invisível" para o administrador.
*   **Como funciona:** Utilização da **WhatsApp Cloud API** (fornecida nativamente pela Meta) ou gateways homologados (ex: Z-API, Twilio). Assim que o admin clicar no botão "Publicar Culto" ou "Notificar Músicos", o *backend* (através do Supabase Edge Functions) dispara os templates predefinidos diretamente para o telefone de todos os escalados em milissegundos.
*   **Vantagem:** 100% automático, garantindo que o músico sempre será notificado imediatamente sem exigir tempo do líder do ministério.
*   **Desvantagem:** Existe um pequeno custo (em dólar) cobrado pela Meta por disparo de mensagem de serviço. O projeto precisará embutir esse valor no modelo financeiro da assinatura SaaS.

### Opção 3: Chatbots e Lembretes Agendados (Avançado)
*   Implementar uma rotina automatizada (*CRON jobs* no Supabase) conectada à API do WhatsApp.
*   Se o músico estiver escalado para o domingo de manhã, o sistema dispara automaticamente na sexta-feira à noite um lembrete como: *"Passando para lembrar do seu compromisso neste domingo no louvor! Não se esqueça de revisar o repertório."*
*   Permitir que o usuário responda com *"Confirmar"* ou *"Não poderei ir"* via WhatsApp e o sistema atualizar o status diretamente no painel do administrador.
