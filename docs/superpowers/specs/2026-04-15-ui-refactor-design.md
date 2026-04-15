# UI Refactor Design — evm-caller

**Date**: 2026-04-15
**Status**: Draft (awaiting user review)

---

## 1. Motivation

The existing UI feels cramped and fragile on a 2K display:

- `max-w-[1920px]` caps total width, wastes screen estate on >1920 monitors
- Debug Trace allocates only 8/12 cols (~66%) to the trace view
- Tree rendering uses `paddingLeft: depth * 16px` with no cap, compounding with `p-6` card padding and inner `px-4` detail padding — deep nodes get pushed off-screen
- JSON output uses `<pre overflow-x-auto>` rather than wrapping, forcing horizontal scroll
- The preset drawer (320px) pushes main content when pinned, further shrinking the canvas
- The default `from-blue-50 via-indigo-50 to-purple-50` pastel gradient reads as generic / AI-default, clashing with the tool's serious dev-tool purpose

This redesign fixes layout at every layer (shell + per-tab + node rendering) and establishes a distinctive visual language the tool can own.

## 2. Scope

- Full rewrite of `src/App.tsx` shell (nav, preset access, theming)
- Full rewrite of all 7 tab pages (`*Page.tsx`) following the new design system
- Replace `PresetSidebar` with a `PresetModal`
- Introduce a shared design-token system (Tailwind theme + CSS variables)
- Introduce shared layout primitives: `TopNav`, `TxBar`, `StatsRibbon`, `NodeCard`, `CallTreeRow`

**Preserved as-is** (non-goals — these stay exactly as they work today):

- All `utils/*` modules — RPC calling, trace parsing, ABI handling, storage schema, multi-call, state-override logic
- The `localStorage` schema under the `evm-caller:` prefix (preset data must not be lost)
- Ethers v6 usage; no dep churn beyond necessary font additions
- The 7-tab organization and every feature within each tab
- i18n (zh/en) coverage for every new UI string

## 3. Non-Goals

- Light theme. Dark-only for this round. Token architecture should leave room for a light theme later, but we do not build one.
- Mobile-first responsiveness. The current "barely works on phones" bar is preserved — no regressions, but we optimize for ≥1440px.
- Test coverage. No tests exist today; we do not add them in this refactor.
- Backwards-compatibility with the old component API. Since we own all callers, we rewrite freely.

---

## 4. Visual Design System — "Obsidian Terminal"

A dark-first, monospace-heavy dev-tool aesthetic. Low-saturation base + mint accent + IBM Plex Sans for UI + JetBrains Mono for data.

### 4.1 Color tokens

Expressed as CSS variables on `:root`. Tailwind extends `theme.colors` to reference them via `theme('colors.ink')` etc.

| Token | Value | Role |
|---|---|---|
| `--bg` | `#0b0d10` | App background |
| `--surface` | `#14171c` | Cards, tree nodes, input surfaces |
| `--surface-2` | `#1a1e25` | Hover / focused surface |
| `--line` | `#2a2f38` | Primary hairline / border |
| `--line-soft` | `#1c2028` | Inter-row dividers |
| `--fg` | `#e6e8ec` | Primary text |
| `--fg-dim` | `#8b93a3` | Secondary text / labels |
| `--fg-mute` | `#6e768a` | Tertiary text / small meta |
| `--mint` | `#6fffdd` | Primary accent (active tab, selected row, success) |
| `--blue` | `#60a5fa` | `CALL` |
| `--amber` | `#fbbf24` | `DELEGATECALL` |
| `--violet` | `#a78bfa` | `STATICCALL` |
| `--emerald` | `#4ade80` | `CREATE` / `CREATE2` |
| `--red` | `#ff5b6e` | Errors / reverts |

Call-type colors are used as `bg: color / 12%` + `fg: color` for the type badge.

### 4.2 Typography

Loaded via Google Fonts, one `<link>` import in `index.html`.

