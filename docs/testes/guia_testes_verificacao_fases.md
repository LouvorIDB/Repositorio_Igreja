# 🧪 Guia de Testes de Verificação & Não-Regressão por Fase
**Projeto:** Liturge — Gestão de Louvor & Cultos (`LouvorIDB / Repositorio_Igreja`)  
**Finalidade:** Roteiro prático para o desenvolvedor testar a aplicação após cada fase do Master Plan, garantindo que a segurança está ativa e que nenhuma funcionalidade existente foi corrompida.

---

## 🧭 Como Funciona a Filosofia de Testes

Como professor e desenvolvedor com forte raciocínio lógico, dividimos cada teste em três elementos matematicamente claros:
1. **Entrada / Ação:** O que você vai fazer ou clicar.
2. **Comportamento Esperado (Sucesso):** O que o sistema DEVE fazer se tudo estiver correto.
3. **Sinal de Falha (Regressão):** O que aconteceria se algo tivesse quebrado.

---

# 🔴 FASE 1: TESTES DE SEGURANÇA, RLS & PWA OFFLINE (EXECUTAR AGORA)

Você acabou de rodar o script [sql/patch_seguranca_urgente_rls.sql](file:///c:/Users/Jã1/Documents/GitHub/Repositorio_Igreja/sql/patch_seguranca_urgente_rls.sql). Execute os testes abaixo no seu navegador (Google Chrome, Edge ou Brave) com o site aberto (`npm run dev` ou servido localmente).

---

### Teste 1.1: Prova de Bloqueio da Função Crítica (`delete_church_cascade`)
* **Por que testar:** Antes do patch, qualquer pessoa anônima podia apagar uma igreja inteira com um comando no console. Agora, o PostgreSQL deve rejeitar categoricamente.
* **Passo a passo:**
  1. Abra o site no navegador.
  2. Pressione `F12` no teclado para abrir o **DevTools** e clique na aba **Console**.
  3. Cole o comando abaixo e pressione `Enter`:
     ```javascript
     await supabaseClient.rpc('delete_church_cascade', { target_church_id: '00000000-0000-0000-0000-000000000000' });
     ```
* **✅ Comportamento Esperado:**
  O console deve retornar um erro vermelho com código `401 Unauthorized` ou `403 Forbidden` ou mensagem contendo:
  `"permission denied for function delete_church_cascade"` ou `"Acesso negado"`.
* **❌ Sinal de Falha:** Se retornar `{ data: true, error: null }` ou permitir a execução sem erro de permissão.

---

### Teste 1.2: Prova de Blindagem de Deleção de Perfis por Anônimos
* **Por que testar:** As políticas antigas continham `FOR DELETE USING (true)`, permitindo que scripts limpassem a lista de voluntários.
* **Passo a passo:**
  1. No mesmo console `F12`, cole o comando:
     ```javascript
     const { data, error } = await supabaseClient.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
     console.log('Resultado do teste:', { data, error });
     ```
* **✅ Comportamento Esperado:**
  `error` deve conter uma violação de política RLS (`new row violates row-level security policy` ou `permission denied`), e **nenhum** perfil deve ser excluído do banco.
* **❌ Sinal de Falha:** Se `error` for `null` e registros forem deletados.

---

### Teste 1.3: Login Administrativo Multi-tenant (Sem e-mail hardcoded)
* **Por que testar:** Removemos o e-mail pessoal fixo do desenvolvedor. O modal agora precisa aceitar o e-mail do próprio administrador da igreja.
* **Passo a passo:**
  1. Pressione o atalho `Ctrl + Shift + A` no teclado (ou dê 5 toques rápidos no título do site).
  2. O modal **"🔐 Acesso Administrativo"** deve abrir na tela exibindo **dois campos**:
     * Campo 1: E-mail cadastrado.
     * Campo 2: Senha.
  3. Digite o seu e-mail e sua senha de administrador e clique em **Entrar**.
* **✅ Comportamento Esperado:**
  O modal fecha, exibe o toast verde *"Acesso administrativo concedido!"* e abre o Painel Admin com todas as abas funcionais (Cultos, Equipe, Repertório, etc.).
* **❌ Sinal de Falha:** Se aparecer erro *"ADMIN_EMAIL is not defined"* no console ou se o campo de e-mail não estiver visível.

---

### Teste 1.4: Funcionamento do Novo Service Worker (`liturge-v2`)
* **Por que testar:** O Service Worker foi atualizado para cachear os novos módulos de Agenda, Almoxarifado, Analytics e Holyrics.
* **Passo a passo:**
  1. No DevTools (`F12`), vá na aba **Application** (ou *Aplicativo*).
  2. No menu lateral esquerdo, clique em **Service Workers**.
  3. Verifique o status: deve estar ativo e rodando.
  4. Clique em **Storage** (ou *Armazenamento*) -> **Cache Storage** (ou *Armazenamento de Cache*).
  5. Você deve ver o cache nomeado **`liturge-v2`**. Ao clicar nele, confirme que arquivos como `almoxarifado.js`, `analytics.js`, `agenda.js` e `views/secao-agenda.html` estão listados.
* **✅ Comportamento Esperado:** O cache `liturge-v2` armazena 28 arquivos essenciais para o app.
* **❌ Sinal de Falha:** Se o cache continuar com o nome `liturge-v1` ou acusar erro de download.

---

### Teste 1.5: Teste Offline Real (Simulação de Ensaio sem Internet)
* **Por que testar:** Garantir que músicos e líderes consigam usar a ferramenta dentro da igreja mesmo se o Wi-Fi falhar.
* **Passo a passo:**
  1. No DevTools (`F12`), abra a aba **Network** (ou *Rede*).
  2. No seletor de velocidade onde diz *No throttling* (ou *Sem limitação*), mude para **Offline**.
  3. No menu lateral do site, clique em:
     * 📅 **Cultos**
     * 🎵 **Repertório**
     * 🗓️ **Agenda**
     * 📦 **Almoxarifado**
     * 📊 **Analytics**
     * ⚡ **Holyrics**
* **✅ Comportamento Esperado:**
  Todas as telas devem carregar a interface e os dados locais do IndexedDB sem apresentar tela branca ou travar a aplicação.
* **❌ Sinal de Falha:** Se alguma tela exibir tela em branco ou erro de arquivo não encontrado (`404` / `Failed to fetch`).
  *(Ao terminar o teste, lembre-se de desmarcar o modo Offline no DevTools).*

---

# 🟡 FASE 2: TESTES DO MOTOR SAAS, PLANOS & MERCADO PAGO

Estes testes serão executados assim que implementarmos o motor de planos e a integração do checkout transparente.

---

### Teste 2.1: Barreira de Limite de Voluntários (Paywall de Membros)
* **Objetivo:** Verificar se uma igreja no plano Essencial (limite de 20 membros) é impedida de cadastrar o 21º membro sem upgrade.
* **Ação:** No painel de Equipe da igreja, cadastrar voluntários até atingir o limite estipulado. Tentar cadastrar mais um.
* **✅ Sucesso:** O sistema bloqueia a gravação no banco e exibe o modal educativo: *"Você atingiu o limite de voluntários do seu plano atual. Faça upgrade para o Plano Pro para cadastrar membros ilimitados."*
* **❌ Falha:** Se o voluntário for cadastrado no banco mesmo com a cota estourada.

---

### Teste 2.2: Barreira de Limite de Ministérios
* **Objetivo:** Garantir que congregações no plano básico só possam ter 1 ministério (Louvor).
* **Ação:** Entrar no painel de Ministérios e tentar criar o ministério "Mídia" ou "Infantil".
* **✅ Sucesso:** O botão "+ Novo Ministério" exibe um badge *"Disponível no Plano Pro"* e abre a tabela comparativa de planos ao ser clicado.
* **❌ Falha:** Se o ministério for gravado livremente na tabela `ministries`.

---

### Teste 2.3: Checkout com PIX Mercado Pago (Sandbox)
* **Objetivo:** Validar a geração instantânea do QR Code do PIX.
* **Ação:** Clicar no botão de assinar o plano Pro via PIX em ambiente de testes.
* **✅ Sucesso:** A interface renderiza o QR Code do PIX e o campo "Copia e Cola" com o código alfanumérico gerado pela API do Mercado Pago.
* **❌ Falha:** Se o modal travar carregando ou a API retornar erro de credenciais.

---

### Teste 2.4: Webhook de Ativação Automática de Pagamento
* **Objetivo:** Confirmar que, assim que o Mercado Pago notifica o pagamento, a congregação é ativada sem intervenção manual.
* **Ação:** Simular o evento de pagamento aprovado no simulador de webhooks do Mercado Pago.
* **✅ Sucesso:** No painel Supabase, o registro da igreja na tabela `churches` tem seu status alterado para `'active'` e a coluna `subscription_renews_at` é estendida em 30 dias.
* **❌ Falha:** Se a igreja continuar com status `'pending'` ou `'expired'`.

---

# 🟢 FASE 3: TESTES DO APLICATIVO MOBILE (CAPACITOR / ANDROID)

Estes testes serão executados no seu computador e no seu **Samsung Galaxy S24**.

---

### Teste 3.1: Compilação e Execução no Galaxy S24 via USB
* **Objetivo:** Validar o empacotamento nativo do Capacitor no Android 14.
* **Ação:** Conectar o Galaxy S24 no Galaxy Book4 Edge com a Depuração USB ativada e rodar `npx cap run android`.
* **✅ Sucesso:** O app "Liturge" é instalado no smartphone com o ícone oficial de 512x512, abre a Splash Screen escura estilizada e exibe a tela de login/cultos fluida a 120Hz.
* **❌ Falha:** Se a tela ficar preta (erro de caminho de assets) ou fechar inesperadamente (*Crash on launch*).

---

### Teste 3.2: Teste do Plugin `KeepAwake` no Palco
* **Objetivo:** O celular do músico não pode apagar enquanto ele toca.
* **Ação:** Abrir o app no Galaxy S24, entrar em qualquer música no modo Cifra e deixar o aparelho parado na mesa por 3 minutos (o tempo padrão de bloqueio de tela do Android costuma ser 30s ou 1min).
* **✅ Sucesso:** A tela permanece permanentemente acesa com a cifra visível enquanto a tela de cifras estiver aberta.
* **❌ Falha:** Se a tela escurecer ou bloquear automaticamente.

---

### Teste 3.3: Responsividade e Área de Toque na Resolução do Galaxy S24 (1080 x 2340)
* **Objetivo:** Garantir usabilidade perfeita com os dedos.
* **Ação:** Testar os botões de transposição de tom (`+1 Tom`, `-1 Tom`) e os accordions de cultos.
* **✅ Sucesso:** Todos os botões têm área de clique confortável (mínimo de 44x44 pixels) e não há rolagem horizontal acidental na tela.
* **❌ Falha:** Se o texto da cifra vazar para fora da borda direita da tela sem quebra adequada.

---

# 🔵 FASE 4: TESTES DE PERFORMANCE, TRANSAÇÕES ATÔMICAS & RPC

---

### Teste 4.1: Teste de Resiliência no Salvamento de Cultos (Queda de Rede Simulada)
* **Objetivo:** Provar que a nova Procedure PostgreSQL eliminou a perda de músicas caso o sinal caia durante o salvamento do culto.
* **Ação:**
  1. Abrir a tela de edição de culto.
  2. Adicionar 5 músicas e 3 instrumentistas.
  3. Clicar em "Salvar Culto" e, imediatamente, desconectar a internet (ou fechar o navegador).
* **✅ Sucesso (Atomicidade Transacional):**
  Ao religar a internet e abrir o banco, o culto **ou foi salvo integralmente com todas as músicas e escalas**, **ou foi revertido por completo (*Rollback*)**, sem jamais ficar como um culto vazio com escalas perdidas.
* **❌ Falha:** Se o culto tiver sido salvo com as músicas deletadas e sem os novos dados gravados.

---

### Teste 4.2: Benchmark de Carregamento sem Tailwind CDN
* **Objetivo:** Comprovar o ganho de velocidade no Galaxy Book4 Edge e no Galaxy S24.
* **Ação:** Executar a auditoria do **Lighthouse** no DevTools do Chrome.
* **✅ Sucesso:**
  * Performance score superior a **90**.
  * Tempo de bloqueio da thread principal (*Total Blocking Time - TBT*) inferior a **150ms**.
  * Eliminação total dos alertas de *"Avoid non-compiled runtime CSS libraries in production"*.
* **❌ Falha:** Se o Lighthouse continuar alertando sobre o script Play CDN de 3MB.

---

## 📋 Tabela de Controle de Execução dos Testes

Copie esta tabela para marcar seu progresso à medida que testar:

| Fase | ID do Teste | Descrição Resumida | Status |
| :---: | :---: | :--- | :---: |
| **Fase 1** | **T1.1** | Bloqueio de `delete_church_cascade` para anônimos | [ ] Concluído |
| **Fase 1** | **T1.2** | Bloqueio de deleção de perfis no RLS | [ ] Concluído |
| **Fase 1** | **T1.3** | Login admin multi-tenant sem e-mail fixo | [ ] Concluído |
| **Fase 1** | **T1.4** | Service Worker `liturge-v2` ativo no DevTools | [ ] Concluído |
| **Fase 1** | **T1.5** | Navegação 100% offline em todas as abas | [ ] Concluído |
| **Fase 2** | **T2.1** | Cota de voluntários bloqueia excesso | [ ] Aguardando Fase 2 |
| **Fase 2** | **T2.2** | Cota de ministérios restringe plano básico | [ ] Aguardando Fase 2 |
| **Fase 2** | **T2.3** | Geração de PIX Sandbox no Mercado Pago | [ ] Aguardando Fase 2 |
| **Fase 2** | **T2.4** | Ativação automática de assinatura via Webhook | [ ] Aguardando Fase 2 |
| **Fase 3** | **T3.1** | App Android rodando no Galaxy S24 | [ ] Aguardando Fase 3 |
| **Fase 3** | **T3.2** | KeepAwake impede tela de apagar no palco | [ ] Aguardando Fase 3 |
| **Fase 3** | **T3.3** | Layout 100% responsivo em 1080x2340 | [ ] Aguardando Fase 3 |
| **Fase 4** | **T4.1** | Transação atômica evita cultos corrompidos | [ ] Aguardando Fase 4 |
| **Fase 4** | **T4.2** | Lighthouse Performance > 90 sem Play CDN | [ ] Aguardando Fase 4 |
