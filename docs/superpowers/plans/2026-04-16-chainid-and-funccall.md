# ChainId Context, Address Naming, Function Call UX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the four coupled features in the design spec (`docs/superpowers/specs/2026-04-16-chainid-and-funccall-design.md`) — per-chain contract presets, global chainId awareness, unified address naming, tuple-as-object decoding, and a reworked Function Call page with pickers and left ABI column.

**Architecture:** Three phases. Phase 1 installs the data foundation (preset schema v2, chainId backfill, new address lookup). Phase 2 unifies decoded-value rendering through `toDisplay` + `<DecodedValue />` + `<AddressBadge />`. Phase 3 adds the shared `RpcPicker`/`ContractPicker` to `TxBar` and rebuilds the Function Call page (three-column grid, ABI selector, grouped function list).

**Tech Stack:** React 18 + TS strict, Vite 5, Tailwind, ethers v6, react-i18next. No test framework — verify with `npm run build` + manual browser check against the current `main` behavior. Persistence goes through `src/utils/presetStorage.ts` (always use the existing `bigint` replacer in every `JSON.stringify`).

**Reference:** Every task below cites the relevant spec section (`§N`). When in doubt, re-read that section before implementing.

---

## File Inventory

### Create

- `src/utils/fetchChainId.ts` — raw `eth_chainId` fetch with abort support
- `src/utils/decodedFormat.ts` — `toDisplay(value, params)`
- `src/components/common/AddressBadge.tsx`
- `src/components/common/DecodedValue.tsx`
- `src/components/common/RpcPicker.tsx`
- `src/components/common/ContractPicker.tsx`
- `src/components/common/AbiSelector.tsx`

### Modify (by responsibility)

- **Types**: `src/types/index.ts` — `ContractEntry`, `ContractPreset` v2, `ParsedFunction.abiName`.
- **Preset storage**: `src/utils/presetStorage.ts` — migration, v2 API.
- **Address lookup**: `src/utils/addressDisplay.ts` — `AddressNameLookup` (strict/loose), refactored `formatAddress`.
- **App shell**: `src/App.tsx` — `currentChainId` state + backfill effect; prop plumbing; `parsedFns` with `abiName`.
- **Decode sites**: `src/utils/rpcCaller.ts` (delete `formatResult`), `src/utils/debugTrace.ts`, `src/utils/transactionParser.ts`, `src/utils/eventQuery.ts`, `src/utils/hexParser.ts`, `src/utils/abiEncoder.ts`.
- **Shell primitives**: `src/components/layout/TxBar.tsx` — hardcode pickers; accept `rpcUrl` / `contractAddress` / `onRpcChange` / `onContractChange` / `currentChainId`.
- **Preset UI**: `src/components/preset/PresetModal.tsx`, `src/components/preset/PresetColumn.tsx`.
- **Page components**: every `*Page.tsx` to (a) accept `currentChainId` + `lookup` props, (b) swap `<pre>{JSON.stringify}</pre>` for `<DecodedValue />`, (c) swap bare address truncation for `formatAddress(lookup)`.
- **FunctionCall**: `src/components/functionCall/FunctionCallPage.tsx` — three-column layout, `AbiSelector`, grouped function list.
- **i18n**: `src/i18n/locales/{zh,en}.json` — new keys, remove stale.

---

# Phase 1 — Data Foundation

## Task 1: Type updates

**Files:**
- Modify: `src/types/index.ts`

Design: spec §1, §5.

- [ ] **Step 1: Add `ContractEntry` and rewrite `ContractPreset`**

Replace the existing `ContractPreset` block (around lines 45–51) with:

```ts
export interface ContractEntry {
  chainId?: number;      // matches RpcPreset.chainId
  address: string;       // mixed-case hex
}

export interface ContractPreset {
  id: string;
  name: string;
  description?: string;
  entries: ContractEntry[];   // length >= 1
  createdAt: number;
}
```

- [ ] **Step 2: Add `abiName` to `ParsedFunction`**

Modify the `ParsedFunction` block (around line 3):

```ts
export interface ParsedFunction {
  name: string;
  inputs: ParsedParam[];
  outputs: ParsedParam[];
  stateMutability: string;
  abiName?: string;      // source ABI preset name (filled in App.tsx)
}
```

Keep it optional — `parseAbi` doesn't populate it; `App.tsx` will decorate the output.

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: Build will fail — many call sites depend on `ContractPreset.address`. That's intentional; subsequent tasks fix them.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "types: ContractPreset v2 (entries[]) and ParsedFunction.abiName"
```

Note: build is red at this point; the next tasks close the loop. That's expected for type-first refactors.

---

## Task 2: Migration + v2 preset storage API

**Files:**
- Modify: `src/utils/presetStorage.ts`

Design: spec §1 (migration rules, API changes).

- [ ] **Step 1: Add version-marker key to `STORAGE_KEYS`**

Around lines 4–21, add:

```ts
const STORAGE_KEYS = {
  // ...existing keys
  CONTRACT_PRESET_VERSION: 'evm-caller:contract-preset-version',
};
```

- [ ] **Step 2: Add migration function `migrateContractPresets()`**

Insert near the top of the contract-preset section (after `generateId`):

```ts
type LegacyContractPreset = {
  id: string;
  name: string;
  address: string;
  description?: string;
  createdAt: number;
};

function isLegacyContractPreset(v: any): v is LegacyContractPreset {
  return v && typeof v.address === 'string' && !Array.isArray(v.entries);
}