- **Display / brand**: `JetBrains Mono` 700 — used sparingly for brand mark and large mono headings
- **UI**: `IBM Plex Sans` 400/500/600 — all UI text (buttons, labels, page copy)
- **Data**: `JetBrains Mono` 400/500/600 — addresses, hex, function names, JSON, all tabular data
- **Label kicker**: `JetBrains Mono` 500, uppercase, `letter-spacing: 0.22em`, 9–10px — used for section labels ("CALL TREE", "FOCUSED + PINNED", "INPUT", etc.)

No other fonts. The two-font system is the entire typographic identity.

### 4.3 Spacing, radius, borders

- **Border radius**: `3px` for controls, `4px` for cards, `2px` for badges. No `rounded-lg` or softer.
- **Border width**: 1px hairlines everywhere. 2px only for left-border selection indicator (mint).
- **Density**: Base unit 4px. Rows are 28–32px tall (vs current 48–60px). Primary card padding `14px`, not `24px`.
- **Shadows**: None. Depth is communicated by background tint (`surface` → `surface-2`) and hairline borders. No shadow-md / shadow-lg.

### 4.4 Motion

- Hover: 120ms opacity/background transition only
- Expand/collapse: 160ms max-height with ease-out
- Tab switch: no animation (instant)
- Preset modal: 180ms fade + 4px upward translate on open

No scroll-driven effects. No decorative animations.

---

## 5. Shell (Layout B)

