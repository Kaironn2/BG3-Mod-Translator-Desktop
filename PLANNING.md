# Icosa — BG3 Mod Translator Desktop

## Planejamento da Migração: Python/PySide6 → Electron + React + TypeScript + Tailwind

---

## 1. Visão Geral do Projeto

Ferramenta desktop para tradução de mods de Baldur's Gate 3. Descomprime pacotes de mod
(.pak, .zip, .rar), parseia os XMLs de localização, aplica tradução automática ou manual,
e reempacota o mod traduzido. Mantém um dicionário local de traduções para reutilização
e uso como contexto para IAs.

**Nome do app:** Icosa  
**Stack anterior:** Python 3.12 + PySide6 + SQLAlchemy + RapidFuzz + pandas  
**Stack nova:** Electron + React + TypeScript + Tailwind CSS + better-sqlite3

---

## 2. Stack Tecnológica

| Camada          | Tecnologia                                    |
| --------------- | --------------------------------------------- |
| Desktop runtime | Electron (main process = Node.js)             |
| UI framework    | React 18 + TypeScript                         |
| Estilo          | Tailwind CSS + shadcn/ui                      |
| Banco de dados  | SQLite via better-sqlite3                     |
| IPC bridge      | Electron contextBridge + ipcMain/ipcRenderer  |
| Fuzzy matching  | Fuse.js → SQLite FTS5 se necessário           |
| Extração ZIP    | adm-zip ou node-stream-zip                    |
| Extração RAR    | node-unrar-js (WASM)                          |
| Unpacking .pak  | LSLib Divine.exe (externo, via child_process) |
| HTTP / APIs     | fetch nativo (Node.js 18+)                    |
| Build           | electron-builder + vite                       |
| Linting         | ESLint + Prettier                             |
| Testes          | Vitest (unitários) + Playwright (e2e)         |

---

## 3. Arquitetura Electron

### Três camadas obrigatórias

```
┌─────────────────────────────────────────────────────────────┐
│  RENDERER PROCESS  (Chromium)                                │
│  React + TypeScript + Tailwind                               │
│  Só UI, sem acesso direto ao sistema de arquivos             │
│  Comunica-se via window.api (contextBridge)                  │
└─────────────────────┬───────────────────────────────────────┘
                      │ IPC (ipcRenderer.invoke / ipcMain.handle)
┌─────────────────────▼───────────────────────────────────────┐
│  PRELOAD SCRIPT  (preload.ts)                                │
│  Expõe apenas métodos seguros via contextBridge              │
│  window.api = { translation, dictionary, mod, config, fs }  │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│  MAIN PROCESS  (Node.js)                                     │
│  ipcMain handlers, SQLite, child_process (Divine.exe)        │
│  Acesso total ao SO, arquivos, rede                          │
│  Módulos: translation, dictionary, mod, config, fs           │
└─────────────────────────────────────────────────────────────┘
```