function migrateContractPresets(): void {
  const version = localStorage.getItem(STORAGE_KEYS.CONTRACT_PRESET_VERSION);
  if (version === '2') return;

  const raw = localStorage.getItem(STORAGE_KEYS.CONTRACT_PRESETS);
  if (!raw) {
    localStorage.setItem(STORAGE_KEYS.CONTRACT_PRESET_VERSION, '2');
    return;
  }

  try {
    const records: unknown[] = JSON.parse(raw);
    if (!Array.isArray(records)) {
      localStorage.setItem(STORAGE_KEYS.CONTRACT_PRESET_VERSION, '2');
      return;
    }

    // group legacy records by name; pass through already-v2 records
    const byName = new Map<string, ContractPreset>();
    const passThrough: ContractPreset[] = [];

    for (const r of records) {
      if (isLegacyContractPreset(r)) {
        const existing = byName.get(r.name);
        if (existing) {
          existing.entries.push({ address: r.address });
        } else {
          byName.set(r.name, {
            id: r.id,
            name: r.name,
            description: r.description,
            entries: [{ address: r.address }],
            createdAt: r.createdAt,
          });
        }
      } else if (r && typeof (r as any).name === 'string' && Array.isArray((r as any).entries)) {
        passThrough.push(r as ContractPreset);
      }
    }

    const migrated = [...Array.from(byName.values()), ...passThrough];
    localStorage.setItem(STORAGE_KEYS.CONTRACT_PRESETS, JSON.stringify(migrated));
    localStorage.setItem(STORAGE_KEYS.CONTRACT_PRESET_VERSION, '2');
  } catch (error) {
    console.error('迁移 contract-presets 失败:', error);
  }
}
```

- [ ] **Step 3: Run migration from `initializeDefaultPresets`**

Locate `initializeDefaultPresets` (near the bottom of `presetStorage.ts`) and add `migrateContractPresets()` as the first line inside. This guarantees migration runs before any seed logic inspects the pool.

- [ ] **Step 4: Update `saveContractPreset` signature**

Replace the current `saveContractPreset` body (probably currently taking `(name, address, description?)`) with:

```ts
export function saveContractPreset(
  name: string,
  entries: ContractEntry[],
  description?: string,
): ContractPreset {
  const presets = loadContractPresets();
  const newPreset: ContractPreset = {
    id: generateId(),
    name,
    description,
    entries: entries.length > 0 ? entries : [{ address: '' }],
    createdAt: Date.now(),
  };
  presets.unshift(newPreset);
  localStorage.setItem(STORAGE_KEYS.CONTRACT_PRESETS, JSON.stringify(presets));
  return newPreset;
}
```

- [ ] **Step 5: Rewrite `updateContractPreset` to accept partial with `entries`**

```ts
export function updateContractPreset(
  id: string,
  updates: Partial<Pick<ContractPreset, 'name' | 'description' | 'entries'>>,
): boolean {
  const presets = loadContractPresets();
  const idx = presets.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  presets[idx] = { ...presets[idx], ...updates };
  localStorage.setItem(STORAGE_KEYS.CONTRACT_PRESETS, JSON.stringify(presets));
  return true;
}
```

- [ ] **Step 6: Add `findContractByAddress`**

Append to the contract-preset section:

```ts
export function findContractByAddress(
  address: string,
  chainId?: number,
): { preset: ContractPreset; entry: ContractEntry } | null {
  const lowered = address.toLowerCase();
  const presets = loadContractPresets();
  // prefer exact chainId match
  for (const preset of presets) {
    for (const entry of preset.entries) {
      if (entry.address.toLowerCase() !== lowered) continue;
      if (chainId != null && entry.chainId === chainId) return { preset, entry };
    }
  }
  // fallback: any match
  for (const preset of presets) {
    for (const entry of preset.entries) {
      if (entry.address.toLowerCase() === lowered) return { preset, entry };
    }
  }
  return null;
}
```

- [ ] **Step 7: Import new types**

At the top of `presetStorage.ts`, add `ContractEntry` to the existing `from '../types'` import.

- [ ] **Step 8: Commit**

```bash
git add src/utils/presetStorage.ts
git commit -m "presetStorage: v2 ContractPreset migration + entry-shaped API"
```

Build is still red — callers of `saveContractPreset`/`ContractPreset.address` need updating. Continue to Task 3.

---

## Task 3: Update `initializeDefaultPresets` seed data

**Files:**
- Modify: `src/utils/presetStorage.ts` (`initializeDefaultPresets` only)

Design: spec §6 "Default seed data".

- [ ] **Step 1: Locate `initializeDefaultPresets`**

At the end of `presetStorage.ts`. The function currently seeds default RPCs (Ethereum / BSC / Polygon) and an ERC20 ABI on first run.

- [ ] **Step 2: Ensure default RPC seeds include `chainId`**

If any default RPC lacks `chainId`, set them now:
- Ethereum mainnet: `chainId: 1`
- BSC mainnet: `chainId: 56`
- Polygon: `chainId: 137`

- [ ] **Step 3: Seed example multi-chain contract if the contract-preset pool is empty**

After the ABI seed block, if `loadContractPresets().length === 0`, add:

```ts
saveContractPreset('USDC', [
  { chainId: 1, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  { chainId: 137, address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' },
  { chainId: 42161, address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
], 'USD Coin');
```

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: still red, but `presetStorage.ts` itself is self-consistent.

- [ ] **Step 5: Commit**

```bash
git add src/utils/presetStorage.ts
git commit -m "presetStorage: seed chainId on default RPCs + USDC example"
```

---

## Task 4: `fetchChainId` utility

**Files:**
- Create: `src/utils/fetchChainId.ts`

Design: spec §2 (backfill path).

- [ ] **Step 1: Write the module**

```ts
export async function fetchChainId(
  rpcUrl: string,
  signal?: AbortSignal,
): Promise<number> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_chainId',
      params: [],
    }),
    signal,
  });
  if (!res.ok) {
    throw new Error(`eth_chainId HTTP ${res.status}`);
  }
  const json = await res.json();
  if (json.error) {
    throw new Error(json.error.message ?? 'eth_chainId failed');
  }
  return parseInt(json.result, 16);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/fetchChainId.ts
git commit -m "utils: fetchChainId (raw JSON-RPC, abortable)"
```

---

## Task 5: `currentChainId` state in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

Design: spec §2.

- [ ] **Step 1: Import fetcher + preset helpers**

Top of `App.tsx`:

```ts
import { fetchChainId } from './utils/fetchChainId';
import {
  // ...existing
  loadRpcPresets,
  updateRpcPreset,
} from './utils/presetStorage';
```

- [ ] **Step 2: Add `currentChainId` state**

Near the other `useState` calls:

```ts
const [currentChainId, setCurrentChainId] = useState<number | null>(null);
```

- [ ] **Step 3: Derive chainId from `rpcUrl`**

Add an effect:

```ts
useEffect(() => {
  const trimmed = rpcUrl.trim();
  if (!trimmed) { setCurrentChainId(null); return; }

  const presets = loadRpcPresets();
  const preset = presets.find((p) => p.rpcUrl === trimmed);
  if (preset?.chainId) { setCurrentChainId(preset.chainId); return; }

  if (!preset) { setCurrentChainId(null); return; }

  const controller = new AbortController();
  fetchChainId(trimmed, controller.signal)
    .then((cid) => {
      if (controller.signal.aborted) return;
      updateRpcPreset(preset.id, { chainId: cid });
      setCurrentChainId(cid);
    })
    .catch(() => { /* silent: leaves null */ });
  return () => controller.abort();
}, [rpcUrl, presetRefreshTrigger]);
```

(Adding `presetRefreshTrigger` to the dep array covers the case where the user creates the RPC preset after typing its URL — the refresh will re-run the effect.)

- [ ] **Step 4: Thread `currentChainId` into every page prop bag**

Pass `currentChainId={currentChainId}` to each `<*Page />` render (FunctionCall, TransactionParser, DebugTrace, HexParser, EventQuery, AbiEncoder, StateOverride, SlotCalc). The page-side prop plumbing happens in Phase 2/3 when those pages actually use it — for now pages can accept and ignore.

For now, just pass it. Later tasks consume.

- [ ] **Step 5: Run build**

Run: `npm run build`
Expected: might fail if any page's props type forbids extra — that's fine; add optional `currentChainId?: number | null` to each page's `Props` interface in its own component file. If time-pressed, skip this step and fold into Phase 2/3 page changes.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/*.tsx src/components/**/*.tsx
git commit -m "App: currentChainId state + eth_chainId backfill wiring"
```

---

## Task 6: `AddressNameLookup` — refactor `addressDisplay.ts`

**Files:**
- Modify: `src/utils/addressDisplay.ts`

Design: spec §2 "Address name lookup" (exact code block in spec).

- [ ] **Step 1: Replace the module body**

Keep `CALL_TYPE_STYLE` and `REVERT_STYLE` exports untouched. Replace the name-map portion:

```ts
import { ContractPreset } from '../types';

export interface AddressNameLookup {
  strict: Map<string, string>;
  loose: Map<string, string>;
}

export function buildAddressNameLookup(
  contracts: ContractPreset[],
  currentChainId: number | null,
): AddressNameLookup {
  const strict = new Map<string, string>();
  const loose = new Map<string, string>();
  for (const c of contracts) {
    for (const e of c.entries) {
      if (!e.address) continue;
      const key = e.address.toLowerCase();
      if (currentChainId != null && e.chainId === currentChainId) {
        strict.set(key, c.name);
      } else if (e.chainId == null || currentChainId == null) {
        if (!loose.has(key)) loose.set(key, c.name);
      }
    }
  }
  return { strict, loose };
}

export function formatAddress(
  addr: string | null | undefined,
  lookup: AddressNameLookup,
  showNames: boolean,
  opts?: { allowLoose?: boolean },
): string {
  if (!addr) return '';
  if (!showNames) return truncate(addr);
  const key = addr.toLowerCase();
  const strict = lookup.strict.get(key);
  if (strict) return strict;
  if (opts?.allowLoose !== false) {
    const loose = lookup.loose.get(key);
    if (loose) return `${loose}?`;
  }
  return truncate(addr);
}

function truncate(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
```

- [ ] **Step 2: Remove the old `AddressNameMap` / `buildAddressNameMap` exports**

They are replaced by the lookup pair. Search for usage:

Run: `grep -rn 'AddressNameMap\|buildAddressNameMap' src/`

- [ ] **Step 3: Update callers one by one**

Every file returned in Step 2 needs changing:

- Import `AddressNameLookup` instead of `AddressNameMap`.
- Replace `buildAddressNameMap(contracts)` with `buildAddressNameLookup(contracts, currentChainId)`.
- Replace `formatAddress(addr, nameMap, showNames)` with `formatAddress(addr, lookup, showNames)` (same arity; now takes the lookup object).