```
┌──────────────────────────────────────────────────────────┐
│ TopNav · brand · tabs · actions                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│                                                          │
│ Tab content (100% width, no max-width cap)               │
│                                                          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 5.1 TopNav

A single 44px row, always pinned.

- **Left**: `evm-caller` brand mark (JetBrains Mono 700), `·` separator in mint, then active tab label as mono caption
- **Center**: Tab buttons. 7 flat chips. Active tab: mint fill + ink text. Inactive: dim color, no border.
- **Right**: `presets` (opens modal) · `en/zh` toggle · `cfg` (import/export config)

No subtitle, no badges, no description row. All that content is folded into per-tab intro text when needed.

### 5.2 Content zone

- Full window width — no `max-width` cap
- No outer padding on the viewport — content zone goes edge to edge. Per-tab internals handle their own padding.
- No footer. Footer copyright removed (single-page SPA, not needed).

### 5.3 Preset drawer removal

The existing `PresetSidebar` (320px slide-out) is removed. Its functionality migrates to a `PresetModal` (section 6).

`App.tsx` state changes:
- Remove: `isPresetPinned`, `isPresetHoverOpen`, `drawerWidth`, hover handlers, all padding-left shifts
- Add: `isPresetModalOpen: boolean`

---

## 6. Preset Modal

Triggered by `presets` in the top nav (or keyboard: `⌘K` / `Ctrl+K`, as a nice-to-have if time permits).

### 6.1 Layout

A full-screen-darkened backdrop + centered modal at `max-width: 1200px, height: 80vh`.

Three columns, equal width:

```
┌─────────────┬─────────────┬─────────────┐
│ RPC URLs    │ Contracts   │ ABIs        │
│             │             │             │
│ [+ add]     │ [+ add]     │ [+ add]     │
│ ───────     │ ───────     │ ───────     │
│ ● Eth main  │ USDC        │ □ ERC20     │
│ ● BSC       │ WETH        │ ☑ Uni V3    │
│ ○ Polygon   │ Vitalik EOA │ ☑ ERC721    │
│             │             │             │
└─────────────┴─────────────┴─────────────┘
```

- RPC & Contract: radio-style (single selection drives `rpcUrl` / `contractAddress` state)
- ABI: checkbox-style (multi-select, merged into `selectedAbis[]`)
- Each row has inline edit / delete icons on hover
- Each column's `+ add` opens an inline form below the list

### 6.2 Sync with app state

- Opening the modal reflects current selection (selected RPC highlighted, selected contract highlighted, selected ABIs checked)
- Changes commit immediately to app state (no "save" button)
- Esc or click backdrop closes modal; current selection is preserved

### 6.3 Empty state

If no preset in a column: show a muted "No RPC URLs saved yet — add your first" prompt with the `+ add` button prominent. Default seed presets (Ethereum / BSC / Polygon RPC, ERC20 ABI) are created on first-run as today.

---

## 7. Debug Trace Page (A+ Pin-Stack)

### 7.1 Layout zones

Vertical stack of 4 zones:

1. **TxBar** (36px) — tx hash + block + ABI count + refetch button
2. **StatsRibbon** (52px) — 5 cells: calls, max depth, total gas, reverts, decoded ratio
3. **Split** (remaining height) — 60%/40% tree / pin-stack
4. No footer

### 7.2 TxBar

Before trace is fetched: shows tx hash input with `fetch` button.
After trace is fetched: collapses to a single mono row:

```
TX  0xa7f2…b3d1  /  BLOCK  18,412,207  /  ABIS  3            [ refetch ]
```

Controls currently in the left `RPC 状态` / `ABI 提示` / `地址显示切换` panels are redistributed:

- RPC source display → moved into TxBar kicker section or a tooltip (low-info, doesn't need a card)
- `expand all` / `collapse all` → moved into call-tree panel header (right side of `CALL TREE` label)
- `showAddressNames` toggle → moved into TopNav actions area, as a global preference (applies to any tab showing addresses)
- `usageTips` card → removed; replaced by an inline `?` button in TxBar that opens a lightweight popover

The "使用提示" help card gets deleted. Tips are low-value once the user has used the tool once, and their persistent presence eats vertical space.

### 7.3 StatsRibbon

5 equal cells, border-separated (no gap):

| Label | Value | Notes |
|---|---|---|
| `CALLS` | total call count | |
| `MAX DEPTH` | deepest nesting | |
| `TOTAL GAS` | summed gasUsed | |
| `REVERTS` | count of errors | red when > 0 |
| `DECODED` | `N/M` ABI-decoded ratio | mint when `N == M` |

Labels are 9px mono uppercase (fg-mute), values are 18px mono 600 (fg).

### 7.4 Call tree (left 60%)

Panel header:
```
CALL TREE                         expand all · collapse all
```

Each row is a single-line 6-column grid:

| Col | Content |
|---|---|
| 1. rail | `│  │  │` mono guide characters, one `│` + 2 spaces per depth level |
| 2. type | Call-type badge (`CALL`, `DELEGATECALL`, `STATIC`, `CREATE`, `REVERT`) |
| 3. target | `from → to .fn`, contract alias preferred over hex, `text-overflow: ellipsis` |
| 4. gas num | Formatted gas used (right-aligned, mono) |
| 5. gas bar | 60px × 3px horizontal bar, fill = gasUsed/parentGas, mint (red for revert) |
| 6. caret | `▸` collapsed / `▾` expanded (tree-level expand/collapse, not detail expand) |

Row height: 28px. Hover: `surface-2` background. Selected (focused): 2px left border mint + subtle mint tint. Pinned: small 📌 in target column + subtle mint tint.

Rail guides use monospace characters so they always align at the same pixel positions — no `padding-left: depth*16px` accumulator. Depth 10 = 30 chars (~21px), not 160px.

### 7.5 Pin-stack (right 40%)

Panel header:
```
FOCUSED + PINNED   3                          close all
```

Below: vertical stack of detail cards, separated by 1px line.

Each `NodeCard`:

```
┌──────────────────────────────────────────────────┐
│ [CALL]  crumb: router · impl · pool.swap  📌  × │
│ ──────────────────────────────────────────────── │
│ from       0xe592…1564 (Router Impl)             │
│ to         0x88e6…eb40 (WETH/USDC 0.05%)         │
│ gas        142,018 (94.7%)                       │
│                                                  │
│ INPUT — swap(recipient, zeroForOne, ...)         │
│ { "recipient": "0xd8dA…", ... }                  │
│                                                  │
│ OUTPUT — revert                                  │
│ InsufficientAllowance()                          │
└──────────────────────────────────────────────────┘
```

Card states:

- **Focused**: one card only. Replaced by the next click. `surface-2` background, "FOCUSED" mint flag in header.
- **Pinned**: any number. Survives clicks. 📌 icon is mint (filled) when pinned.
- **Collapsed**: only the header row shows; body hidden. Click header to re-expand.

### 7.6 Interaction model

```
state:
  selectedPath  : string | null    // the last-clicked (focused) path
  pinnedPaths   : Set<string>      // paths that stay regardless of new clicks
  collapsedPaths: Set<string>      // pin cards that are collapsed (header-only)

