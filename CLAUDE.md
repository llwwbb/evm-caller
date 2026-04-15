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

### Visual design system — "Obsidian Terminal"

Dark-only dev-tool aesthetic. Token CSS variables live in `src/styles/tokens.css` (imported once in `src/main.tsx` before `index.css`). Tailwind extends `theme.colors` / `theme.fontFamily` to reference those tokens — **always use Tailwind classes (`bg-bg`, `text-fg`, `border-line`), never hardcode hex**. `var(--xxx)` is only for dynamic inline styles (e.g. gas-bar fill widths).

- Colors: `bg`, `surface`, `surface-2`, `line`, `line-soft`, `fg`, `fg-dim`, `fg-mute`, `mint` (accent), `call-blue`, `call-amber`, `call-violet`, `call-emerald`, `call-red`
- Fonts: `font-ui` (IBM Plex Sans, UI text) · `font-mono` (JetBrains Mono, all data — addresses, hex, JSON)
- Radius: `rounded-xs` (2px), `rounded-sm` (3px), `rounded` (4px). No larger rounding.
- No shadows. Depth is communicated through surface tints + hairline borders.

Fonts are loaded once via a single `<link>` in `index.html` (Google Fonts, `display=swap`).

### Shell — Layout B (top-only)

`src/App.tsx` renders:
- **`TopNav`** (`src/components/layout/TopNav.tsx`) — single-row: brand + 6 tab chips + `@names` toggle + `presets` / `EN`-`ZH` / `config` buttons
- **Main content** — full browser width, no max-width cap, tab's own page component fills it
- **`PresetModal`** (`src/components/preset/PresetModal.tsx`) — three equal-width columns (RPC / Contracts / ABIs) as a modal, driven by `isPresetModalOpen`. ABI column is multi-select with a `select all / clear` toggle.
- **`ConfigModal`** (`src/components/config/ConfigModal.tsx`) — import/export of the preset JSON file

No fixed sidebar, no footer, no 320px drawer.

### Cross-tab state (owned by `App.tsx`)

`rpcUrl`, `contractAddress`, `blockTag`, `selectedAbis` (multi-select strings), `selectedAbiNames`, `mergedAbi` (flattened JSON concat), `callHistory`, `showAddressNames`, `isPresetModalOpen`, `isConfigModalOpen`. Page components receive what they need via props — they do not read this state from context.

### Tabs

| Tab | Page component | Notes |
|---|---|---|
| `function-call` | `functionCall/FunctionCallPage.tsx` | Editable RPC/contract/block bar + 2/3 split (function list / focused function detail + recent calls scoped to that function) |
| `transaction-parser` | `TransactionParserPage.tsx` | TxBar + StatsRibbon (4 cells) + vertical stack (tx header card + inline-expandable logs table). Raw logs support per-chunk type toggle (hex/address/number/text) |
| `debug-trace` | `DebugTracePage.tsx` | TxBar + StatsRibbon (5 cells) + **60/40 split** — left: flattened single-row call tree with `│` rail guides; right: **pin-stack** of `NodeCard`s driven by `usePinStack()` |
| `hex-parser` | `HexParserPage.tsx` | Mode bar (auto/function/event/error) + 50/50 split (hex input / history cards) |
| `event-query` | `EventQueryPage.tsx` | TxBar (contract + event selector + block range + navigation) + StatsRibbon + tabular event results with inline expand |
| `abi-encoder` | `AbiEncoderPage.tsx` | Mode bar (abi/packed · encode/decode) + 2/3 split (type entries + values / output + history) |
| `state-override` | `stateOverride/StateOverridePage.tsx` | `eth_call` / `debug_traceCall` radio + editable "from" EOA + 2/3 split (account overrides + slot editor / calls list + result). `debug_traceCall` mode reuses Debug Trace's `CallTree` + `NodeStack` for free pin-stack trace visualization. |
| `slot-calc` | `slotCalc/SlotCalcPage.tsx` | Three modes: Manual (hand-type variable → compute slot), Layout JSON (paste `solc --storage-layout` / `forge inspect`), Probe (`eth_getStorageAt` over a slot range with per-row type toggles) |

### Multi-call execution (`src/utils/multiCall.ts`)

`executeBatch()` is the single API for state-override's call list. Given N calls:

- **N = 1**: direct `eth_call` / `debug_traceCall` to the single target.
- **N ≥ 2**: injects an **EIP-1167 minimal proxy** (~45 bytes) as the `code` of the `from` EOA via `stateOverride.code`, forwarding via `DELEGATECALL` to the canonical Multicall3 at `0xcA11bde05977b3631167028862bE2a173976CA11`. The proxy preserves `msg.sender`, so sub-calls (e.g. `approve`, `swap`) see the EOA as the caller — exactly what `approve + swap` simulation needs.

The full Multicall3 bytecode is NOT embedded; the ~45-byte proxy + the canonical deployment is the whole trick.

### Shared layout primitives (`src/components/layout/`)

- **`TopNav`** — the only place that hosts navigation + global actions
- **`TxBar`** — compact per-tab input bar; `items` are `[{kicker, value}]` pairs, right-aligned `actions` slot
- **`StatsRibbon`** — N equal-width cells, each `{label, value, variant?: 'ok' | 'warn'}`

### Debug Trace pin-stack (`src/hooks/usePinStack.ts`)