Key callers (current code):
- `src/components/DebugTracePage.tsx` — currently builds `addressNameMap`; change to `addressNameLookup` built from `loadContractPresets()` + `currentChainId`.
- `src/components/debugTrace/CallTreeRow.tsx` — prop type rename.
- `src/components/debugTrace/NodeCard.tsx` — prop type rename.
- `src/components/debugTrace/NodeStack.tsx` — prop type rename + `buildCrumb(...)` signature.
- Any other file surfaced by grep.

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: PASS (green) after all call-site renames land.

- [ ] **Step 5: Smoke check**

Run: `npm run dev`
Open Debug Trace, load a known tx that contains addresses matching an installed preset — expected:
- Preset address on the current chain: renders as its preset name (strict).
- Preset address stored without chainId: renders as `name?` (loose).

- [ ] **Step 6: Commit**

```bash
git add src/utils/addressDisplay.ts src/components
git commit -m "addressDisplay: AddressNameLookup (strict/loose) + chain-aware formatAddress"
```

---

## Task 7: PresetModal — multi-entry contract editor

**Files:**
- Modify: `src/components/preset/PresetModal.tsx`
- Modify: `src/components/preset/PresetColumn.tsx` (if contract-specific UI leaks in)

Design: spec §6 "PresetModal contract editor".

- [ ] **Step 1: Read the current PresetColumn contract card UI**

Run: `grep -n 'contract' src/components/preset/PresetColumn.tsx` and `grep -n 'contract' src/components/preset/PresetModal.tsx` to locate the contract-specific rendering.

- [ ] **Step 2: Rewrite the contract card editor**

The contract column likely uses `PresetColumn` generically. Contract cards need a dedicated editor because their shape is different from RPC/ABI. Extract contract cards into `ContractPresetCard.tsx` (new file inside `src/components/preset/`). Each card shows:

```tsx
<div className="space-y-2 rounded-sm border border-line bg-surface p-3">
  <div className="flex items-center gap-2">
    <input
      value={name}
      onChange={(e) => setName(e.target.value)}
      placeholder={t('contractPreset.namePlaceholder')}
      className="flex-1 rounded-sm border border-line bg-bg px-2 py-1 font-mono text-[11px] text-fg focus:border-mint focus:outline-none"
    />
    <button onClick={onDelete} className="rounded-sm px-2 text-[11px] text-fg-dim hover:bg-surface-2 hover:text-call-red">×</button>
  </div>

  <div className="space-y-1.5 font-mono text-[11px]">
    {entries.map((entry, i) => (
      <div key={i} className="flex items-center gap-1.5">
        <input
          value={entry.chainId ?? ''}
          onChange={(e) => setEntry(i, { ...entry, chainId: e.target.value ? Number(e.target.value) : undefined })}
          placeholder="chainId"
          className="w-[84px] rounded-sm border border-line bg-bg px-2 py-1 text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
        />
        <input
          value={entry.address}
          onChange={(e) => setEntry(i, { ...entry, address: e.target.value })}
          placeholder="0x..."
          className="flex-1 rounded-sm border border-line bg-bg px-2 py-1 text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
        />
        {entries.length > 1 && (
          <button onClick={() => removeEntry(i)} className="rounded-sm px-1.5 text-fg-dim hover:bg-surface-2 hover:text-call-red">×</button>
        )}
      </div>
    ))}
    <button
      onClick={addEntry}
      className="rounded-sm border border-line px-2 py-1 text-[10px] text-fg-dim hover:bg-surface-2 hover:text-fg"
    >
      + {t('contractPreset.addEntry')}
    </button>
  </div>

  <input
    value={description ?? ''}
    onChange={(e) => setDescription(e.target.value)}
    placeholder={t('presetModal.descriptionPlaceholder')}
    className="w-full rounded-sm border border-line bg-bg px-2 py-1 font-mono text-[11px] text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
  />

  <div className="flex gap-2">
    <button
      onClick={() => onSave({ name, description, entries })}
      disabled={!name.trim() || entries.every((e) => !e.address.trim())}
      className="rounded-sm bg-mint px-3 py-1 font-mono text-[10px] font-semibold text-bg hover:bg-mint/80 disabled:bg-line disabled:text-fg-mute"
    >
      {t('presetModal.save')}
    </button>
  </div>
</div>
```

The new "create" card at the top of the column starts with `entries: [{ address: '' }]` and calls `saveContractPreset(name, entries, description)` on save.

- [ ] **Step 3: Wire into `PresetModal` contract column**

In `PresetModal.tsx`, replace the generic `PresetColumn` rendering for contracts with a bespoke column that uses `ContractPresetCard`. Keep `PresetColumn` for RPC + ABI columns.

Contract column header and empty state reuse existing strings.

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Smoke check**

Run: `npm run dev`, open Presets → Contracts column:
- Existing presets show their entries (after migration).
- Create a new preset with two entries on different chainIds — saves and persists after reload.
- Edit an existing preset: add/remove entry rows — saves and reloads correctly.

- [ ] **Step 6: Add i18n keys**

Add to `src/i18n/locales/zh.json` and `src/i18n/locales/en.json` under a new `contractPreset` section:

```jsonc
// zh
"contractPreset": {
  "namePlaceholder": "名称（如 USDC）",
  "addEntry": "添加地址"
}
// en
"contractPreset": {
  "namePlaceholder": "Name (e.g. USDC)",
  "addEntry": "add address"
}
```

Also add `presetModal.descriptionPlaceholder` (`备注` / `Description`) if not already present.

- [ ] **Step 7: Commit**

```bash
git add src/components/preset src/i18n/locales
git commit -m "preset: multi-entry contract editor + i18n for chain/address rows"
```

---

# Phase 2 — Decoded Display Unification

## Task 8: `toDisplay` utility

**Files:**
- Create: `src/utils/decodedFormat.ts`

Design: spec §3 (exact code block).

- [ ] **Step 1: Write the module**

```ts
import type { ParsedParam } from '../types';

export type DisplayValue =
  | string | number | boolean | null
  | DisplayValue[]
  | { [key: string]: DisplayValue };

export function toDisplay(
  value: unknown,
  param?: ParsedParam | ParsedParam[],
): DisplayValue {
  if (Array.isArray(param)) {
    return param.map((p, i) => toDisplay((value as any)?.[p.name ?? i] ?? (value as any)?.[i], p));
  }

  if (typeof value === 'bigint') return value.toString();
  if (value == null || typeof value !== 'object') return value as DisplayValue;

  const components = param?.components;
  const isResult = typeof (value as any).toArray === 'function';
  const allNamed = !!components && components.length > 0 && components.every((c) => !!c.name);

  if (isResult && allNamed) {
    const out: Record<string, DisplayValue> = {};
    for (const c of components!) {
      out[c.name!] = toDisplay((value as any)[c.name!], c);
    }
    return out;
  }

  if (Array.isArray(value)) {
    const elemParam: ParsedParam | undefined = param && param.type?.endsWith('[]')
      ? { ...param, type: param.type.slice(0, -2) }
      : undefined;
    return (value as any[]).map((v) => toDisplay(v, elemParam));
  }

  const out: Record<string, DisplayValue> = {};
  for (const k of Object.keys(value as any)) {
    if (!isNaN(Number(k))) continue;
    out[k] = toDisplay((value as any)[k]);
  }
  return out;
}
```

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: PASS (module is standalone).

- [ ] **Step 3: Commit**

```bash
git add src/utils/decodedFormat.ts
git commit -m "utils: toDisplay — tuple→object with ABI param walking"
```

---

## Task 9: Wire `toDisplay` + delete `rpcCaller.formatResult`

**Files:**
- Modify: `src/utils/rpcCaller.ts`
- Modify: `src/App.tsx`

Design: spec §3 (Integration points).

- [ ] **Step 1: In `rpcCaller.ts`, remove `formatResult` and the call site inside `callViewFunction`**

Delete the function definition (lines ~126–199) and the call `const formattedResult = formatResult(result, outputs);`. `callViewFunction` should return `{ success: true, data: result }` — raw ethers result.

- [ ] **Step 2: In `App.handleFunctionCall`, transform result via `toDisplay`**

Import `toDisplay` and the function's `outputs`:

```ts
import { toDisplay } from './utils/decodedFormat';
```

Change `setCallHistory(... { result })` to use the transformed data:

```ts
const formatted = result.success
  ? { success: true, data: toDisplay(result.data, func.outputs) }
  : result;

setCallHistory((prev) => [
  {
    // ...existing
    result: formatted,
  },
  ...prev,
]);
```

- [ ] **Step 3: Remove unused imports in `rpcCaller.ts`**

Run: `npm run build` — fail will show unused `ParsedParam` in rpcCaller. Delete the import if no longer used.

- [ ] **Step 4: Smoke check**

Run: `npm run dev`, call a view function whose return is a named struct (e.g. Uniswap V3 Pool `slot0` returning `(sqrtPriceX96, tick, observationIndex, ...)`).
Expected: history card result shows as an object with named keys, not an array.

- [ ] **Step 5: Commit**

```bash
git add src/utils/rpcCaller.ts src/App.tsx
git commit -m "rpcCaller: drop bespoke formatResult; App uses toDisplay(func.outputs)"
```

---

## Task 10: Wire `toDisplay` into other decode utilities

**Files:**
- Modify: `src/utils/debugTrace.ts`
- Modify: `src/utils/transactionParser.ts`
- Modify: `src/utils/eventQuery.ts`
- Modify: `src/utils/hexParser.ts`
- Modify: `src/utils/abiEncoder.ts`

Design: spec §3.

- [ ] **Step 1: `debugTrace.parseTraceWithAbi`**

Find where `decodedInput.args` is assigned. Before storing, pass through `toDisplay`:

```ts
import { toDisplay } from './decodedFormat';

// ... inside parseTraceWithAbi:
if (fragment) {
  const args = iface.decodeFunctionData(fragment, input);
  decodedInput = {
    functionName: fragment.name,
    signature: fragment.format(),
    args: toDisplay(args, fragment.inputs as any),
  };
}
```

`fragment.inputs` is ethers' `ParamType[]`; cast to `ParsedParam[]` because they share the `name`/`type`/`components` shape we use. If the cast feels wrong, convert explicitly: `fragment.inputs.map(p => ({ name: p.name, type: p.type, components: p.components ? ... }))`.