on row click (path):
  if (cmd || shift key)  → pinnedPaths.add(path)
  else                   → selectedPath = path

on 📌 click (card):
  if pinnedPaths.has(path) → pinnedPaths.delete(path)
  else                     → pinnedPaths.add(path)

on × click (card):
  if pinnedPaths.has(path) → pinnedPaths.delete(path)
  else                     → selectedPath = null   // closes focused card

render right panel:
  cards = (selectedPath ? [selectedPath] : []).concat(
            [...pinnedPaths].filter(p => p !== selectedPath)
          )
  // selectedPath is always at top (if exists)
  // pinnedPaths render in insertion order below
```

Soft cap: no hard limit on `pinnedPaths.size`. UX hint: once `pinnedPaths.size >= 5`, show a muted "N pinned — consider closing some" hint in the panel header.

### 7.7 State persistence

In addition to current `DebugTraceState`, add to `localStorage`:

- `selectedPath: string | null`
- `pinnedPaths: string[]`
- `collapsedPaths: string[]`

Keep everything else (`txHash`, `rawTrace`, `expandedNodes`, `showAddressNames`) as today. The `evm-caller:debug-trace-result` key continues to be the storage location.

---

## 8. Other Tabs — Unified Frame

All tabs follow this 3-zone skeleton, even if some zones are empty:

```
┌─ TxBar / Input Bar ─────────────────┐
├─ StatsRibbon (optional) ────────────┤
├─ Main content ──────────────────────┤
│                                     │
└─────────────────────────────────────┘
```

Tab-by-tab specifics:

### 8.1 function-call

- **TxBar**: RPC + contract address + block tag + selected ABI count (compact row)
- **StatsRibbon**: none (simple list of callable functions doesn't need stats)
- **Main**: 2-column 40/60 split
  - Left: function list (grouped by name, filterable)
  - Right: focused function detail — input args form + call button, plus history of this function's recent calls (if any) in a collapsible section below
- The current 3-column (config / funcs / results) is collapsed to TxBar + 2-col, freeing ~25% horizontal space
- Call history moves into the right panel, scoped to the focused function. A separate global history view is not needed (call history across functions was low-value)

### 8.2 transaction-parser

- **TxBar**: tx hash + network + ABI count + parse button
- **StatsRibbon**: 4 cells — `INPUT`, `LOGS`, `VALUE`, `STATUS`
- **Main**: vertical split
  - Top: tx header (from/to/value/gas) + decoded input, 1 card full-width
  - Bottom: logs list as a single-column table — each log row is expandable inline to reveal decoded args (no pin-stack here; logs are read-only and rarely compared pairwise, so inline-expand is simpler and fits the tabular nature)

### 8.3 hex-parser

- **TxBar**: decoder mode selector (auto / function / event / error) + ABI count
- **StatsRibbon**: none
- **Main**: split 50/50
  - Left: hex input (multi-line textarea) + parse button
  - Right: parse result, kept as a list of historical parses (stack of cards, newest on top, each collapsible)
- The right side effectively becomes a pin-stack of past parses; user clears via `close all` in panel header

### 8.4 event-query

- **TxBar**: contract address + event name selector (from ABI) + from/to block
- **StatsRibbon**: 3 cells — `EVENTS`, `BLOCK RANGE`, `DURATION`
- **Main**: event table (one row per event), each row expandable to reveal decoded args in-line. No split here — events are tabular; side-by-side comparison is less common than for call traces.

### 8.5 abi-encoder

- **TxBar**: encoding mode (abi / packed) · operation (encode / decode)
- **StatsRibbon**: none
- **Main**: split 40/60
  - Left: types + values input (for encode) OR hex input (for decode) + type-def preset selector
  - Right: output area — result of the latest operation at top, operation history below as a stack

### 8.6 state-override

- **TxBar**: target contract + rpc method (eth_call / debug_traceCall)
- **StatsRibbon**: 2 cells — `ACCOUNTS OVERRIDDEN`, `SLOTS OVERRIDDEN`
- **Main**: 3-zone vertical
  - Top: accounts override editor (list of accounts w/ balance/nonce/code/storage overrides)
  - Middle: multi-call config (mode + call list)
  - Bottom: result
- This tab is the most complex and the vertical layout gives each sub-zone breathing room

---

## 9. i18n

Every new UI string is added to both `src/i18n/locales/zh.json` and `src/i18n/locales/en.json`. Existing translation keys that reference removed UI (e.g., `rpcConfig.selectFromLeft`, `debugTrace.notConfigured`, `debugTrace.usageTips`, `debugTrace.tip1…tip4`, etc.) are removed after all consumers are gone.

Translation keys use the same structure (`nested.dotted.keys`) and stay per-tab (`debugTrace.*`, `txParser.*`, etc.).

## 10. Persistence

The `evm-caller:`-prefixed `localStorage` schema continues unchanged. We add three new keys in `DebugTraceState`:

- `selectedPath`
- `pinnedPaths`
- `collapsedPaths`

No migration needed — absent fields default to null/empty, which matches a fresh first-open state.

## 11. Implementation Phases

Phased to de-risk. Each phase is a mergeable PR that leaves the app in a working state.

1. **Design tokens + TopNav + PresetModal** — Tailwind theme update, font import, new `TopNav` and `PresetModal` components. Existing tabs still render with old styling (temporarily clashy). App is usable.
2. **Debug Trace page** — TxBar, StatsRibbon, CallTreeRow, NodeCard pin-stack. Delete `PresetSidebar` usage from this page. Integrate with TopNav.
3. **Remaining 6 tabs** — Redo in any order (function-call first recommended since it's the most-used). Each tab PR is independent.
4. **Cleanup** — Remove `PresetSidebar.tsx`, `FunctionList.tsx` (if replaced by `EnhancedFunctionList`), dead i18n keys, leftover legacy styles. Remove `App.tsx`'s drawer state.

## 12. Risks & Open Questions

- **Pin-stack works great for call traces but is it right for hex-parser history / abi-encoder history?** The pattern maps naturally, but history is insert-only (you can't "re-select a previous parse to replace current"). May need a simpler "list of collapsible result cards" variant. → Proposed: treat history as a list of always-pinned cards, no focused state. Clear via `close all`. Decision can be made during implementation of those tabs.

- **(resolved) Transaction parser logs**: pin-stack does not apply — logs are read-only and tabular; inline-expand per row is the chosen model (see section 8.2).

- **⌘K / Ctrl+K for preset modal**: nice-to-have, not required. Skip if scope creeps.

- **Font loading perf**: Google Fonts adds ~50kb for the two families. Acceptable for a dev tool SPA; no FOUT mitigation beyond `font-display: swap` (the default). If someone cares later, we self-host.

- **Address-name toggle going global**: the current per-page toggle is being lifted to TopNav. This changes behavior (was only Debug Trace before). Users who relied on the per-page toggle will see consistent global behavior now — we consider this an improvement, not a regression.
