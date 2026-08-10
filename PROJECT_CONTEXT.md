````markdown
# CONTEXT PROMPT — LouvorIDB Project

## 0. ROLE AND OPERATING RULES

You are working on an existing software project called **LouvorIDB / Repositorio_Igreja**.

Your role at this stage is to act as a **technical project assistant and implementation agent**, but you must respect the existing architecture and decisions documented below.

### Critical rule

**Do not autonomously change the project's architecture, data model, business rules, or user-facing behavior.**

Before implementing a change:

1. Inspect the existing project files.
2. Identify how the current implementation works.
3. Preserve existing functionality.
4. Make the smallest necessary change.
5. Do not rewrite large files unnecessarily.
6. Do not introduce new frameworks or dependencies without explicit approval.
7. Do not assume that a missing feature is a bug.
8. If requirements are ambiguous, stop and ask for clarification.

The project is already functional in its current backend state. The next task is primarily to inspect and validate the frontend against the backend.

---

# 1. PROJECT IDENTITY

**Project name:**

`LouvorIDB / Repositorio_Igreja`

## Purpose

The system is designed to centralize the repertoire and scheduling of a church worship ministry.

The initial goal is to provide a web-based interface connected to Google Sheets, allowing the ministry to:

- organize worship services;
- manage songs;
- organize musicians;
- organize singers;
- assign singers to individual songs;
- maintain service schedules;
- archive past repertoires;
- manage new songs;
- receive requests/suggestions;
- hide/show services;
- eventually support mobile applications.

The project may eventually be expanded to:

- Android;
- iOS;
- potentially other churches as a reusable product.

These future possibilities are **not current implementation requirements** unless explicitly requested.

---

# 2. CURRENT ARCHITECTURE

The current architecture is:

```text
Frontend
   |
   | HTTP / JSON
   v
Google Apps Script Web App
   |
   v
Google Sheets
````

## Frontend

The frontend is hosted through:

**GitHub Pages**

The project is being developed using:

**Antigravity IDE**

The frontend source files are part of the local project repository.

The exact current frontend file structure still needs to be inspected.

---

## Backend

The backend is:

**Google Apps Script**

The primary backend file is:

```text
codigo.js
```

The Apps Script project is connected to the Google Sheets database.

Deployment/synchronization is managed through:

```bash
clasp
```

The local development workflow is therefore:

```text
Edit codigo.js
      ↓
Test locally / inspect code
      ↓
clasp push
      ↓
Google Apps Script
      ↓
