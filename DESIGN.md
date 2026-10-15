# 📐 Guia de Design System & Identidade Visual — LITURGE

> **Plataforma Liturge:** Gestão de Cultos, Escalas de Ministérios, Repertório com Cifras Dinâmicas e Mídias de Projeção.  
> **Status:** Ativo / Produção

---

## 1. Brand DNA & Posicionamento

* **Missão:** Capacitar a igreja local com excelência técnica, espiritual e operacional na organização do culto, eliminando o estresse de escalas e proporcionando uma experiência litúrgica fluida e reverente.
* **A Metáfora Central do Produto:**
  * Assim como o culto é uma comunhão orgânica de várias frentes (Música, Som, Projeção, Recepção, Infantil, Iluminação, Transmissão e Pastoral), o **Liturge** atua como o **Hub Central Integrador**, onde todos esses nós conversam em tempo real.
* **Público-Alvo:** 
  * Pastores e Diretores de Culto;
  * Líderes de Ministérios e Coordenadores de Escalas;
  * Músicos, Ministros de Louvor e Instrumentistas;
  * Voluntários Técnicos (áudio, mesa de som, Holyrics/slides, transmissão ao vivo e iluminação cênica).
* **Tom de Voz:** Reverente, contemporâneo, acolhedor, focado em ordem, clareza e precisão técnica.

---

## 2. A Brandmark Oficial: Nexus Estelar & A Constelação dos 8 Ministérios

### A. Racional Simbólico e Geometria
A marca da Liturge é construída sobre a linguagem astronômica de **linhas e nós de uma constelação viva**, livre de molduras ou figuras geométricas fechadas:

* **O Ponto Central (O Altar / Culto / Cristo):** Uma grande estrela radiante de 4 pontas curvadas (*Stella Polaris / Sparkle*), atuando como o núcleo hiper-luminoso e ponto de gravidade onde todas as atividades e ministérios da igreja encontram seu propósito comum.
* **Os 8 Nós Estelares Espalhados:** Representam os 8 ministérios ativos no ecossistema de um culto moderno:
  1. **Louvor & Músicos** (Magnitude 1, Distância: 92px);
  2. **Pastoral & Altar** (Magnitude 1, Distância: 78px);
  3. **Intercessão & Ministério do Altar** (Magnitude 2, Distância: 38px — íntimo);
  4. **Transmissão & Mídia Externa** (Magnitude 3, Distância: 96px — alcance externo);
  5. **Projeção & Telão** (Magnitude 2, Distância: 62px);
  6. **Iluminação Cênica** (Magnitude 4, Distância: 88px);
  7. **Ministério Infantil & Próxima Geração** (Magnitude 4, Distância: 52px);
  8. **Técnica & Áudio** (Magnitude 2, Distância: 36px — íntimo).
* **Distâncias Cósmicas Variadas:** As distâncias variam marcadamente de 36px até 96px, conferindo profundidade tridimensional e quebrando qualquer sensação artificial de anel ou polígono rígido.
* **Feixes de Convergência:** Linhas de luz solar em gradiente dourado (`#FFF9C4` ➔ `#F59E0B` ➔ `#B45309`) que conectam cada voluntário e departamento ao coração da adoração.

---

## 3. Paleta Cromática & Design Tokens

### A. Cores Principais
```css
:root {
  /* Marca Liturge - Ouro Solar & Âmbar Quente */
  --color-liturge-50:  #FFFBEB;
  --color-liturge-100: #FEF3C7;
  --color-liturge-200: #FDE68A;
  --color-liturge-300: #FCD34D;
  --color-liturge-400: #FBBF24;
  --color-liturge-500: #F59E0B; /* Primária Oficial Liturge */
  --color-liturge-600: #D97706; /* Hover / Ênfase */
  --color-liturge-700: #B45309;
  --color-liturge-800: #92400E;
  --color-liturge-900: #78350F;
  --color-liturge-950: #451A03;

  /* Superfícies Modo Palco Escuro (Dark Stage) */
  --surface-night-950: #070B14; /* Fundo base da aplicação */
  --surface-night-900: #0B111E; /* Painéis e Modais */
  --surface-night-850: #0D1526; /* Cards e Contêineres */
  --surface-night-800: #111827; /* Headers e Barras Fixas */
  --surface-border:    #1E293B; /* Linhas de divisão sutis */

  /* Textos de Alto Contraste */
  --text-primary:   #F8FAFC; /* Branco gelo (evita ofuscamento no palco) */
  --text-secondary: #CBD5E1; /* Leitura confortável */
  --text-muted:     #94A3B8; /* Metadados e legendas */
  --text-dim:       #64748B; /* Desabilitados e placeholders */

  /* Semânticas de Estado */
  --state-success: #10B981;
  --state-warning: #F59E0B;
  --state-danger:  #EF4444;
  --state-info:    #38BDF8;
}
```

---

## 4. Tipografia do Sistema

| Papel | Família Tipográfica | Pesos | Uso |
| :--- | :--- | :--- | :--- |
| **Display & Títulos** | `Plus Jakarta Sans` | 700 (Bold), 800 (ExtraBold) | Logotipo, cabeçalhos de culto, nomes de bandas e ministérios. |
| **Interface & Leitura** | `Plus Jakarta Sans` | 400 (Regular), 500 (Medium), 600 (SemiBold) | Textos de cards, botões de ação, listas de voluntários e modais. |
| **Música & Cifras** | `JetBrains Mono` | 500 (Medium), 600 (SemiBold) | Cifras dinâmicas, tons musicais (ex: `G#m7`), compassos (BPM) e metadados técnicos. |

---

## 5. Acessibilidade & Contraste WCAG (2.1 AA / AAA)

* **Palco Escuro (Dark Stage):**
  * O texto primário `#F8FAFC` sobre fundo `#070B14` atinge contraste de **17.8:1** (superando com folga a exigência AAA de 7:1).
  * O botão de ação primário âmbar `#F59E0B` com texto escuro `#070B14` atinge **9.4:1** (AAA).
* **Prevenção de Fadiga Visual no Púlpito:**
  * Uso de `#070B14` (azul-noite ultra-profundo) em vez de `#000000` absoluto para evitar o efeito de "burn-in" na visão sob iluminação cênica.

---

## 6. Arquitetura de Arquivos da Marca

```
public/
  assets/
    ├── liturge-symbol.svg       # Brandmark vetorial oficial (Constelação 8 nós + hub central)
    ├── liturge-logo-full.svg    # Lockup horizontal completo (Símbolo + Wordmark + Tagline)
    └── liturge-logo-white.svg   # Versão monocromática branca de alto contraste
  favicon.svg                    # Ícone de app e favicon squircle 64x64 de alta legibilidade
brand-kit.json                   # Especificação estruturada do Brand Kit (para integrações e IA)
DESIGN.md                        # Guia mestre de tokens, tipografia e regras de design
```