Do the same for `decodedOutput` (based on `fragment.outputs`) and `decodedError.args` (based on the error fragment's inputs).

- [ ] **Step 2: `transactionParser.ts`**

Identify where `decodedInput.args` is built. Apply the same pattern as Step 1.
Also apply to decoded log args (event fragment inputs).

- [ ] **Step 3: `eventQuery.ts`**

For each decoded event, replace the raw `args` with `toDisplay(rawArgs, eventFragment.inputs)`.

- [ ] **Step 4: `hexParser.ts`**

The decode paths (`function`/`event`/`error`) each produce args. Pipe them through `toDisplay` with the matching fragment inputs.

- [ ] **Step 5: `abiEncoder.ts`**

In the decode path, after `abiCoder.decode(types, hex)`, call `toDisplay(decoded)` (no `param` arg — types are raw strings, so no components; the purpose here is bigint stringification and array handling consistency).

- [ ] **Step 6: Run build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 7: Smoke check**

Run: `npm run dev`, open Transaction Parser with a tx whose decoded input has nested structs — verify the logs expanded view shows objects, not arrays.

- [ ] **Step 8: Commit**

```bash
git add src/utils/{debugTrace,transactionParser,eventQuery,hexParser,abiEncoder}.ts
git commit -m "decoders: route decoded args through toDisplay for uniform tuple→object"
```

---

## Task 11: `<AddressBadge />` component

**Files:**
- Create: `src/components/common/AddressBadge.tsx`

Design: spec §3 "`<AddressBadge />`".

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';
import { AddressNameLookup, formatAddress } from '../../utils/addressDisplay';

interface Props {
  addr: string;
  lookup: AddressNameLookup;
  showNames: boolean;
  className?: string;
}

const AddressBadge: React.FC<Props> = ({ addr, lookup, showNames, className }) => {
  const label = formatAddress(addr, lookup, showNames);
  const isLoose = label.endsWith('?');
  const tone = isLoose ? 'text-fg-dim' : 'text-fg';
  return (
    <span
      title={addr}
      className={`font-mono ${tone} ${className ?? ''}`}
    >
      {label}
    </span>
  );
};

export default AddressBadge;
```

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/common/AddressBadge.tsx
git commit -m "component: AddressBadge (renders formatAddress with loose-match tone)"
```

---

## Task 12: `<DecodedValue />` component

**Files:**
- Create: `src/components/common/DecodedValue.tsx`

Design: spec §3 "UI: `<DecodedValue />`".

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';
import { DisplayValue } from '../../utils/decodedFormat';
import { AddressNameLookup } from '../../utils/addressDisplay';
import AddressBadge from './AddressBadge';

interface Props {
  value: DisplayValue;
  lookup: AddressNameLookup;
  showNames: boolean;
  variant?: 'block' | 'compact';
  depth?: number;
}

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

const DecodedValue: React.FC<Props> = ({ value, lookup, showNames, variant = 'block', depth = 0 }) => {
  if (value == null) {
    return <span className="text-fg-dim">null</span>;
  }
  if (typeof value === 'string') {
    if (ADDR_RE.test(value)) {
      return <AddressBadge addr={value} lookup={lookup} showNames={showNames} />;
    }
    return <span className="font-mono text-fg">{value}</span>;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return <span className="font-mono text-fg">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (variant === 'compact') {
      return (
        <span className="font-mono text-fg">
          [
          {value.map((v, i) => (
            <React.Fragment key={i}>
              {i > 0 && ', '}
              <DecodedValue value={v} lookup={lookup} showNames={showNames} variant="compact" depth={depth + 1} />
            </React.Fragment>
          ))}
          ]
        </span>
      );
    }
    return (
      <div className="font-mono">
        {value.length === 0 ? (
          <span className="text-fg-dim">[]</span>
        ) : (
          value.map((v, i) => (
            <div key={i} className="flex gap-1.5">
              <span className="text-fg-mute">{i}:</span>
              <div className="flex-1 min-w-0">
                <DecodedValue value={v} lookup={lookup} showNames={showNames} depth={depth + 1} />
              </div>
            </div>
          ))
        )}
      </div>
    );
  }
  // object
  const keys = Object.keys(value);
  if (variant === 'compact') {
    return (
      <span className="font-mono text-fg">
        {'{'}
        {keys.map((k, i) => (
          <React.Fragment key={k}>
            {i > 0 && ', '}
            <span className="text-fg-dim">{k}:</span>{' '}
            <DecodedValue value={(value as any)[k]} lookup={lookup} showNames={showNames} variant="compact" depth={depth + 1} />
          </React.Fragment>
        ))}
        {'}'}
      </span>
    );
  }
  return (
    <div className="font-mono">
      {keys.length === 0 ? (
        <span className="text-fg-dim">{'{}'}</span>
      ) : (
        keys.map((k) => (
          <div key={k} className="flex gap-1.5">
            <span className="text-fg-dim">{k}:</span>
            <div className="flex-1 min-w-0">
              <DecodedValue value={(value as any)[k]} lookup={lookup} showNames={showNames} depth={depth + 1} />
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default DecodedValue;
```

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/common/DecodedValue.tsx
git commit -m "component: DecodedValue (recursive JS-value renderer, inlines AddressBadge)"
```

---

## Task 13: Replace `<pre>{JSON.stringify}</pre>` sites with `<DecodedValue />`

**Files:**
- Modify: `src/components/functionCall/FunctionCallPage.tsx`
- Modify: `src/components/TransactionParserPage.tsx`
- Modify: `src/components/HexParserPage.tsx`
- Modify: `src/components/EventQueryPage.tsx`
- Modify: `src/components/AbiEncoderPage.tsx`
- Modify: `src/components/debugTrace/NodeCard.tsx`

Design: spec §3 "UI: `<DecodedValue />`".

- [ ] **Step 1: Thread `currentChainId` + `lookup` props to each page**

Each page needs:
- `currentChainId: number | null` prop (already passed from App in Task 5).
- Build lookup inside the page via `buildAddressNameLookup(loadContractPresets(), currentChainId)` (cheap; recompute on render is fine, or memoize). Pass `showAddressNames` too.

Concretely, in each page:

```tsx
const contracts = useMemo(() => loadContractPresets(), [presetRefreshTrigger]);
const lookup = useMemo(
  () => buildAddressNameLookup(contracts, currentChainId),
  [contracts, currentChainId],
);
```

Add `presetRefreshTrigger: number` + `showAddressNames: boolean` to any page that doesn't already have them.

- [ ] **Step 2: `FunctionCallPage` — replace history result/args pre blocks**

Find the `<pre className="... mb-3 whitespace-pre-wrap ...">{stringifySafe(item.args)}</pre>` and `{stringifySafe(item.result.data)}` blocks. Replace each with:

```tsx
<div className="mb-3 rounded-sm border border-line-soft bg-bg px-2.5 py-2 text-[10.5px] leading-[1.6]">
  <DecodedValue value={item.args} lookup={lookup} showNames={showAddressNames} />
</div>
```

and similarly for the result. The error branch stays as-is.

Remove the now-unused `stringifySafe` helper if nothing else references it.

- [ ] **Step 3: Repeat in `TransactionParserPage`** (decoded input + log args)

- [ ] **Step 4: Repeat in `EventQueryPage`** (decoded args in expanded row)

- [ ] **Step 5: Repeat in `HexParserPage`** (decoded args in history card)

- [ ] **Step 6: Repeat in `AbiEncoderPage`** (decode output)

- [ ] **Step 7: Repeat in `NodeCard`** (decodedInput.args, decodedOutput, decodedError.args)

- [ ] **Step 8: Run build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 9: Smoke check every tab**

Run: `npm run dev`:
- FunctionCall: call a view fn, result renders as `<DecodedValue />` tree.
- DebugTrace: trace shows decoded args as indented object keys; address fields render as names when they match a preset.
- TransactionParser / HexParser / EventQuery / AbiEncoder: decoded results all come through the new renderer.

- [ ] **Step 10: Commit**

```bash
git add src/components
git commit -m "pages: render decoded values via DecodedValue (+AddressBadge inline)"
```

---

## Task 14: Update bare-address renderers

**Files:**
- Modify: `src/components/debugTrace/CallTreeRow.tsx`
- Modify: `src/components/debugTrace/NodeCard.tsx` (non-decoded from/to already uses formatAddress — verify)
- Modify: `src/components/debugTrace/NodeStack.tsx` (`buildCrumb`)
- Modify: `src/components/TransactionParserPage.tsx` (tx from/to, log.address)
- Modify: `src/components/EventQueryPage.tsx` (row address column)
- Modify: `src/components/stateOverride/StateOverridePage.tsx` (account list, from, target contract)
- Modify: `src/components/layout/TxBar.tsx` (address kickers)

Design: spec §2 "Application points".

- [ ] **Step 1: In each file listed above**

- Add `lookup: AddressNameLookup` prop where missing. Drop old `addressNameMap: AddressNameMap` prop.
- Pass `lookup` from each page (built via `buildAddressNameLookup`) into children.
- Bare address rendering switches to: `<AddressBadge addr={addr} lookup={lookup} showNames={showAddressNames} />` OR `formatAddress(addr, lookup, showNames)` for plain-text contexts (e.g. TxBar kicker values).

Note that many of these were already changed in Task 6; Step 1 is a sweep to ensure every remaining caller migrates.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Smoke check**

Run: `npm run dev`, flip `@names` toggle on/off:
- Every tab that shows an address responds consistently.
- Loose matches render dimmed with trailing `?`.

- [ ] **Step 4: Commit**

```bash
git add src/components
git commit -m "components: unified AddressBadge / formatAddress across all tabs"
```

---

# Phase 3 — Pickers + FunctionCall UX

## Task 15: `<RpcPicker />` component

**Files:**
- Create: `src/components/common/RpcPicker.tsx`

Design: spec §4 "`<RpcPicker />`".

- [ ] **Step 1: Write the component**

```tsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { loadRpcPresets } from '../../utils/presetStorage';
import { RpcPreset } from '../../types';

interface Props {
  value: string;
  onChange: (rpcUrl: string, preset?: RpcPreset) => void;
  placeholder?: string;
  width?: string;
  refreshToken?: number;
}

function chainLabel(chainId?: number): string {
  if (chainId == null) return '';
  const known: Record<number, string> = {
    1: 'ETH', 10: 'OP', 56: 'BSC', 137: 'POL', 8453: 'BASE', 42161: 'ARB',
    43114: 'AVAX', 11155111: 'SEP',
  };
  return known[chainId] ?? String(chainId);
}

const RpcPicker: React.FC<Props> = ({ value, onChange, placeholder, width, refreshToken }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const presets = useMemo(() => loadRpcPresets(), [refreshToken]);
  const q = value.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return presets;
    return presets.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.rpcUrl.toLowerCase().includes(q) ||
      String(p.chainId ?? '').includes(q),
    );
  }, [presets, q]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const pick = (p: RpcPreset) => {
    onChange(p.rpcUrl, p);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative" style={{ width }}>
      <input
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActiveIdx(0); }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, filtered.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
          else if (e.key === 'Enter' && filtered[activeIdx]) { e.preventDefault(); pick(filtered[activeIdx]); }
          else if (e.key === 'Escape') setOpen(false);
        }}
        placeholder={placeholder ?? 'https://...'}
        className="w-full rounded-sm border border-line bg-bg px-2 py-1 font-mono text-[11px] text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute left-0 right-0 z-40 mt-0.5 max-h-60 overflow-y-auto rounded-sm border border-line bg-surface font-mono text-[11px] shadow-lg">
          {filtered.map((p, i) => (
            <li
              key={p.id}
              onMouseDown={(e) => { e.preventDefault(); pick(p); }}
              onMouseEnter={() => setActiveIdx(i)}
              className={
                'flex cursor-pointer items-center gap-2 px-2.5 py-1.5 ' +
                (i === activeIdx ? 'bg-surface-2' : '')
              }
            >
              {p.chainId != null && (
                <span className="rounded-xs bg-mint/15 px-1.5 text-[9px] font-bold text-mint">{chainLabel(p.chainId)}</span>
              )}
              <span className="text-fg">{p.name}</span>
              <span className="ml-auto truncate text-fg-dim">{p.rpcUrl}</span>
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && (
        <div className="absolute left-0 right-0 z-40 mt-0.5 rounded-sm border border-line bg-surface px-2.5 py-1.5 font-mono text-[11px] text-fg-dim">
          {t('picker.noMatch')}
        </div>
      )}
    </div>
  );
};

export default RpcPicker;
```

- [ ] **Step 2: Add i18n keys**

Add `picker.noMatch` to both locales: `没有匹配的预设` / `No matching preset`.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/common/RpcPicker.tsx src/i18n/locales
git commit -m "component: RpcPicker (combobox with free-text + preset search)"
```

---

## Task 16: `<ContractPicker />` component

**Files:**
- Create: `src/components/common/ContractPicker.tsx`

Design: spec §4 "`<ContractPicker />`".

- [ ] **Step 1: Write the component**

Structure mirrors `RpcPicker` but with:

- Flatten presets into rows of `{ presetName, entry }` pairs; filter by `currentChainId` by default, toggleable via a "show all chains" checkbox at the top of the dropdown.
- Search matches `preset.name` and `entry.address`.
- `onChange(address, preset?, entry?)`.

Full implementation:

```tsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { loadContractPresets } from '../../utils/presetStorage';
import { ContractPreset, ContractEntry } from '../../types';

interface Props {
  value: string;
  onChange: (address: string, preset?: ContractPreset, entry?: ContractEntry) => void;
  currentChainId: number | null;
  placeholder?: string;
  width?: string;
  refreshToken?: number;
}

interface Row { preset: ContractPreset; entry: ContractEntry }

function chainLabel(chainId?: number): string {
  if (chainId == null) return '';
  const known: Record<number, string> = {
    1: 'ETH', 10: 'OP', 56: 'BSC', 137: 'POL', 8453: 'BASE', 42161: 'ARB',
    43114: 'AVAX', 11155111: 'SEP',
  };
  return known[chainId] ?? String(chainId);
}

const ContractPicker: React.FC<Props> = ({
  value, onChange, currentChainId, placeholder, width, refreshToken,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [showAllChains, setShowAllChains] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const presets = useMemo(() => loadContractPresets(), [refreshToken]);
  const q = value.trim().toLowerCase();

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const p of presets) {
      for (const e of p.entries) {
        const chainVisible = showAllChains
          || currentChainId == null
          || e.chainId == null
          || e.chainId === currentChainId;
        if (!chainVisible) continue;
        if (q) {
          const hit = p.name.toLowerCase().includes(q) || e.address.toLowerCase().includes(q);
          if (!hit) continue;
        }
        out.push({ preset: p, entry: e });
      }
    }
    return out;
  }, [presets, q, currentChainId, showAllChains]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const pick = (r: Row) => {
    onChange(r.entry.address, r.preset, r.entry);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative" style={{ width }}>
      <input
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActiveIdx(0); }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, rows.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
          else if (e.key === 'Enter' && rows[activeIdx]) { e.preventDefault(); pick(rows[activeIdx]); }
          else if (e.key === 'Escape') setOpen(false);
        }}
        placeholder={placeholder ?? '0x...'}
        className="w-full rounded-sm border border-line bg-bg px-2 py-1 font-mono text-[11px] text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
      />
      {open && (
        <div className="absolute left-0 right-0 z-40 mt-0.5 rounded-sm border border-line bg-surface font-mono text-[11px] shadow-lg">
          {currentChainId != null && (
            <label className="flex cursor-pointer items-center gap-1.5 border-b border-line-soft px-2.5 py-1 text-[10px] text-fg-dim">
              <input
                type="checkbox"
                checked={showAllChains}
                onChange={(e) => setShowAllChains(e.target.checked)}
              />
              {t('picker.showAllChains')}
            </label>
          )}
          {rows.length === 0 ? (
            <div className="px-2.5 py-1.5 text-fg-dim">{t('picker.noMatch')}</div>
          ) : (
            <ul className="max-h-60 overflow-y-auto">
              {rows.map((r, i) => (
                <li
                  key={`${r.preset.id}:${r.entry.address}`}
                  onMouseDown={(e) => { e.preventDefault(); pick(r); }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={
                    'flex cursor-pointer items-center gap-2 px-2.5 py-1.5 ' +
                    (i === activeIdx ? 'bg-surface-2' : '')
                  }
                >
                  {r.entry.chainId != null && (
                    <span className="rounded-xs bg-mint/15 px-1.5 text-[9px] font-bold text-mint">{chainLabel(r.entry.chainId)}</span>
                  )}
                  <span className="text-fg">{r.preset.name}</span>
                  <span className="ml-auto truncate text-fg-dim">{r.entry.address}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default ContractPicker;
```

- [ ] **Step 2: Add i18n `picker.showAllChains`**

zh: `显示所有链` / en: `show all chains`.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/common/ContractPicker.tsx src/i18n/locales
git commit -m "component: ContractPicker (chain-filtered combobox over entries)"
```

---

## Task 17: `TxBar` — hardcode pickers

**Files:**
- Modify: `src/components/layout/TxBar.tsx`
- Modify: all 5 tab pages that currently pass `items` into `TxBar` (`TransactionParserPage`, `DebugTracePage`, `EventQueryPage`, `StateOverridePage`, `SlotCalcPage` where applicable).

Design: spec §4 "Placement".

- [ ] **Step 1: Rewrite `TxBar` props**

Replace the current `items` / `actions` structure with an explicit API:

```tsx
interface TxBarProps {
  rpcUrl: string;
  onRpcChange: (rpcUrl: string, preset?: RpcPreset) => void;
  contractAddress?: string;
  onContractChange?: (addr: string, preset?: ContractPreset, entry?: ContractEntry) => void;
  currentChainId: number | null;
  extra?: Array<{ kicker: string; value: React.ReactNode }>;   // right-side items like "tx", "block"
  actions?: React.ReactNode;
  refreshToken?: number;
}
```

Inside:

```tsx
<div className="flex items-center gap-3 border-b border-line bg-bg px-5 py-2.5 font-mono text-[11px]">
  <span className="text-[10px] uppercase tracking-[0.2em] text-fg-mute">rpc</span>
  <RpcPicker value={rpcUrl} onChange={onRpcChange} refreshToken={refreshToken} width="240px" />
  {onContractChange && (
    <>
      <span className="text-line">/</span>
      <span className="text-[10px] uppercase tracking-[0.2em] text-fg-mute">contract</span>
      <ContractPicker
        value={contractAddress ?? ''}
        onChange={onContractChange}
        currentChainId={currentChainId}
        refreshToken={refreshToken}
        width="360px"
      />
    </>
  )}
  {extra?.map((it) => (
    <React.Fragment key={it.kicker}>
      <span className="text-line">/</span>
      <span className="text-[10px] uppercase tracking-[0.2em] text-fg-mute">{it.kicker}</span>
      {it.value}
    </React.Fragment>
  ))}
  <div className="ml-auto flex items-center gap-2">{actions}</div>
</div>
```

- [ ] **Step 2: Update each tab's `TxBar` usage**

Each page that used `items={[{kicker, value}, ...]}` now passes `rpcUrl` + `onRpcChange` + (optionally) `contractAddress` + `onContractChange` + `currentChainId` + `extra` for the extra kickers (tx hash, block range, etc.).

Do this per-file; a typical change:

```tsx
// before
<TxBar
  items={[
    { kicker: 'rpc', value: <input ... /> },
    { kicker: 'contract', value: <input ... /> },
    { kicker: 'tx', value: <input ... /> },
  ]}
  actions={<button>fetch</button>}
/>

// after
<TxBar
  rpcUrl={rpcUrl}
  onRpcChange={setRpcUrl}
  contractAddress={contractAddress}
  onContractChange={setContractAddress}
  currentChainId={currentChainId}
  extra={[{ kicker: 'tx', value: <input ... /> }]}
  actions={<button>fetch</button>}
  refreshToken={presetRefreshTrigger}
/>
```

- [ ] **Step 3: Delete the old inline contract/rpc `<input>` fields from each page**

Any page that had its own `<input value={rpcUrl} ...>` for the RPC / contract rows now drops those — the picker owns them.

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Smoke check**

Run: `npm run dev`, open every tab with a TxBar:
- Focus RPC input → preset dropdown appears → click one → value applied, chainId inferred, ContractPicker filters to that chain.
- Free-type a URL → accepted, chainId null.
- Toggle `show all chains` in contract picker → full list.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/TxBar.tsx src/components/*.tsx src/components/**/*.tsx
git commit -m "TxBar: hardcode RpcPicker + ContractPicker; migrate all tabs"
```

---

## Task 18: FunctionCall — replace inline bar with `TxBar`

**Files:**
- Modify: `src/components/functionCall/FunctionCallPage.tsx`
- Modify: `src/App.tsx` (prop pass-through)

Design: spec §5 "FunctionCall's handwritten input bar is replaced with `<TxBar />`".

- [ ] **Step 1: Rip out the handwritten input bar**

In `FunctionCallPage.tsx`, delete the block (lines ~145–180 in the current file) that manually renders `rpc`/`contract`/`block`/`abis` inputs + presets button.

- [ ] **Step 2: Render `<TxBar />` instead**

```tsx
<TxBar
  rpcUrl={rpcUrl}
  onRpcChange={onRpcUrlChange}
  contractAddress={contractAddress}
  onContractChange={onContractAddressChange}
  currentChainId={currentChainId}
  extra={[
    { kicker: 'block', value: <input value={blockTag} onChange={(e) => onBlockTagChange(e.target.value)} placeholder="latest" className="w-[92px] rounded-sm border border-line bg-bg px-2 py-1 text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none" /> },
    { kicker: 'abis', value: <span className="text-mint">{selectedAbiNames.length}</span> },
  ]}
  actions={<button onClick={onPresetsClick} className="rounded-sm border border-line bg-surface px-2.5 py-1 text-[10px] text-fg-dim hover:bg-surface-2 hover:text-fg">{t('topnav.presets')}</button>}
  refreshToken={presetRefreshTrigger}
/>
```

- [ ] **Step 3: Accept `currentChainId` + `presetRefreshTrigger` props**

Update `FunctionCallPageProps` to include both. Thread them from `App.tsx`.

- [ ] **Step 4: Make `onContractAddressChange` tolerate the new 3-arg signature**

`ContractPicker.onChange(address, preset?, entry?)` — only the first arg is used here; existing `onContractAddressChange: (v: string) => void` works if we destructure in the parent. Update signature if TS complains:

```tsx
onContractChange={(addr) => onContractAddressChange(addr)}
```

- [ ] **Step 5: Run build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Smoke check**

Run: `npm run dev`, on the Function Call tab:
- RPC/contract pickers work.
- Block & abis kickers render as before.
- Presets button still opens modal.

- [ ] **Step 7: Commit**

```bash
git add src/components/functionCall/FunctionCallPage.tsx src/App.tsx
git commit -m "FunctionCall: adopt shared TxBar with RpcPicker + ContractPicker"
```

---

## Task 19: `<AbiSelector />` component

**Files:**
- Create: `src/components/common/AbiSelector.tsx`

Design: spec §5 "Left ABI column".

- [ ] **Step 1: Write the component**

```tsx
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AbiPreset } from '../../types';
import { loadAbiPresets } from '../../utils/presetStorage';

interface Props {
  selectedAbis: string[];        // JSON strings, same format as App's selectedAbis
  selectedAbiNames: string[];
  onChange: (abis: string[], names: string[]) => void;
  onOpenPresets: () => void;
  refreshToken?: number;
}

const AbiSelector: React.FC<Props> = ({
  selectedAbis, selectedAbiNames, onChange, onOpenPresets, refreshToken,
}) => {
  const { t } = useTranslation();
  const presets = useMemo<AbiPreset[]>(() => loadAbiPresets(), [refreshToken]);

  const selectedSet = useMemo(() => new Set(selectedAbiNames), [selectedAbiNames]);

  const toggle = (p: AbiPreset) => {
    const wasSelected = selectedSet.has(p.name);
    if (wasSelected) {
      const keepIdx = selectedAbiNames.map((n, i) => (n === p.name ? -1 : i)).filter((i) => i >= 0);
      onChange(keepIdx.map((i) => selectedAbis[i]), keepIdx.map((i) => selectedAbiNames[i]));
    } else {
      onChange([...selectedAbis, p.abi], [...selectedAbiNames, p.name]);
    }
  };

  const selectAll = () => {
    onChange(presets.map((p) => p.abi), presets.map((p) => p.name));
  };

  const clear = () => onChange([], []);

  return (
    <div className="flex min-h-0 flex-col border-r border-line">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2 font-mono text-[10px]">
        <span className="uppercase tracking-[0.22em] text-fg-dim">{t('presetModal.abis')}</span>
        <span className="text-fg-mute">·</span>
        <span className="text-fg">{selectedAbiNames.length}</span>
        <button onClick={selectAll} className="ml-auto text-fg-dim hover:text-fg">{t('presetModal.selectAll')}</button>
        <button onClick={clear} className="text-fg-dim hover:text-fg">{t('presetModal.clearAll')}</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {presets.length === 0 ? (
          <div className="p-3 font-ui text-[11px] text-fg-dim">{t('presetModal.empty')}</div>
        ) : (
          presets.map((p) => {
            const checked = selectedSet.has(p.name);
            return (
              <label
                key={p.id}
                className={
                  'flex cursor-pointer items-center gap-2 border-b border-line-soft px-3 py-1.5 font-mono text-[11px] transition-colors ' +
                  (checked ? 'border-l-2 border-l-mint bg-mint/5 pl-[10px]' : 'border-l-2 border-l-transparent pl-[10px] hover:bg-surface-2')
                }
              >
                <input type="checkbox" checked={checked} onChange={() => toggle(p)} />
                <span className="truncate text-fg">{p.name}</span>
              </label>
            );
          })
        )}
      </div>
      <div className="border-t border-line px-3 py-2">
        <button
          onClick={onOpenPresets}
          className="w-full rounded-sm border border-line bg-surface px-2 py-1 text-center font-mono text-[10px] text-fg-dim hover:bg-surface-2 hover:text-fg"
        >
          + {t('functionCall.addAbi')}
        </button>
      </div>
    </div>
  );
};

export default AbiSelector;
```

- [ ] **Step 2: Add i18n `functionCall.addAbi`**

zh: `新建 ABI` / en: `new abi`.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/common/AbiSelector.tsx src/i18n/locales
git commit -m "component: AbiSelector (persistent left-column ABI multi-select)"
```

---

## Task 20: FunctionCall — three-column layout + AbiSelector

**Files:**
- Modify: `src/components/functionCall/FunctionCallPage.tsx`
- Modify: `src/App.tsx`

Design: spec §5 "Layout", "Left ABI column".

- [ ] **Step 1: Extend `FunctionCallPageProps`**

```tsx
interface FunctionCallPageProps {
  // ...existing
  selectedAbis: string[];
  onAbisChange: (abis: string[], names: string[]) => void;
}
```

Pass through from `App.tsx`:

```tsx
<FunctionCallPage
  // ...existing
  selectedAbis={selectedAbis}
  onAbisChange={(abis, names) => { setSelectedAbis(abis); setSelectedAbiNames(names); }}
/>
```

- [ ] **Step 2: Change the grid**

The current code wraps functions/detail in a `grid` with `gridTemplateColumns: '2fr 3fr'`. Replace with three columns:

```tsx
<div
  className="grid flex-1 min-h-0"
  style={{ gridTemplateColumns: '260px minmax(0, 2fr) minmax(0, 3fr)' }}
>
  <AbiSelector
    selectedAbis={selectedAbis}
    selectedAbiNames={selectedAbiNames}
    onChange={onAbisChange}
    onOpenPresets={onPresetsClick}
    refreshToken={presetRefreshTrigger}
  />
  {/* existing function list column */}
  {/* existing detail+history column */}
</div>
```

- [ ] **Step 3: Adjust the "no ABI" empty state**

Keep the existing full-screen "No ABI selected" overlay for the case `functions.length === 0`, but with the three-column layout now, consider moving the overlay to span only the middle + right columns so the AbiSelector is still visible. Implementation:

```tsx
{functions.length === 0 ? (
  <div
    className="grid flex-1 min-h-0"
    style={{ gridTemplateColumns: '260px 1fr' }}
  >
    <AbiSelector ... />
    <div className="flex items-center justify-center">...empty-state...</div>
  </div>
) : (
  <div className="grid ..."><AbiSelector ... /><functions/><detail/></div>
)}
```

- [ ] **Step 4: Run build + smoke check**

Run: `npm run build`. Run: `npm run dev`.
- Empty state: left ABI column renders; check/uncheck an ABI preset reflects instantly.
- With ABIs selected: three columns shown; check/uncheck updates the middle column.

- [ ] **Step 5: Commit**

```bash
git add src/components/functionCall/FunctionCallPage.tsx src/App.tsx
git commit -m "FunctionCall: three-column grid with persistent AbiSelector"
```

---

## Task 21: `ParsedFunction.abiName` carry-through

**Files:**
- Modify: `src/App.tsx`

Design: spec §5 "Data change".

- [ ] **Step 1: Rewrite the ABI parse effect**

Currently `App.tsx` does:

```ts
const abiArrays = selectedAbis.map((abiStr) => JSON.parse(abiStr));
const merged = abiArrays.flat();
setMergedAbi(JSON.stringify(merged));
if (activeTab === 'function-call' && mergedStr) {
  const parsedFunctions = parseAbi(merged, true);
  setFunctions(parsedFunctions);
}
```

Change to preserve origin:

```ts
const abiArrays = selectedAbis.map((abiStr, i) => {
  try { return { abi: JSON.parse(abiStr), name: selectedAbiNames[i] }; }
  catch { return { abi: [], name: selectedAbiNames[i] }; }
});
const merged = abiArrays.flatMap((x) => x.abi);
setMergedAbi(JSON.stringify(merged));

if (activeTab === 'function-call') {
  const parsedFunctions = abiArrays.flatMap(({ abi, name }) =>
    parseAbi(abi, true).map((fn) => ({ ...fn, abiName: name })),
  );
  setFunctions(parsedFunctions);
  setAbiString(JSON.stringify(merged));
}
```

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: PASS (abiName is optional on ParsedFunction).

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "App: tag each ParsedFunction with its source ABI name"
```

---

## Task 22: FunctionCall — grouping, sorting, collapsible headers

**Files:**
- Modify: `src/components/functionCall/FunctionCallPage.tsx`

Design: spec §5 "Function list — ABI origin, grouping, ordering".

- [ ] **Step 1: Add sort helpers**

At the top of the module (outside the component):

```ts
const MUTABILITY_ORDER: Record<string, number> = {
  view: 0, pure: 1, nonpayable: 2, payable: 3,
};

function sortFunctions(fns: ParsedFunction[]): ParsedFunction[] {
  return [...fns].sort((a, b) => {
    const ma = MUTABILITY_ORDER[a.stateMutability] ?? 99;
    const mb = MUTABILITY_ORDER[b.stateMutability] ?? 99;
    if (ma !== mb) return ma - mb;
    return a.name.localeCompare(b.name);
  });
}
```

- [ ] **Step 2: Build grouped structure**

Inside the component (replacing the existing `filteredFns` memo, or augmenting):

```ts
interface FnGroup { abiName: string; fns: ParsedFunction[] }

const groups: FnGroup[] = useMemo(() => {
  const q = filter.trim().toLowerCase();
  const byName = new Map<string, ParsedFunction[]>();
  // preserve order of first appearance
  const order: string[] = [];
  for (const fn of functions) {
    const key = fn.abiName ?? t('functionCall.ungroupedAbi');
    if (!byName.has(key)) { byName.set(key, []); order.push(key); }
    if (!q || fn.name.toLowerCase().includes(q)) byName.get(key)!.push(fn);
  }
  return order
    .map((name) => ({ abiName: name, fns: sortFunctions(byName.get(name) ?? []) }))
    .filter((g) => g.fns.length > 0);
}, [functions, filter, t]);
```

- [ ] **Step 3: Track collapsed groups**

```ts
const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
const toggleGroup = (name: string) => setCollapsedGroups((s) => {
  const next = new Set(s);
  if (next.has(name)) next.delete(name); else next.add(name);
  return next;
});
```

- [ ] **Step 4: Render grouped list**

Replace the current `filteredFns.map(...)` block with:

```tsx
{groups.map((g) => {
  const collapsed = collapsedGroups.has(g.abiName);
  return (
    <div key={g.abiName}>
      <div
        onClick={() => toggleGroup(g.abiName)}
        className="sticky top-0 z-10 flex cursor-pointer items-center gap-1.5 border-b border-line bg-surface px-4 py-1.5 font-mono text-[10px] text-fg-dim hover:text-fg"
      >
        <span className="text-fg-mute">{collapsed ? '▸' : '▾'}</span>
        <span className="uppercase tracking-[0.18em]">{g.abiName}</span>
        <span className="text-fg-mute">·</span>
        <span>{g.fns.length}</span>
      </div>
      {!collapsed && g.fns.map((fn) => {
        const k = fnKey(fn);
        const selected = k === selectedKey;
        return (
          <div
            key={k}
            onClick={() => setSelectedKey(k)}
            className={
              'group cursor-pointer border-b border-line-soft px-4 py-2 font-mono text-[11px] transition-colors ' +
              (selected
                ? 'border-l-2 border-l-mint bg-mint/5 pl-[14px]'
                : 'border-l-2 border-l-transparent pl-[14px] hover:bg-surface-2')
            }
          >
            <div className="flex items-center gap-2">
              <MutabilityBadge mutability={fn.stateMutability} />
              <span className="truncate text-fg">{fn.name}</span>
              <span className="truncate text-[10px] text-fg-mute">
                ({fn.inputs.map((i) => i.type).join(', ')})
              </span>
            </div>
            {fn.outputs.length > 0 && (
              <div className="mt-0.5 ml-[46px] truncate text-[10px] text-fg-mute">
                → {fn.outputs.map((o) => o.type).join(', ')}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
})}
```

- [ ] **Step 5: Add i18n `functionCall.ungroupedAbi`**

zh: `未分组` / en: `Ungrouped`.

- [ ] **Step 6: Run build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 7: Smoke check**

Run: `npm run dev`:
- Select two ABIs (e.g. ERC20 + another). Function list shows two group headers with correct counts; `view` functions ordered first; click header toggles collapse.
- Type in search — groups auto-filter; empty groups hide.

- [ ] **Step 8: Commit**

```bash
git add src/components/functionCall/FunctionCallPage.tsx src/i18n/locales
git commit -m "FunctionCall: group by ABI, sort by mutability, collapsible headers"
```

---

## Task 23: Final i18n pass + stale-key cleanup

**Files:**
- Modify: `src/i18n/locales/zh.json`
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: Inventory new keys added across Phases 1–3**

Confirm the following exist in both locales (add any missing):
- `contractPreset.namePlaceholder`, `contractPreset.addEntry`
- `presetModal.descriptionPlaceholder`
- `picker.noMatch`, `picker.showAllChains`
- `functionCall.addAbi`, `functionCall.ungroupedAbi`

- [ ] **Step 2: Scan for orphaned keys**

Run:
```bash
# list all t('...') usages
grep -rhoE "t\\(['\"][a-zA-Z0-9_.]+['\"]" src | sed -E "s/t\\(['\"]//" | sed -E "s/['\"]$//" | sort -u > /tmp/used-keys
# list all defined keys
# (using jq or a short node script to flatten JSON keys)
```

Remove any keys in `zh.json` / `en.json` that don't appear in `/tmp/used-keys`. Typical candidates after this refactor: the old address-input placeholders that were inlined into pickers.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales
git commit -m "i18n: add picker / abi-selector / contract-preset keys; prune stale"
```

---

## Task 24: Final end-to-end smoke check

- [ ] **Step 1: Fresh-clone-like reload**

Run: `npm run build && npm run preview`
Open the preview URL in a fresh browser profile (or clear `localStorage`) to re-trigger default seeds + migration from zero state. Verify:
- Default RPC presets have chainIds.
- Default USDC contract preset shows three entries.

- [ ] **Step 2: Walk through every tab**

For each tab:
- Select an RPC via the new picker — verify chainId-backfilled behavior.
- (Where applicable) select a contract via ContractPicker filtered to the chain.
- Run its primary action (fetch tx / trace / query events / call a function).
- Verify decoded outputs render as objects where named, arrays otherwise.
- Verify addresses show preset names (strict or loose) according to rules.
- Toggle `@names` off — all labels revert to truncated hex.

- [ ] **Step 3: Commit any straggler fixes**

If issues surface, fix them inline and commit with a short message.

---

## Self-Review Checklist

**Spec coverage**

| Spec section | Covered in task(s) |
|---|---|
| §1 ContractPreset v2 | 1, 2 |
| §1 Migration | 2 |
| §1 chainId backfill | 4, 5 |
| §1 presetStorage API | 2 |
| §2 global state | 5 |
| §2 AddressNameLookup | 6 |
| §2 Application points | 6, 13, 14 |
| §3 toDisplay | 8 |
| §3 Integration points | 9, 10 |
| §3 DecodedValue / AddressBadge | 11, 12, 13 |
| §4 RpcPicker | 15 |
| §4 ContractPicker | 16 |
| §4 TxBar placement | 17, 18 |
| §5 three-column layout | 20 |
| §5 AbiSelector | 19, 20 |
| §5 ParsedFunction.abiName | 1, 21 |
| §5 grouping + sorting | 22 |
| §6 PresetModal contract editor | 7 |
| §6 default seed data | 3 |
| §6 i18n | 7, 15, 16, 19, 22, 23 |
| §8 failure / fallback | implicit in 5 (silent on error), 6 (loose fallback) |

All spec requirements map to tasks.

**Placeholder scan**

No "TBD" / "implement later" / "similar to" anywhere in this plan. Each code block contains the exact code.

**Type consistency**

- `ContractEntry` + `ContractPreset.entries: ContractEntry[]` — used identically in Tasks 1, 2, 3, 7, 16.
- `AddressNameLookup { strict, loose }` — Task 6 defines; Tasks 11, 12, 13, 14 consume.
- `DisplayValue` — Task 8 defines; Task 12 consumes.
- `formatAddress(addr, lookup, showNames, opts?)` — Task 6 defines; Tasks 11, 14 consume.
- `toDisplay(value, param?)` — Task 8 defines; Tasks 9, 10 consume.
- `TxBar` props shape (Task 17) matches call sites in Task 18 and tabs migrated in Task 17 Step 2.

All signatures stable across tasks.
