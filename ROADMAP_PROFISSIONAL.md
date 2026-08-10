# Roadmap de Profissionalização e Segurança — LouvorIDB

## Objetivo Atual
Antes de adicionar novas funcionalidades ou migrar o banco de dados para comercialização, o projeto precisa atingir um estado "Profissional". Isso significa mitigar as falhas de segurança documentadas, desacoplar o JavaScript monolítico e otimizar a comunicação com a API.

## Diretriz de Execução (Regra de Ouro)
O Agente deve executar **uma etapa de cada vez**, aguardando aprovação explícita e testes manuais antes de avançar para a próxima. Não altere a estrutura do Google Sheets.

---

### ETAPA 1: Modularização do JavaScript (Fim da Fase 1)
**Problema:** O arquivo `index.html` ainda concentra mais de 800 linhas de JavaScript, dificultando a manutenção.
**Plano de Ação Atômico:**
1. Criar a pasta `/js`.
2. Extrair as variáveis de estado global (`WEB_APP_URL`, `dadosGlobais`, etc.) para um arquivo `js/state.js`[cite: 3].
3. Extrair as funções de comunicação com o backend (`carregarDados`, `salvarCulto`, etc.) para `js/api.js`[cite: 3].
4. Extrair as funções de renderização e controle de UI (como `renderizarCultos` e `mostrarFormCulto`) para `js/ui.js`[cite: 3].
5. Atualizar o `index.html` para importar esses scripts como módulos (`<script type="module">`).

### ETAPA 2: Correção da Vulnerabilidade de Autenticação
**Problema:** A validação do Admin é baseada na verificação de uma constante de texto simples (`SENHA_ADMIN = "idblouvor"`) no código do lado do cliente, permitindo que qualquer pessoa inspecione o código-fonte e veja a senha[cite: 3].
**Plano de Ação Atômico:**
1. Alterar o backend (`apps-script/Código.js`): Criar uma nova ação no `doPost` chamada `validarSenha`[cite: 3]. A senha real deve ficar armazenada como propriedade do script no Google ou variável segura no backend.
2. Alterar o frontend (`index.html` / `js/ui.js`): A função `entrarAdmin()`[cite: 3] não deve mais checar a senha localmente. Ela deve fazer um `fetch` para o backend enviando a senha digitada.
3. O backend responde com sucesso (retornando um token simples ou flag `true`) ou erro.
4. O frontend só libera o painel admin se a resposta do servidor for positiva.

### ETAPA 3: Otimização da Comunicação API (Fim do modo "Cego")
**Problema:** As chamadas `POST` do frontend para o Apps Script usam `mode: 'no-cors'`, o que faz o navegador receber uma resposta opaca. Se houver erro no Apps Script, a interface não sabe[cite: 3].
**Plano de Ação Atômico:**
1. Refatorar a função `doPost(e)` no `Código.js` para retornar os cabeçalhos corretos (`Access-Control-Allow-Origin`, etc.) e uma saída JSON estruturada[cite: 3].
2. Refatorar os métodos de salvamento (`salvarCulto`, `toggleOculto`, `moverMusicasNovas`) no frontend[cite: 3] para remover o `no-cors` e processar a resposta JSON do backend.
3. Adicionar feedback visual (ex: um ícone de carregando, ou notificação de "Salvo com sucesso") baseando-se na resposta real do servidor.

### ETAPA 4: Preparação para Novas Funções
*Somente após a conclusão das Etapas 1, 2 e 3.*
- Implementação de sistema de cache local para evitar chamadas excessivas ao `doGet(e)`[cite: 3].
- Preparação da interface para Multi-Tenancy via planilhas separadas (alterando dinamicamente a `WEB_APP_URL` com base no cliente).