Web App
```

Do not modify the Apps Script directly through the Google Apps Script editor when the project is being managed through the local Antigravity repository, unless explicitly required.

---

# 3. GOOGLE SHEETS DATA MODEL

The spreadsheet currently contains the following relevant sheets:

```text
Playlists
Banco_Musicas
Musicas_Novas
Cantores
Historico
Solicitacoes
```

## Playlists

The `Playlists` sheet contains worship service blocks.

Each service is represented as a block.

The current structure uses **7 columns (A:G)**.

### Service header

The service header uses:

```text
A:E = merged cell containing the service title
F   = JSON containing musicians/instruments
G   = singers assigned to the service
```

Example of column F:

```json
{
  "violao": "Bispo Bruno",
  "bateria": "João Marcos",
  "teclado": ""
}
```

Column G contains the singers assigned to the service, stored as a comma-separated string.

### Song rows

Each song row uses:

| Column | Meaning                       |
| ------ | ----------------------------- |
| A      | Song name                     |
| B      | Key                           |
| C      | Variation/transposition       |
| D      | VS link                       |
| E      | YouTube link                  |
| F      | Empty/reserved on song rows   |
| G      | Singers assigned to that song |

### Important

The system currently **does not support changing a song's key during service editing**.

This is intentional and must not be treated as a missing feature unless explicitly requested.

---

# 4. SERVICE TYPES AND SONG COUNTS

The current backend recognizes:

```text
DOMINGO
QUARTA
SABADO
```

The current `processarEscolha()` behavior is:

```text
DOMINGO → 6 songs
QUARTA  → 4 songs
SABADO  → 5 songs
```

The colors currently used by the backend are:

### Sunday

```text
header: #34a853
light:  #e6f4ea
dark:   #ceead6
```

### Wednesday

```text
header: #4285f4
light:  #e8f0fe
dark:   #d2e3fc
```

### Saturday

```text
header: #ea4335
light:  #fce8e6
dark:   #fad2cf
```

Do not change these rules without explicit authorization.

---

# 5. CURRENT BACKEND FUNCTIONALITY

The current `codigo.js` contains the following major functionality.

## 5.1 Spreadsheet menu

`onOpen()` creates the menu:

```text
⛪ Ministério
├── Gerar Novo Culto
├── Arquivar Seleção no Histórico
├── Limpar Aba de Playlists
└── Sincronizar Drive
```

The menu currently references:

```text
gerarBlocoCulto
salvarNoHistorico
limparPlanilhaPrincipal
sincronizarArquivosDrive
```

The existing project must be inspected to determine whether `sincronizarArquivosDrive` exists elsewhere before modifying anything.

---

# 6. NEW SERVICE GENERATION

The function:

```javascript
processarEscolha(tipo)
```

creates a new service block.

It:

1. Determines the number of songs based on service type.
2. Determines the appropriate colors.
3. Calculates the next service date.
4. Creates the service header.
5. Uses columns A:G.
6. Applies formatting.
7. Applies dropdown validation for keys.
8. Applies dropdown validation for song variation.
9. Creates the blank footer row.

The current key list is:

```text
C
C#
D
D#
E
F
F#
G
G#
A
A#
B
Cm
C#m
Dm
D#m
Em
Fm
F#m
Gm
G#m
Am
A#m
Bm
```

The current variation list is:

```text
Original
Sobe 1/2 tom
Sobe 1 tom
Abaixa 1/2 tom
Abaixa 1 tom
```

---

# 7. DATE HANDLING

The backend calculates upcoming service dates.

Relevant functions:

```javascript
buscarProximaData()
calcularPrimeiraData()
formatarData()
```

The date format currently used is:

```text
dd/MM
```

with timezone:

```text
GMT-3
```

---

# 8. HISTORY

The function:

```javascript
salvarNoHistorico()
```

copies the selected range into the `Historico` sheet.

It also requests a month/year reference such as:

```text
Jan/26
```

The reference is stored in column H.

The copied data occupies columns A:G.

---

# 9. CLEARING PLAYLISTS

The function:

```javascript
limparPlanilhaPrincipal()
```

allows the user to clear the playlist area.

It:

* asks for confirmation;
* clears content;
* clears formatting;
* breaks merged cells.

This behavior has already been tested successfully.

---

# 10. WEB APP API

The backend exposes:

```javascript
doGet(e)
```

and:

```javascript
doPost(e)
```

## GET endpoint

`doGet()` returns JSON containing:

```json
{
  "cultos": [],
  "repertorio": [],
  "banco": [],
  "cantores": [],
  "novas": []
}
```

Current mappings:

```text
cultos     → Playlists
repertorio → Banco_Musicas
banco      → Banco_Musicas
cantores   → Cantores
novas      → Musicas_Novas
```

Important:

`repertorio` and `banco` currently both point to `Banco_Musicas`.

Do not remove or rename these properties without verifying frontend dependencies.

---

# 11. POST API ACTIONS

The backend currently handles several actions through `doPost()`.

## 11.1 moverMusicasNovas

Action:

```text
moverMusicasNovas
```

Behavior:

1. Reads songs from `Musicas_Novas`.
2. Excludes the header.
3. Copies them to `Banco_Musicas`.
4. Sorts the bank alphabetically by column A.
5. Deletes the processed rows from `Musicas_Novas`.

---

## 11.2 toggleOculto

Action:

```text
toggleOculto
```

Behavior:

* Reads the service header.
* Adds:

```text
 - OCULTO
