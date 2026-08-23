---
name: translation-similarity
description: >
  Translation-memory similarity for Icosa AI examples. Inverted-index
  SimilarityIndex plus a dedicated worker — not Fuse.js on 200k rows. Use when
  changing similarity.service, similarity-client, AI batch examples,
  dictionary:similar, or prompt example filtering. Triggers: Fuse, similar,
  similarity, TM, examples, translateBatch, freeze on AI, /translation-similarity.
---

# Translation similarity

AI batch with Fuse.js on 241,877 rows blocked the UI: **~4.3s per query**, **~7.5 min** for 105 XML lines, before any HTTP. The replacement is an inverted-index `SimilarityIndex` plus `similarity.worker`.

Measured (CSV `en|pt-BR` × `enhanced-elemental-gear.xml`): build ~0.6s, 105 searches ~0.4s, mean ~4ms.

## Keep

- `SimilarityIndex` in `src/main/services/similarity.service.ts`. Score is **distance** `0 = best` (same as Fuse). UI / `filterExamples` use `1 - score`.
- Main-process callers (`dictionary:similar`, `ai:translateBatch`) go through `SimilarityClient` → `similarity.worker.js`. The worker opens SQLite itself. Do not `getAllForSimilarity` + `new SimilarityIndex` on the Electron main thread.
- Register the worker in `electron.vite.config.ts` (`similarity.worker`). Missing input = silent runtime failure.
- Invalidate the worker cache after dictionary writes (`invalidateSimilarityCache`).
- If the worker fails during AI batch, continue **with empty examples**. Do not fall back to in-process Fuse/index build on main (that reintroduces the freeze).
- `translate.worker` may build `SimilarityIndex` in-process — that thread is not the UI.

## Do not

- Reintroduce `fuse.js` for dictionary-sized corpora.
- Rebuild the corpus inside `findSimilar` / `dictionary:similar` per keystroke.
- Loop `index.search` over a whole mod on main before `aiTranslateGroup`.
- Change the score convention without updating `filterExamples` and the AI modal (`1 - r.score`).

## Verify before finishing

1. Time similarity for a full XML (e.g. `data/enhanced-elemental-gear.xml`) against a 200k dictionary: all searches should finish in well under a second, not minutes.
2. `pnpm dlx tsx --test src/main/services/similarity.service.test.ts`
3. Open the AI row modal with similarity enabled: examples appear without freezing the window.
4. Start an AI batch with similarity on: the grid must keep receiving events; main must not peg a core before the first HTTP call.
5. After a dictionary upsert, the next similar query must see the new row (cache invalidation).
