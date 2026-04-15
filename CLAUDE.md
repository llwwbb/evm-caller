# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Vite dev server
npm run build    # Type-check (tsc) then vite build — this is the canonical check; there is no separate lint/test script
npm run preview  # Preview the production build locally
npm run deploy   # Build and publish ./dist to gh-pages branch
```

No test framework is configured. `npm run build` is the only verification step — it runs `tsc` under `strict` + `noUnusedLocals` + `noUnusedParameters`, so unused imports/vars will fail the build.

The production `base` path is `/evm-caller/` (see `vite.config.ts`) because the app is deployed to `https://llwwbb.github.io/evm-caller/` via the `.github/workflows/deploy.yml` action on push to `main`.

## Architecture

**Browser-only SPA. No backend.** All state is persisted in `localStorage` under the `evm-caller:` key prefix. All blockchain interaction goes through user-supplied RPC URLs using `ethers` v6.

### Tab-based page layout (`src/App.tsx`)

The app is a single shell with 7 tabs, each backed by one `*Page.tsx` component under `src/components/`:

| Tab | Page component | Purpose |
|---|---|---|
| `function-call` | `FunctionList` / `EnhancedFunctionList` | Call view/pure (and simulated state-mutating) functions via `contract.staticCall` |
| `transaction-parser` | `TransactionParserPage` | Decode a tx's input data + logs using the merged ABI |
| `debug-trace` | `DebugTracePage` | `debug_traceTransaction` with `callTracer`, renders the nested call tree |
| `hex-parser` | `HexParserPage` | Guess-or-specify decoding of raw hex (function/event/error) |
| `event-query` | `EventQueryPage` | `getLogs` over a block range with ABI-based decoding |
| `abi-encoder` | `AbiEncoderPage` | Encode/decode by type list (abi-coder or packed) |
| `state-override` | `StateOverridePage` | `eth_call` / `debug_traceCall` with `stateOverride`; also hosts multi-call modes |

`App.tsx` owns the cross-tab state: `rpcUrl`, `contractAddress`, `blockTag`, `selectedAbis` (multi-select), `mergedAbi` (flattened JSON concat of all selected ABIs), and `callHistory`. Page components receive what they need via props — they do not read this state from context.

### The preset system (three independent dimensions)

RPC URL, contract address, and ABI are stored as **three independent preset pools** (`RpcPreset`, `ContractPreset`, `AbiPreset`) in `src/utils/presetStorage.ts`. A user freely combines any row from each pool — there is deliberately no "bundle" type that ties them together. The sidebar (`PresetSidebar`) is the primary way to load them into `App.tsx` state, and `ABI` is **multi-select with merging**: selected ABI JSON arrays are `flat()`-concatenated into `mergedAbi` and passed to every page.

`initializeDefaultPresets()` seeds Ethereum/BSC/Polygon RPC entries and a standard ERC20 ABI on first run — only when the respective pool is empty.

### `presetStorage.ts` is the single source of truth for persistence

Every feature that persists anything (presets, call history, per-page result caches for Tx/Hex/Event/Debug-Trace/ABI-encoder, type-def presets, state-override presets, last-used config) goes through named functions in `src/utils/presetStorage.ts`. Keys are centralized in the `STORAGE_KEYS` constant. **All `JSON.stringify` calls in this file pass a replacer that converts `bigint` → string** — any new persistence you add must do the same, or saving a value touched by `ethers` will throw.

### Utility module layout (`src/utils/`)

One file per domain — don't spread a domain across multiple utils:

- `abiParser.ts` — accepts either JSON ABI or newline-separated Solidity function signatures; `includeStateMutating` flag toggles whether non-view/pure functions are returned. Tuple components parsed recursively.
- `rpcCaller.ts` — `callViewFunction` dispatches to `staticCall` for `nonpayable`/`payable`, direct call for `view`/`pure`. `formatResult` unwraps ethers `Result` objects via `toObject()` when available and falls back to manually walking named keys.
- `transactionParser.ts`, `debugTrace.ts`, `eventQuery.ts`, `hexParser.ts` — per-tab decoding logic.
- `debugTrace.ts` uses raw `fetch` (not `provider.send`) to bypass ethers batching — some RPC endpoints reject `debug_traceTransaction` inside a batch.
- `stateOverride.ts` formats `state` / `stateDiff` / `balance` / `nonce` / `code` for `eth_call` and `debug_traceCall`.
- `multiCall.ts` has three modes: `multicall` (Multicall3 via state-override-deployed bytecode from an EOA), `manual-delegation`, `sequential`.
- `storageSlot.ts` implements Solidity storage layout: packed slots, `keccak256(key . slot)` for mappings, `keccak256(slot) + index` for dynamic arrays.
- `abiEncoder.ts` — encode/decode and user-friendly output formatting (numeric → decimal, bytes preserved as hex, tuples as objects when components have names).

### i18n

`react-i18next` with `zh` (default) + `en` in `src/i18n/locales/*.json`. Language persists to `localStorage['language']`. **Any new user-facing string must be added to both JSON files and accessed via `t('…')`.** Do not hardcode Chinese or English in components.

### Styling

Tailwind CSS only. No CSS modules, no styled-components. The fixed-width preset drawer on the left uses a hover-to-open + pin-to-stay pattern driven by `isPresetPinned` / `isPresetHoverOpen` in `App.tsx`, and both header/main/footer shift by `drawerWidth` when pinned.

## Conventions

- **ethers v6 everywhere** — no v5 APIs (`ethers.utils.*` etc.) and no `BigNumber`; use native `bigint`.
- A function/page that needs the RPC URL reads it from props, not from `presetStorage`. `presetStorage` is only for reading the *preset pool* or for seed/restore on mount.
- When adding a new persisted artifact: add the key to `STORAGE_KEYS`, write load/save/clear pair functions in `presetStorage.ts`, always pass the bigint replacer to `JSON.stringify`.
- When adding a tab: append to the `TabType` union + `tabs` array in `App.tsx`, create `*Page.tsx`, and pass already-available cross-tab state (`rpcUrl`, `mergedAbi`, etc.) as props rather than re-reading from storage.