```

when currently visible.

* Removes the suffix when currently hidden.

This is used to hide/show a service.

---

## 11.3 salvarCulto

Action:

```text
salvarCulto
```

This is the main service creation/editing operation.

It supports:

### New service

Adds the new block to the bottom of `Playlists`.

### Editing an existing service

The old block is removed and recreated at the same location.

The current editable properties are:

* service date;
* service type;
* musicians/instrumental scale;
* service singers;
* singers assigned to each song;
* add songs;
* delete songs;
* reorder songs.

### Explicit limitation

Editing a song's key is **not currently supported**.

Editing a song's variation/transposition is also not part of the current service-editing workflow.

Do not add these capabilities automatically.

---

# 12. REQUESTS

If a POST request does not match the specialized actions above, the backend records a request in:

```text
Solicitacoes
```

The sheet is automatically created if necessary.

Columns:

```text
Data/Hora
Categoria
Música / Culto
Quem Pediu
Solicitação
```

---

# 13. CURRENT TEST STATUS

The backend was tested after the latest implementation.

All planned tests passed.

This includes:

* new service creation;
* service data persistence;
* editing;
* musician scale;
* singers;
* song addition;
* song deletion;
* song reordering;
* hide/show;
* music bank handling;
* requests;
* playlist/history behavior.

There was one clarification concerning the editing test:

### Previous test assumption

Changing the key of a song during service editing.

### Correct behavior

Changing the key is **not an available editing feature**.

Therefore this is **not a bug** and should not be implemented unless explicitly requested later.

The backend is currently considered stable.

---

# 14. DEVELOPMENT WORKFLOW

The project is being developed through the Antigravity IDE.

The user has:

```text
Git
Node.js
clasp
```

installed.

The expected backend workflow is:

```bash
clasp push
```

after modifying the Apps Script source.

Do not repeatedly rewrite or regenerate `codigo.js` unnecessarily.

The user specifically questioned why a previous generated version became dramatically larger than the original. The conclusion was that unnecessary expansion/reimplementation should be avoided.

Therefore:

**Preserve the current file structure and modify only what is necessary.**

---

# 15. CURRENT PROJECT STATE

The backend is currently considered functional and tested.

The next logical area to inspect is the **frontend**.

The reason is that the backend has now been validated, but the frontend must be checked against the current API/data structure.

In particular, the frontend must be verified against:

```text
7-column Playlists structure
A:E merged service header
F = instruments JSON
G = service singers
G = song singers on song rows
```

and against the current API actions:

```text
moverMusicasNovas
toggleOculto
salvarCulto
generic requests
```

---

# 16. FRONTEND FILES — STATUS

The exact frontend structure has **not yet been provided in this conversation**.

The next inspection should therefore identify the actual frontend files in the Antigravity repository.

Likely files may include things such as:

```text
index.html
app.js
script.js
style.css
```

but these are only examples.

**Do not assume these filenames exist.**

Inspect the repository first.

---

# 17. EXACT NEXT STEP

The next logical action is:

## Inspect the existing Antigravity project structure.

Specifically:

1. Locate the frontend entry point.
2. Locate JavaScript files responsible for API communication.
3. Locate CSS/UI files.
4. Identify where the Google Apps Script Web App URL is configured.
5. Identify all calls to:

   * `doGet`
   * `doPost`
   * `salvarCulto`
   * `toggleOculto`
   * `moverMusicasNovas`
6. Identify how the frontend parses the `doGet()` response.
7. Identify how the frontend represents:

   * services;
   * songs;
   * singers;
   * musicians;
   * instruments;
   * hidden services.
8. Compare those structures against the backend documented above.

### Important

**Do not modify code during this initial inspection.**

First produce a technical compatibility report describing:

```text
Frontend component
↓
Backend/API dependency
↓
Expected data structure
↓
Current implementation
↓
Compatible / incompatible / uncertain
```

Only after this inspection should implementation work begin.

---

# 18. CURRENT FUNCTIONAL REQUIREMENTS FOR SERVICE EDITING

The frontend's service editor should currently support:

```text
[✓] Change service date
[✓] Change service type
[✓] Change musician/instrument scale
[✓] Change service singers
[✓] Change singers assigned to each song
[✓] Add song
[✓] Remove song
[✓] Reorder songs

[✗] Change song key during service editing
[✗] Change song transposition during service editing
```

Do not interpret the two last items as bugs.

---

# 19. DESIGN PRINCIPLES

The following principles should be maintained:

### Minimal changes

Do not rewrite working systems simply for code style.

### Backward compatibility

Existing spreadsheet data must remain usable.

### Data consistency

The frontend and backend must agree on the same structure.

### Clear separation

The system consists of:

```text
UI
↓
Frontend logic
↓
HTTP/API
↓
Apps Script
↓
Google Sheets
```

Changes should respect these boundaries.

### No speculative features

Do not implement future Android/iOS functionality now.

Do not add authentication, databases, frameworks, or architectural changes unless explicitly requested.

---

# 20. FUTURE POSSIBILITIES — NOT CURRENT TASKS

The project may eventually evolve into:

```text
Web
Android
iOS
```

and potentially become usable by multiple churches.

However, these are future goals only.

They should not influence current implementation unless a specific requirement is given.

---

# 21. AGENT INSTRUCTIONS

When beginning work from this context:

### First

Inspect the repository.

### Second

Map the frontend files and architecture.

### Third

Compare frontend/backend contracts.

### Fourth

Report discrepancies.

### Fifth

Wait for explicit approval before making architectural or functional changes.

### Never

* replace working code without reason;
* invent missing requirements;
* add unsupported editing features;
* change spreadsheet structure without authorization;
* rename API properties casually;
* replace Google Sheets with another database;
* introduce a framework merely for convenience;
* create a massive rewritten file when a small patch is sufficient.

---

# 22. IMMEDIATE OBJECTIVE

The immediate objective is **not to add a new feature yet**.

The immediate objective is:

> **Understand and document the current frontend implementation and verify its compatibility with the already-tested Google Apps Script backend.**

After that compatibility analysis, the project owner will decide what should be implemented next.

---

# 23. SOURCE OF TRUTH

For the current backend behavior, treat the latest tested version of:

```text
codigo.js
```

as the source of truth.

For the frontend behavior, treat the actual files currently present in the Antigravity repository as the source of truth after inspection.

For business rules, use the requirements documented in this Context Prompt.

If the repository contradicts this document, **do not silently choose one**. Report the discrepancy and request clarification when necessary.

---

# END OF CONTEXT PROMPT

```
```