The right-side detail panel holds a stack of `NodeCard`s backed by one hook:
- **`selectedPath`** — the last-clicked path, always at top of the stack (if any), styled as "FOCUSED"
- **`pinnedPaths`** (Set) — additional cards that survive focus changes
- **`collapsedPaths`** (Set) — header-only view per card
- Click a row in `CallTree` → replaces focus. ⌘/Shift+click → adds to `pinnedPaths` without changing focus. Card's 📌 toggles pin; × closes (unpins or clears focus). Card header click toggles collapse.

All three sets persist to `localStorage` via the extended `DebugTraceState` in `src/utils/presetStorage.ts`.

### Address display (`src/utils/addressDisplay.ts`)

- `formatAddress(addr, nameMap, showNames)` — returns the contract alias if `showNames` is on and the preset map has an entry, else truncated `0xXXXX…XXXX`
- `buildAddressNameMap(contracts)` — builds the lowercased lookup from `ContractPreset[]`
- `CALL_TYPE_STYLE` + `REVERT_STYLE` — single source of truth for call-type badge colors (reused by `CallTreeRow` and `NodeCard`)

The `showAddressNames` toggle is **global** (lives in `App.tsx`, flipped from `TopNav`) — any page that shows addresses should consume it via props.

### The preset system (three independent dimensions)

RPC URL, contract address, and ABI are three independent preset pools (`RpcPreset`, `ContractPreset`, `AbiPreset`) in `src/utils/presetStorage.ts`. A user freely combines any row from each pool — there is deliberately no "bundle" type that ties them together. `PresetModal` is the only UI that reads/writes these pools. ABI is multi-select; selected ABI JSON arrays are `flat()`-concatenated into `mergedAbi` and passed to every page.

`initializeDefaultPresets()` seeds Ethereum/BSC/Polygon RPC + ERC20 ABI on first run when the respective pool is empty.

### `presetStorage.ts` is the single source of truth for persistence

Every feature that persists anything (presets, call history, per-page result caches for Tx/Hex/Event/Debug-Trace/ABI-encoder, type-def presets, state-override presets, last-used config) goes through named functions in `src/utils/presetStorage.ts`. Keys are centralized in `STORAGE_KEYS`. **All `JSON.stringify` calls pass a replacer that converts `bigint` → string** — any new persistence you add must do the same, or saving a value touched by `ethers` will throw.

### Utility module layout (`src/utils/`)

One file per domain — don't spread a domain across multiple utils:

- `abiParser.ts` — accepts either JSON ABI or newline-separated Solidity function signatures; `includeStateMutating` flag toggles whether non-view/pure functions are returned. Tuple components parsed recursively.
- `rpcCaller.ts` — `callViewFunction` dispatches to `staticCall` for `nonpayable`/`payable`, direct call for `view`/`pure`. `formatResult` unwraps ethers `Result` objects via `toObject()` when available and falls back to manually walking named keys. `parseParamValue` converts user string input to ethers-typed args.
- `transactionParser.ts`, `debugTrace.ts`, `eventQuery.ts`, `hexParser.ts` — per-tab decoding logic.
- `debugTrace.ts` uses raw `fetch` (not `provider.send`) to bypass ethers batching — some RPC endpoints reject `debug_traceTransaction` inside a batch.
- `stateOverride.ts` — format `stateOverride` params for RPC, plus `callWithStateOverride` / `debugTraceWithStateOverride` / `staticCallWithStateOverride` / batch variants. Single-call code path; multi-call lives in `multiCall.ts`.
- `multiCall.ts` — `executeBatch()`, the one API state-override consumes. Uses EIP-1167 proxy → canonical Multicall3 (see above section). ~220 lines.
- `storageSlot.ts` — pure Solidity storage layout math: `calculateSimpleSlot`, `calculateMappingSlot` (nested), `calculateArraySlot`, `calculatePackedSlot`, `encodeSlotValue`, `decodeSlotValue`. Used by both state-override (slot editor UI hints) and slot-calc tab.
- `abiEncoder.ts` — encode/decode and user-friendly output formatting (numeric → decimal, bytes preserved as hex, tuples as objects when components have names).

### i18n

`react-i18next` with `zh` (default) + `en` in `src/i18n/locales/*.json`. Language persists to `localStorage['language']`. **Any new user-facing string must be added to both JSON files and accessed via `t('…')`.** Do not hardcode Chinese or English in components. After a component rewrite, dead i18n keys are pruned in a cleanup pass — always match additions and removals across both locale files.

## Conventions

- **ethers v6 everywhere** — no v5 APIs (`ethers.utils.*` etc.) and no `BigNumber`; use native `bigint`.
- A page reads RPC/contract state from props, not from `presetStorage`. `presetStorage` is only for reading the *preset pool* or for seed/restore on mount.
- When adding a new persisted artifact: add the key to `STORAGE_KEYS`, write load/save/clear pair functions in `presetStorage.ts`, always pass the bigint replacer to `JSON.stringify`.
- When adding a tab: append to the `TabId` union in `src/components/layout/TopNav.tsx` + `tabs` array in `App.tsx`, create `*Page.tsx` following the TxBar + StatsRibbon + content pattern, and pass the already-available cross-tab state (`rpcUrl`, `mergedAbi`, `showAddressNames`, etc.) as props rather than re-reading from storage.
- When rendering nested data that could be deep (trees, stacks): prefer a flattened single-row grid + `│` mono rail guides over `padding-left: depth * px`. Deep nesting must not eat horizontal space.
