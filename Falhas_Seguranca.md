# Relatório de Segurança e Blindagem do Projeto (Multi-Tenant)

Este documento centraliza a análise profunda de segurança do sistema, mapeando a separação de dados entre igrejas (Multi-tenant), o que já foi corrigido no banco de dados e o **guia passo a passo do que precisa ser alterado no código-fonte do site (Frontend)** para atingir a segurança máxima.

---

## 1. Mapeamento de Isolamento por Igreja (`church_id`)

Para garantir que uma igreja nunca veja os dados da outra, o sistema depende da amarração correta do `church_id`.

**✅ Entidades Isoladas por Igreja:**
* **Usuários/Perfis** (`profiles`)
* **Cultos e Agendas** (`services`)
* **Repertório de Músicas** (`songs`)
* **Ministérios** (`ministries`)
* **Escalas** (`service_scales`)
* **Almoxarifado e Equipamentos** (`ministry_assets`)
* **Documentos e Manuais** (`ministry_docs`)
* **Músicas do Culto** (`service_songs`)
* **Comentários e Solicitações** (`availability_comments`)
* **Cargos do Ministério** (`ministry_roles` e `user_ministry_roles`)
* **Versões de Músicas** (`song_versions`)

**🌐 Entidades Globais / Compartilhadas:**
* **Igrejas** (`churches`): Apenas a própria igreja e os `super_admins` têm acesso aos dados sensíveis.
* **Super Admins** (`super_admins`): Tabela global de sistema blindada para gerenciamento.

*(Nota: Todos os itens acima já foram devidamente blindados no banco de dados através dos scripts SQL de Row Level Security executados no Supabase).*

---

## 2. Passo a Passo: O que mudar no CÓDIGO DO SITE (Frontend)

Apesar do banco de dados estar 100% blindado, o código em JavaScript (PWA) possui algumas falhas estruturais que abrem margem para ataques no navegador dos usuários e spam. Siga os passos abaixo para corrigir os arquivos `.js`.

### PASSO 1: Corrigir a Falha Crítica de XSS (Cross-Site Scripting)
**Onde ocorre:** Arquivos como `app.js`, `admin.js`, `agenda.js`, e `almoxarifado.js`.
**O problema:** O site usa exaustivamente a propriedade `.innerHTML` para injetar textos vindos do banco de dados (ex: `container.innerHTML = "<p>" + song.title + "</p>"`). Se um usuário salvar um culto com o nome `<img src=x onerror=alert('Hack')>`, esse código será executado no celular de todos que abrirem o site.

**O que fazer (Solução A - Recomendada e mais rápida):**
Adicionar a biblioteca **DOMPurify** ao seu projeto para "limpar" qualquer texto malicioso antes de jogar no HTML.
1. No seu `index.html`, adicione o script do DOMPurify dentro da tag `<head>`:
   ```html
   <script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.6/purify.min.js"></script>
   ```
2. Nos arquivos `.js` (como `admin.js`), sempre que for usar `innerHTML` com dados dinâmicos, passe pelo DOMPurify:
   * **Incorreto (Atual):** `containerLista.innerHTML = song.title;`
   * **Correto (Seguro):** `containerLista.innerHTML = DOMPurify.sanitize(song.title);`

**O que fazer (Solução B - Mais trabalhosa):**
Trocar todos os `innerHTML` que recebem nomes de usuário, nomes de músicas e títulos por `.textContent`.
* **Correto:** `let p = document.createElement('p'); p.textContent = song.title; container.appendChild(p);`

---

### PASSO 2: Impedir Spam na Criação de Igrejas (DDoS)
**Onde ocorre:** Função de criar igreja no `app.js` e Tabela `churches` no banco.
**O problema:** O Supabase permite inserções anônimas para facilitar o cadastro. Porém, um script malicioso pode inundar seu banco criando 10.000 igrejas falsas por minuto, estourando o limite do seu plano gratuito.

**O que fazer no Frontend:**
1. Crie uma conta no **Cloudflare Turnstile** (alternativa gratuita e invisível ao Google reCAPTCHA).
2. Adicione o widget do Turnstile no formulário de cadastro de nova igreja no `index.html`.
3. No `app.js`, só permita chamar o `supabaseClient.from('churches').insert(...)` se o usuário tiver passado no desafio do Turnstile.

*(Nota: Para máxima segurança, o Turnstile deve ser validado via Supabase Edge Functions, mas só de colocá-lo no frontend já derruba 99% dos bots burros).*

---

### PASSO 3: Enviar o `church_id` Faltante nas Requisições
**Onde ocorre:** Arquivos `app.js` e `admin.js` na hora de realizar Cadastros (`insert`).
**O problema:** Em algumas funções, como ao sincronizar Comentários de Disponibilidade offline (`availability_comments`), o código esquece de anexar o `church_id`. Resolvemos isso com um "quebra-galho" no banco de dados (`DEFAULT get_user_church_id()`), mas o ideal é que o código envie explicitamente.

**O que fazer:**
Sempre garantir que o payload de `insert` ou `update` tenha a propriedade da igreja.
Exemplo no `app.js` (linha ~167):
```javascript
// ATUAL:
.insert({
    category: item.category || 'Ajuste de Tom',
    comment_text: item.comment_text
});

// COMO DEVE FICAR:
.insert({
    church_id: window.dadosGlobais?.church?.id || usuarioLogado.church_id,
    category: item.category || 'Ajuste de Tom',
    comment_text: item.comment_text
});
```

---

### PASSO 4: Tratar o Erro de Retorno do Cadastro (Bug esperado)
**Onde ocorre:** Função de cadastro de igreja no `app.js` (linha ~1723).
**O problema:** Como trancamos a leitura da tabela `churches` para apenas a própria igreja, quando o `app.js` cria uma igreja (estando deslogado) e chama o `.select('id')` logo em seguida, o banco pode bloquear o retorno e devolver nulo, gerando um erro de código no site.
Colocamos uma exceção para status `pending`, mas é bom proteger o código Javascript.

**O que fazer:**
No `app.js`:
```javascript
const { data: newChurch, error: churchErr } = await supabaseClient
    .from('churches')
    .insert({ /* ... */ })
    .select('id')
    .single();

if (churchErr) throw churchErr;
if (!newChurch) throw new Error("Igreja criada, mas não foi possível ler o ID por segurança.");

const churchId = newChurch.id;
```

---
Seguindo estes 4 passos, os códigos Javascript do seu site ficarão tão blindados quanto o seu banco de dados Supabase!