### Princípios de segurança

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true` no renderer
- Todo acesso a disco e processos externos ocorre apenas no main process

---

## 4. Estrutura de Pastas

Estrutura gerada pelo **electron-vite** (padrão oficial). O alias `@renderer` aponta para
`src/renderer/src/`, escondendo o aninhamento no dia a dia.

```
BG3-Mod-Translator-Desktop/
├── src/
│   ├── main/                              # Main process (Node.js)
│   │   ├── index.ts                       # Ponto de entrada Electron
│   │   ├── ipc/                           # Handlers IPC
│   │   │   ├── translation.ipc.ts
│   │   │   ├── dictionary.ipc.ts
│   │   │   ├── mod.ipc.ts
│   │   │   ├── config.ipc.ts
│   │   │   └── fs.ipc.ts
│   │   ├── services/
│   │   │   ├── lslib.service.ts           # Wrapper Divine.exe
│   │   │   ├── deepl.service.ts           # DeepL API
│   │   │   ├── openai.service.ts          # OpenAI API
│   │   │   ├── xml-parser.service.ts      # Parse/gerar XML de localização
│   │   │   ├── lsx-parser.service.ts      # Parse/gerar .lsx (meta)
│   │   │   ├── zip.service.ts             # ZIP/RAR extraction
│   │   │   └── similarity.service.ts      # Fuzzy matching
│   │   ├── database/
│   │   │   ├── connection.ts              # better-sqlite3 setup
│   │   │   ├── migrations/                # SQL migration files
│   │   │   ├── repositories/
│   │   │   │   ├── dictionary.repo.ts
│   │   │   │   ├── language.repo.ts
│   │   │   │   └── mod.repo.ts
│   │   │   └── seeds/
│   │   │       └── languages.seed.ts
│   │   └── pipelines/
│   │       ├── base.pipeline.ts           # Classe base: unpack → parse → translate → pack
│   │       ├── deepl.pipeline.ts
│   │       ├── openai.pipeline.ts
│   │       └── manual.pipeline.ts
│   ├── preload/
│   │   ├── index.ts                       # Bridge renderer ↔ main (contextBridge)
│   │   └── index.d.ts                     # Tipos de window.api
│   └── renderer/
│       ├── index.html                     # Entry HTML do Chromium
│       └── src/                           # Código React — alias @renderer aponta aqui
│           ├── main.tsx                   # React entry
│           ├── App.tsx                    # Router / layout raiz
│           ├── assets/
│           │   └── main.css               # @import "tailwindcss" + CSS vars shadcn
│           ├── components/
│           │   ├── layout/
│           │   │   ├── Sidebar.tsx
│           │   │   └── MainLayout.tsx
│           │   ├── ui/                    # Componentes shadcn (gerados pelo CLI)
│           │   └── translation/
│           │       ├── TranslationTable.tsx
│           │       └── ProgressBar.tsx
│           ├── pages/
│           │   ├── TranslatePage.tsx      # Tabs: OpenAI / DeepL / Manual / Outros
│           │   ├── DictionaryPage.tsx
│           │   ├── ExtractPage.tsx
│           │   ├── PackagePage.tsx
│           │   └── SettingsPage.tsx
│           ├── hooks/
│           │   ├── useTranslation.ts
│           │   ├── useDictionary.ts
│           │   └── useConfig.ts
│           ├── store/                     # Zustand
│           │   ├── translation.store.ts
│           │   └── config.store.ts
│           ├── lib/
│           │   └── utils.ts               # cn() helper (clsx + tailwind-merge)
│           └── types/
│               └── index.ts               # Tipos compartilhados renderer
├── resources/                             # Ícones e assets estáticos do Electron
├── external_tools/
│   └── lslib/
│       └── Divine.exe                     # LSLib (mantido do app antigo)
├── bkp/                                   # App Python original (referência)
├── PLANNING.md                            # Este arquivo
├── components.json                        # Configuração shadcn/ui
├── electron.vite.config.ts               # Config Vite (main + preload + renderer)
├── electron-builder.yml                  # Config de empacotamento
├── package.json
├── tsconfig.json
├── tsconfig.node.json                     # TypeScript para main/preload
└── tsconfig.web.json                      # TypeScript para renderer
```

---

## 5. Schema do Banco de Dados

**Engine:** SQLite via `better-sqlite3`  
**Localização:** `app.getPath('userData')/dictionary.db`

### Tabela: `language`

```sql
CREATE TABLE language (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT UNIQUE NOT NULL,   -- 'pt-BR', 'en'
  name       TEXT NOT NULL,          -- 'Brazilian Portuguese'
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

### Tabela: `mod`

```sql
CREATE TABLE mod (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

### Tabela: `dictionary`

```sql
CREATE TABLE dictionary (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  language1      TEXT NOT NULL REFERENCES language(code),
  language2      TEXT NOT NULL REFERENCES language(code),
  text_language1 TEXT NOT NULL,
  text_language2 TEXT NOT NULL,
  mod_name       TEXT REFERENCES mod(name),
  uid            TEXT,
  created_at     TEXT DEFAULT (datetime('now')),
  updated_at     TEXT DEFAULT (datetime('now')),
  UNIQUE(language1, language2, uid)
);

CREATE INDEX idx_dict_lang_pair ON dictionary(language1, language2);
CREATE INDEX idx_dict_text1     ON dictionary(language1, language2, text_language1);
CREATE INDEX idx_dict_mod       ON dictionary(mod_name);
CREATE INDEX idx_dict_uid       ON dictionary(uid);
```

> **Invariante:** `language1 < language2` sempre (ordenados alfabeticamente), garantindo
> unicidade sem duplicatas espelhadas — herdado do app Python.

### Tabela: `config`

```sql
CREATE TABLE config (
  key   TEXT PRIMARY KEY,
  value TEXT
);
```

Chaves usadas: `openai_key`, `deepl_key`, `last_source_lang`, `last_target_lang`, `author`

---

## 6. Canais IPC

Todos os handlers vivem em `electron/ipc/`. O preload expõe `window.api`.

### `translation.*`

| Canal                  | Direção       | Payload                                                                   | Resposta    |
| ---------------------- | ------------- | ------------------------------------------------------------------------- | ----------- |
| `translation:start`    | renderer→main | `{ provider, filePath, modName, sourceLang, targetLang, apiKey, author }` | `{ jobId }` |
| `translation:progress` | main→renderer | `{ jobId, current, total, source, target }`                               | —           |
| `translation:done`     | main→renderer | `{ jobId, outputPath }`                                                   | —           |
| `translation:error`    | main→renderer | `{ jobId, message }`                                                      | —           |
| `translation:cancel`   | renderer→main | `{ jobId }`                                                               | —           |

### `dictionary.*`

| Canal                | Payload                                 | Resposta            |
| -------------------- | --------------------------------------- | ------------------- |
| `dictionary:getAll`  | `{ lang1, lang2 }`                      | `DictionaryEntry[]` |
| `dictionary:search`  | `{ text, lang1, lang2 }`                | `DictionaryEntry[]` |
| `dictionary:upsert`  | `DictionaryEntry`                       | `{ success }`       |
| `dictionary:delete`  | `{ id }`                                | `{ success }`       |
| `dictionary:import`  | `{ filePath, format: 'csv' \| 'xlsx' }` | `{ count }`         |
| `dictionary:export`  | `{ lang1, lang2, format, outputPath }`  | `{ success }`       |
| `dictionary:similar` | `{ text, lang1, lang2, limit }`         | `SimilarEntry[]`    |

### `mod.*`

| Canal         | Payload                       | Resposta                |
| ------------- | ----------------------------- | ----------------------- |
| `mod:extract` | `{ inputPath, outputPath }`   | `{ success, xmlFiles }` |
| `mod:pack`    | `{ inputFolder, outputPath }` | `{ success, pakPath }`  |

### `config.*`

| Canal           | Payload          | Resposta                 |
| --------------- | ---------------- | ------------------------ |
| `config:get`    | `{ key }`        | `{ value }`              |
| `config:set`    | `{ key, value }` | `{ success }`            |
| `config:getAll` | —                | `Record<string, string>` |

### `fs.*`

| Canal           | Payload                    | Resposta   |
| --------------- | -------------------------- | ---------- |
| `fs:openDialog` | `{ filters, multiple }`    | `string[]` |
| `fs:saveDialog` | `{ defaultName, filters }` | `string`   |
| `fs:openFolder` | —                          | `string`   |

---

## 7. Pipelines de Tradução

Todos os pipelines herdam de `BasePipeline`:

```typescript
abstract class BasePipeline {
  // 1. Detectar formato: .zip/.rar → extrair → encontrar .pak
  //    ou input direto .pak / .xml
  // 2. Chamar Divine.exe → extrair .pak para pasta temporária
  // 3. Filtrar XMLs do idioma fonte em Localization/{lang}/
  // 4. Para cada XML:
  //    a. Parsear → Record<uid, { version, text }>
  //    b. Para cada linha:
  //       - Checar dicionário (exact match por uid ou texto)
  //       - Se não encontrado → buscar similares → chamar translate()
  //       - Upsert no dicionário
  //    c. Emitir evento de progresso
  // 5. Gerar novo XML com traduções no idioma alvo
  // 6. Criar meta.lsx com ModuleInfo atualizado (UUID, Author, etc.)
  // 7. Chamar Divine.exe → reempacotar → .pak
  // 8. Compactar em .zip para distribuição

  abstract translate(text: string, context: SimilarEntry[]): Promise<string>
}
```

### DeepL Pipeline

- Endpoint: `https://api-free.deepl.com/v2/translate`
- Códigos de idioma em UPPERCASE (EN, PT-BR)
- Respeita rate limiting da API gratuita

### OpenAI Pipeline

- Model: configurável (padrão `gpt-4o-mini`)
- System prompt com contexto BG3:
  - Role: "translator specialized in video game localization for Baldur's Gate 3"
  - Preservar placeholders: `[Player]`, `<CHAR>`, `{{0}}`
  - Preservar LSTag format: `<LSTag Type="...">...</LSTag>`
  - Terminologia D&D (d20, dungeon master, spell slots, etc.)
  - Top-5 traduções similares injetadas como exemplos no prompt
- Temperature: 0.3 | max_tokens: 4000

### Manual Pipeline

- Não chama API externa
- Carrega XML, pré-popula traduções do dicionário (por uid, por texto, por mod+texto)
- Retorna tabela editável; usuário exporta XML manualmente

### Interface de Extensibilidade

```typescript
interface ITranslationProvider {
  name: string
  requiresApiKey: boolean
  translate(
    text: string,
    sourceLang: string,
    targetLang: string,
    context?: SimilarEntry[]
  ): Promise<string>
}
```

Qualquer nova API de IA (Gemini, Claude, etc.) implementa esta interface.

---

## 8. Similarity Search

**Biblioteca:** Fuse.js (sem native bindings, TypeScript-first)

**Fluxo:**

1. Antes de cada tradução, chamar `similarity.service.ts` com o texto fonte
2. O serviço carrega todas as entradas do par de idiomas em memória (cache por sessão)
3. Fuse.js ranqueia as 5 mais similares por score
4. Retornar pares `{ original, translated }` para uso como contexto no prompt

**Alternativa de performance — SQLite FTS5:**

```sql
CREATE VIRTUAL TABLE dictionary_fts USING fts5(
  text_language1,
  text_language2,
  content=dictionary
);
```

Permite busca full-text nativa sem dependências extras. Migrar se Fuse.js for lento em dicionários grandes (>50k entradas).

---

## 9. Integração LSLib (Divine.exe)

**Localização no projeto:** `external/lslib/Divine.exe`

**Comandos executados via `child_process.execFile`:**

```typescript
// Extrair .pak para pasta
execFile(divinePath, ['-g', 'bg3', '-a', 'extract-package', '-s', pakPath, '-d', outputDir])

// Criar .pak a partir de pasta
execFile(divinePath, ['-g', 'bg3', '-a', 'create-package', '-s', inputDir, '-d', outputPak])
```

**Considerações para distribuição:**

- No app empacotado: localizar via `process.resourcesPath` + `app.getAppPath()`
- Configurar `asarUnpack` no electron-builder para `external_tools/**` (executáveis não podem estar dentro do `.asar`)
- Capturar stdout/stderr do processo para log de erros

---

## 10. Extração ZIP/RAR

**ZIP:** `adm-zip` ou `node-stream-zip` (pure Node.js, sem native bindings)  
**RAR:** `node-unrar-js` (usa WebAssembly do unrar)

**Fluxo no `zip.service.ts`:**

```typescript
async function extract(filePath: string, destDir: string): Promise<void> {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.zip') await extractZip(filePath, destDir)
  else if (ext === '.rar') await extractRar(filePath, destDir)
  // .pak vai direto para lslib.service sem extração prévia
}
```

---

## 11. Parse XML de Localização BG3

**Formato do arquivo de localização:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<contentList>
  <content contentuid="hf6f9b8g..." version="1">Texto original aqui</content>
</contentList>
```

**`xml-parser.service.ts`:**

- Parser: `fast-xml-parser` (TypeScript-first, configurável)
- Saída: `Record<string, { version: string; text: string }>`
- Reconstrução: gera XML com declaração UTF-8 preservada

**`lsx-parser.service.ts`:**

- Parseia `meta.lsx` (formato LSX/LSF proprietário do BG3)
- Atualiza atributos do nó `ModuleInfo`: `Name`, `Folder`, `Author`, `Description`, `UUID`
- Preserva encoding e estrutura original do arquivo

---

## 12. Telas / Páginas do Renderer

### Sidebar (sempre visível)

- Translate
- Dictionary
- Extract Mod
- Create Package
- Settings

### TranslatePage

- Tabs: **OpenAI** | **DeepL** | **Manual** | _(+ extensível)_
- Cada tab:
  - Área de drag-drop (aceita .zip, .rar, .pak, .xml)
  - Seleção de idioma fonte e alvo
  - Configurações do provedor (API key, model, author)
  - Botão "Start Translation" / "Cancel"
- Seção de progresso:
  - Tabela com colunas: Index | Source Text | Target Text
  - Barra de progresso com contagem (atual/total)

### DictionaryPage

- Filtros: idioma 1, idioma 2, mod, texto livre
- Tabela editável: Text 1 | Text 2 | Lang 1 | Lang 2 | UID | Mod
- Edição inline com upsert automático no banco
- Ações: importar CSV/XLSX, exportar CSV/XLSX, criar dicionário a partir de dois XMLs

### ExtractPage

- Drag-drop de .zip/.rar/.pak
- Seletor de pasta de destino
- Log de extração em tempo real

### PackagePage

- Drag-drop de pasta
- Diálogo "Salvar como .pak"
- Log de empacotamento

### SettingsPage

- API keys: OpenAI, DeepL _(campos senha, botão testar)_
- Idioma fonte/destino padrão
- Nome do autor padrão
- Caminho customizável do Divine.exe

---

## 13. Idiomas Suportados (31)

Árabe, Búlgaro, Tcheco, Dinamarquês, Alemão, Grego, Inglês, Espanhol, Estoniano,
Finlandês, Francês, Húngaro, Indonésio, Italiano, Japonês, Coreano, Lituano, Letão,
Norueguês Bokmål, Holandês, Polonês, Português, Português Brasileiro, Romeno, Russo,
Eslovaco, Esloveno, Sueco, Turco, Ucraniano, Chinês Simplificado

---

## 14. Roadmap de Implementação

### Fase 0 — Setup do Projeto ✅

- [x] Inicializar Electron + Vite + React + TypeScript
- [x] Configurar Tailwind CSS + shadcn/ui
- [x] Criar estrutura de pastas (seção 4)
- [x] Configurar `electron-builder` (asar, asarUnpack, ícone, installer)
- [x] Configurar tsconfig paths com alias `@/`

### Fase 1 — Core Backend ✅

- [x] `database/connection.ts` — better-sqlite3 + Drizzle ORM
- [x] Seeds de idiomas (31 registros)
- [x] Repositórios: `DictionaryRepo`, `LanguageRepo`, `ModRepo`
- [x] `lslib.service.ts` — wrapper Divine.exe
- [x] `zip.service.ts` — extração ZIP (RAR pendente)
- [x] `xml-parser.service.ts` — parse e geração de XML BG3
- [x] `lsx-parser.service.ts` — parse e geração de meta.lsx
- [x] `similarity.service.ts` — Fuse.js para busca de contexto

### Fase 2 — IPC Layer ✅

- [x] Handlers em `src/main/ipc/` — `translation`, `dictionary`, `language`, `mod`, `config`, `fs`
- [x] `preload/index.ts` — contextBridge completo com `window.api` tipado
- [x] `preload/index.d.ts` — declarações TypeScript de `window.api` (6 namespaces, 20+ métodos)
- [x] `src/renderer/src/types/index.ts` — tipos compartilhados renderer-side
- [x] `translation.ipc.ts` — job manager com UUID + AbortController; stub aguardando Fase 3

### Fase 3 — Pipelines ⬅️ ATUAL

#### Princípio: cada peça tem responsabilidade única — pipelines apenas montam o lego

**Serviços atômicos (já existem — não alterar responsabilidade):**

| Serviço | Responsabilidade única |
|---|---|
| `lslib.service.ts` | Executar `Divine.exe` — extrair/empacotar `.pak` |
| `zip.service.ts` | Extrair `.zip` / criar `.zip` de pasta |
| `xml-parser.service.ts` | Parse e geração de XML de localização BG3 |
| `lsx-parser.service.ts` | Parse e geração de `meta.lsx` |
| `similarity.service.ts` | Fuzzy search — retorna top-N similares |
| `dictionary.repo.ts` | CRUD no banco — lookup por uid, texto, mod |

**Novos serviços atômicos a criar:**

| Arquivo | Responsabilidade única |
|---|---|
| `services/deepl.service.ts` | Chamar a API DeepL — recebe texto, retorna texto traduzido |
| `services/openai.service.ts` | Chamar a API OpenAI — recebe texto + contexto, retorna texto traduzido |

**Pipelines (montagem dos legos):**

| Arquivo | O que orquestra |
|---|---|
| `pipelines/base.pipeline.ts` | Fluxo completo: unpack → parse → traduzir cada entrada → gerar XML → meta.lsx → pack → zip. Define `abstract translate()` |
| `pipelines/deepl.pipeline.ts` | Implementa `translate()` via `deepl.service` |
| `pipelines/openai.pipeline.ts` | Implementa `translate()` via `openai.service` com system prompt BG3 e context injection |
| `pipelines/manual.pipeline.ts` | Implementa `translate()` retornando match do dicionário ou string vazia (sem API) |

**Fluxo do `BasePipeline.run()` passo a passo:**

```
1. Detectar formato do input
   ├── .zip → zip.service.extract() → encontrar .pak dentro
   ├── .rar → erro (não suportado ainda)
   └── .pak → usar direto

2. lslib.service.unpackMod(pak, tmpDir)

3. xml-parser.service.findLocalizationXmls(tmpDir, sourceLang)

4. Para cada XML encontrado:
   a. xml-parser.service.parseLocalizationXml(xmlPath) → LocalizationEntry[]
   b. Para cada entry:
      i.  dictionary.repo.findByUid(uid, src, tgt)         → cache hit?
      ii. dictionary.repo.findByText(src, tgt, text)       → cache hit?
      iii.similarity.service.findSimilar(text, corpus, 5)  → context
      iv. this.translate(text, src, tgt, context)          → tradução
      v.  dictionary.repo.upsert(...)                      → salvar
      vi. emit 'translation:progress'
   c. xml-parser.service.writeLocalizationXml(translated, outXmlPath)

5. lsx-parser.service.createMeta({ sourceMeta, outPath, modName, author })

6. lslib.service.packMod(translatedDir, outPakPath)

7. zip.service.createZip(outPakPath, finalZipPath)

8. emit 'translation:done' com outputPath
```

**Tarefas:**

- [ ] `services/deepl.service.ts` — `translateText(text, from, to, apiKey): Promise<string>`
- [ ] `services/openai.service.ts` — `translateText(text, from, to, apiKey, context, model): Promise<string>` com system prompt BG3
- [ ] `pipelines/base.pipeline.ts` — classe abstrata com fluxo completo
- [ ] `pipelines/deepl.pipeline.ts`
- [ ] `pipelines/openai.pipeline.ts`
- [ ] `pipelines/manual.pipeline.ts`
- [ ] Conectar pipelines em `translation.ipc.ts` (substituindo o stub)

### Fase 4 — UI Base (3-4 dias)

- [ ] Layout principal com Sidebar
- [ ] Componentes: DragDrop, LanguageSelect, ProgressBar, Table editável
- [ ] Roteamento com React Router

### Fase 5 — Páginas (5-7 dias)

- [ ] TranslatePage (todas as tabs + componente de progresso)
- [ ] DictionaryPage (tabela + filtros + import/export)
- [ ] ExtractPage
- [ ] PackagePage
- [ ] SettingsPage

### Fase 6 — Polish (2-3 dias)

- [ ] Ícone da aplicação e assets
- [ ] Notificações toast (sucesso/erro)
- [ ] Tema escuro como padrão
- [ ] Atalhos de teclado

### Fase 7 — Testes e Build (2-3 dias)

- [ ] Testes unitários (Vitest) — serviços e repositórios
- [ ] Testes e2e (Playwright) — fluxo principal de tradução
- [ ] Instalador Windows via electron-builder (`.exe` / `.msi`)
- [ ] Auto-updater com electron-updater

**Total estimado:** ~20-31 dias de trabalho

---

## 15. Decisões de Design

| Questão          | Decisão               | Alternativa Descartada | Motivo                                  |
| ---------------- | --------------------- | ---------------------- | --------------------------------------- |
| State management | Zustand               | Redux, Jotai           | Leve, TS-first, sem boilerplate         |
| DB driver        | better-sqlite3        | sql.js                 | Síncrono, suporte WAL, performance      |
| XML parser       | fast-xml-parser       | xml2js                 | API TypeScript-first, mais rápido       |
| Fuzzy search     | Fuse.js → FTS5        | Minisearch             | Sem native bindings; upgrade claro      |
| Extração RAR     | node-unrar-js (WASM)  | bundlar unrar.exe      | Sem executável externo adicional        |
| UI components    | Tailwind + shadcn/ui  | Material UI            | Customizável, sem lock-in de tema       |
| HTTP (main)      | fetch nativo Node 18+ | axios                  | Zero dependências para chamadas simples |

---

## 16. Referências ao App Antigo (bkp/)

Toda a lógica de negócio pode ser portada 1:1. Arquivos de referência:

| O que portar                      | Arquivo em bkp/                                |
| --------------------------------- | ---------------------------------------------- |
| Seeds de idiomas (31)             | `src/database/seeds/seed_languages.py`         |
| Schema do dicionário              | `src/database/models/dictionary.py`            |
| System prompt OpenAI + regras BG3 | `src/services/openai/prompts.py`               |
| Parse/geração de XML              | `src/parsers/xml_parser.py`                    |
| Parse/geração de LSX              | `src/parsers/lsx_parser.py`                    |
| Wrapper Divine.exe                | `src/services/external_tools/lslib_service.py` |
| Pipeline DeepL                    | `src/pipelines/deepl_translation.py`           |
| Pipeline OpenAI                   | `src/pipelines/openai_translation.py`          |
| Pipeline Manual                   | `src/pipelines/manual_translation.py`          |
| Fuzzy matching                    | `src/helpers/fuzzy_matcher.py`                 |
| Config management                 | `src/config/config_manager.py`                 |
| Extração ZIP                      | `src/utils/zip_utils.py`                       |
| External tools                    | `external/lslib/`                        |
