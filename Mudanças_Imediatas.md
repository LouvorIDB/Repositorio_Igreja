# Análise Profunda e Roadmap do Sistema (Padrão Ouro)

Este documento foi completamente reescrito para estabelecer a visão definitiva do produto. Ele está dividido em três seções: a definição do sistema ideal, a análise fria do nosso projeto atual frente a esse ideal, e o plano de ação técnico para atingirmos essa excelência.

---

## SEÇÃO 1: O Padrão Ouro (O Sistema Ideal)

Um sistema definitivo para igrejas não gerencia apenas "cifras", ele gerencia o ecossistema completo do voluntariado e da execução técnica. O "Padrão Ouro" deve possuir:

### 1. Ecossistema Multi-Ministério (Flexibilidade Total)
O sistema não deve presumir que existe apenas "Banda". Ele deve permitir que a igreja crie módulos (Louvor, Som, Mídia, Recepção, Infantil) onde a variável de escalação pode ser tanto um "Instrumento" quanto um "Cargo/Função". O líder monta o esqueleto do culto para a sua necessidade específica.

### 2. Escala Inteligente e Proteção do Voluntário (Saúde da Equipe)
O trabalho do líder não é "lembrar quem tocou semana passada", é focar nas pessoas. O sistema deve fazer o trabalho pesado:
*   **Limites Individuais:** Voluntários (ou líderes) podem definir um "Teto de escalas" (ex: "Só posso servir 2 domingos por mês").
*   **Alerta de Conflitos Cruzados:** Aviso vermelho se o líder do Som escalar alguém que já foi escalado na Bateria no mesmo dia.
*   **Sugestão Pró-Ativa (Auto-escalação):** O sistema deve sugerir nomes. Ex: *"A banda precisa de Baterista. O João não é escalado há 3 semanas, deseja escalá-lo?"*

### 3. Gestão Avançada de Repertório e Integrações Oficiais
Não basta apenas armazenar a letra. O sistema deve ser a fonte de verdade para a equipe técnica.
*   **Metadados Ricos:** Tons transponíveis, BPM, temáticas da música e links de estudo.
*   **Exportação/Sincronização:** Capacidade nativa de gerar o arquivo do culto e exportar direto para o **Holyrics** ou **ProPresenter**. O sistema deve fornecer tutoriais amigáveis em vídeo/texto, embutidos na interface, para que o operador de mídia saiba exatamente como importar a lista.

### 4. "Almoxarifado Virtual" e Base de Conhecimento (Wiki)
Gestão do patrimônio e da informação técnica, separada por cada Ministério.
*   **Equipamentos:** Controle de status (Ex: "Cabo XLR 3 - Quebrado", "Microfone Sem Fio 1 - Na manutenção").
*   **Wiki/Base de Conhecimento:** Local onde voluntários autorizados podem ler manuais de como ligar a mesa de som, como reiniciar o roteador da transmissão, senhas do computador da projeção, etc.

### 5. Analytics e Relatórios Profundos (Inteligência de Dados)
Sair do "achismo" e ir para os dados. O painel deve fornecer:
*   **Métricas de Pessoas:** Quantos cultos X voluntário fez no mês/ano.
*   **Métricas de Repertório:** Músicas mais tocadas, músicas que são frequentemente tocadas juntas (Medleys e pareamentos comuns).
*   **Filtros Cruzados:** Descobrir, por exemplo, "Quais músicas o Cantor X mais foi escalado para ministrar neste ano?".

---

## SEÇÃO 2: Análise Profunda (O Nosso Projeto vs O Padrão Ouro)

O nosso projeto atual foi construído em apenas uma semana e meia. Ele resolve perfeitamente o "Problema 1" (Ter as cifras organizadas para a banda). No entanto, comparando com o **Padrão Ouro**, este é o raio-X do nosso sistema hoje:

### 🔴 Onde estamos distantes:
1.  **Multi-Ministério:** Apesar do nosso banco de dados (Supabase) já ter tabelas de `ministries` e `profiles`, o **nosso site (frontend) é 90% engessado no Louvor**. As nomenclaturas, o botão de "Adicionar Música" no meio da escala, e a tela de cultos foram feitas pensando unicamente em uma Banda. Se o líder da Mídia for montar a escala, a tela não fará sentido para ele hoje.
2.  **Almoxarifado Virtual e Wiki:** Inexistente. Atualmente nosso banco de dados e interface só conhecem "Cultos", "Pessoas" e "Músicas".
3.  **Analytics:** Inexistente. Nós apenas listamos as músicas. Não temos nenhum painel de gráficos cruzando a frequência em que a música foi tocada ou o índice de escalas dos cantores.
4.  **Escala Inteligente:** Nossa escala atual é 100% manual ("arrastar/selecionar pessoa para o cargo"). O sistema não analisa fadiga do voluntário, não impede que ele seja escalado 10 vezes no mês e não detecta cruzamento de escalas se ele for da Mídia e do Louvor.

### 🟡 Onde estamos no caminho certo (Potencial Alto):
1.  **Repertório e Integrações:** O nosso visualizador de Cifras é excelente e o sistema de importação está estruturado. A infraestrutura para a exportação do Holyrics pode ser acoplada facilmente já que o banco está em PostgreSQL. Apenas precisamos finalizar o módulo de exportação e embutir os tutoriais na tela.
2.  **Ecossistema SaaS Multi-Igreja:** Toda a base de segurança (Row Level Security - RLS) para que os dados de uma igreja não vazem para a outra está bem fundamentada na nuvem.

---

## SEÇÃO 3: O Plano de Ação (A Ordem de Implementação)

Para transformar o nosso projeto nesse "Padrão Ouro" com o mínimo de retrabalho e focado em comercialização, devemos seguir exatamente esta ordem matemática de implementação:

### Passo 1: A Fundação e Limpeza (A Dívida Técnica)
*Antes de criar IA ou gráficos, o código precisa aguentar.*
*   **Ação 1 (Frontend):** Refatorar as variáveis globais (`dadosGlobais`) para um Padrão de Store (`js/store.js`). Se não fizermos isso agora, as novas funções de Analytics e Multi-ministério vão colapsar o navegador do usuário.
*   **Ação 2 Crítica (Banco de Dados):** Refatorar a lógica de salvamento de cultos (`js/admin.js`). Atualmente as escalas e anexos de mídia estão sendo salvos provisoriamente como textos embutidos (JSON) nas colunas `notes` e `media_urls`. Precisamos alterar o código JS para gravar as pessoas e arquivos nas tabelas relacionais independentes (`service_scales` e `service_media`). Só assim o sistema conseguirá gerar os relatórios avançados (Analytics) cruzando dados de quem tocou e quando.

### Passo 2: Flexibilização da UI para Multi-Ministérios
*Transformar o site em um sistema plural.*
*   **Ação:** Modificar a interface de "Edição de Culto". Ela deve ler dinamicamente o Ministério de quem está logado. Se for o líder do Som, a UI oculta a aba "Músicas/Repertório" e mostra apenas "Cargos" (Mesa, Retorno, Gravação).

### Passo 3: O "Almoxarifado Virtual" e a Wiki
*Agregando um valor absurdo para as igrejas logo de cara.*
*   **Ação:** Criar as tabelas `ministry_assets` e `ministry_docs` no Supabase. Adicionar uma nova View no painel lateral chamada "Recursos & Wiki" para o cadastro de cabos, equipamentos e tutoriais.

### Passo 4: O Motor de Escala Inteligente (Regras de Negócio)
*Dar o poder do "Aviso" ao líder.*
*   **Ação:** Criar a tabela de configuração individual (ex: `user_limits`), onde a pessoa define "Max: 2 cultos/mês". 
*   **Ação:** Alterar o JavaScript de montagem de cultos para disparar alertas vermelhos na tela: *"Alerta: João já atingiu o limite mensal"* ou *"Alerta: Maria já está no Louvor neste domingo"*.

### Passo 5: Módulo de Exportação Holyrics e Tutoriais
*A integração com a Projeção.*
*   **Ação:** Finalizar o script para gerar os arquivos compatíveis com o Holyrics. Inserir modais com vídeos ou GIFs explicando o passo a passo da importação no computador da igreja.

### Passo 6: Dashboard de Analytics
*A cereja do bolo para os administradores.*
*   **Ação:** Usar uma biblioteca de gráficos (como Chart.js) para criar uma nova aba no Painel Admin com relatórios de "Ranking de Músicas do Ano", "Voluntários que mais serviram" e "Músicas ligadas aos Cantores".
