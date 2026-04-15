# ChainId Context, Address Naming, and Function Call UX — Design Spec

**Date**: 2026-04-16
**Scope**: Four coupled features addressing the same underlying gap —
the app currently has no notion of "which chain is this request going to",
which blocks per-chain address naming, multi-chain contract presets, and
good UX for switching between contracts.

## Motivation

1. Switching ABI / contract while debugging is high-frequency. The current flow
   forces the user to open PresetModal every time. Function Call is the most
   affected page because it's where function lists live.
2. Addresses show up in many places — decoded args, trace from/to, tx logs,
   event args. Today they're rendered as truncated hex without any link to
   the user's contract presets, which is painful when the user already has
   the address saved under a meaningful name.
3. Contract presets assume one name = one address, but in reality a project
   (Uniswap V3 Router, USDC, a specific proxy) lives on many chains. Users
   cannot express this today.
4. Decoded results with ABI-defined struct components render as arrays
   because the format step doesn't carry ABI information alongside the
   ethers `Result` object.

All four problems share two requirements: (a) the app needs to know which
chain the current RPC targets, and (b) decoded data must be walked alongside
its ABI definition. Solving these enables the rest.

## Scope

One spec, three logical units:

- **Unit A — Chain context & address naming** (items 2, 4).
- **Unit B — Function Call UX** (item 1): unified `RpcPicker` / `ContractPicker`, left ABI column.
- **Unit C — Nested tuple formatter** (item 3).

Implementation ordering is Phase 1 → 2 → 3, but all parts live in one spec
because they share the `currentChainId` / `AddressNameLookup` / `DecodedValue`
seams.

## Non-goals

- Chain switching without RPC (no built-in chain registry for RPC-less tabs).
- Bulk import of well-known addresses (users still hand-curate their presets).
- `Cmd+K` command palette (deferred).
- Migrating to a new preset storage format other than `localStorage`.

---

## §1 Data Model

### ContractPreset — version 2

```ts
interface ContractEntry {
  chainId?: number;     // matches RpcPreset.chainId; optional
  address: string;      // mixed-case hex
}

interface ContractPreset {
  id: string;
  name: string;         // "Uniswap V3 Router"
  description?: string;
  entries: ContractEntry[];  // length >= 1
  createdAt: number;
}
```

### Migration

On app boot, before `initializeDefaultPresets`:

1. Read `evm-caller:contract-preset-version`. If `"2"`, skip.
2. Load `evm-caller:contract-presets`. For each record:
   - If shape is new (`entries` present), pass through.
   - If shape is old (`{name, address}`), group records by `name`.
     - Each group → one new preset: `{ id: first.id, name, description:
       first.description, entries: group.map(r => ({ address: r.address })),
       createdAt: first.createdAt }`. No chainId is assigned automatically.
3. Write the migrated array back; set version marker to `"2"`.

Existing seed data (`ETH USDC` etc. inside `initializeDefaultPresets`) is
updated to the new shape with appropriate `chainId` values.

### `RpcPreset.chainId` backfill

The field already exists but was never written. Rules:

- When the user **selects an RPC preset** (click in PresetModal or Picker),
  if `chainId` is undefined, fire a single background `eth_chainId` query
  against `rpcUrl`. On success, update the preset via `updateRpcPreset` and
  the in-memory `currentChainId`. On failure, leave undefined.
- After a successful backfill, never re-query.
- Free-form `rpcUrl` (not matching any preset) sets `currentChainId = null`.
  When the user later saves it as a preset, `chainId` is resolved at save
  time by one `eth_chainId` call.

### `presetStorage` API changes

```ts
// before
saveContractPreset(name: string, address: string, description?: string)

// after
saveContractPreset(name: string, entries: ContractEntry[], description?: string)
updateContractPreset(id: string, updates: Partial<Pick<ContractPreset, 'name' | 'description' | 'entries'>>)

// new
findContractByAddress(address: string, chainId?: number): { preset: ContractPreset; entry: ContractEntry } | null
```

`findContractByAddress` is not called on the hot path — `buildAddressNameLookup`
(see §2) iterates presets once per render and returns lookup maps.

---

## §2 Chain Context & Address Naming

### Global state

`App.tsx` gains `currentChainId: number | null`, derived from `rpcUrl`:

```ts
const [currentChainId, setCurrentChainId] = useState<number | null>(null);

useEffect(() => {
  if (!rpcUrl.trim()) { setCurrentChainId(null); return; }
  const preset = rpcPresets.find(p => p.rpcUrl === rpcUrl);
  if (preset?.chainId) { setCurrentChainId(preset.chainId); return; }
  if (preset) {
    // backfill path — single query, cancelable on rpcUrl change
    const controller = new AbortController();
    fetchChainId(rpcUrl, controller.signal)
      .then(cid => {
        if (controller.signal.aborted) return;
        updateRpcPreset(preset.id, { chainId: cid });
        setCurrentChainId(cid);
      })
      .catch(() => { /* silent: null stays null */ });
    return () => controller.abort();
  }
  setCurrentChainId(null); // free-form URL
}, [rpcUrl, rpcPresets]);
```

`fetchChainId` is a raw POST (not `ethers.JsonRpcProvider.getNetwork`, which
pulls a heavier dependency graph):

```ts
async function fetchChainId(rpcUrl: string, signal?: AbortSignal): Promise<number> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
    signal,
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? 'eth_chainId failed');
  return parseInt(json.result, 16);
}
```

`currentChainId` is passed down as a prop, like `showAddressNames`.

### Address name lookup

`src/utils/addressDisplay.ts` is refactored:

```ts
interface AddressNameLookup {
  strict: Map<string, string>;   // keyed by lowercased address
  loose:  Map<string, string>;   // keyed by lowercased address
}

function buildAddressNameLookup(
  contracts: ContractPreset[],
  currentChainId: number | null,
): AddressNameLookup {
  const strict = new Map<string, string>();
  const loose  = new Map<string, string>();
  for (const c of contracts) {
    for (const e of c.entries) {
      const key = e.address.toLowerCase();
      if (currentChainId != null && e.chainId === currentChainId) {
        strict.set(key, c.name);
      } else if (e.chainId == null || currentChainId == null) {
        // entry without chainId OR no current chain → loose match
        if (!loose.has(key)) loose.set(key, c.name);
      }
      // entries with a chainId that doesn't match currentChainId: ignored.
    }
  }
  return { strict, loose };
}

function formatAddress(
  addr: string,
  lookup: AddressNameLookup,
  showNames: boolean,
  opts?: { allowLoose?: boolean },
): string {
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
```

`allowLoose` defaults to `true`. Only places certain the RPC truly matches the
data (e.g. an active trace where chainId is confirmed) may pass `false` to
suppress the trailing `?`. For v1, all call sites use the default.

The current `CALL_TYPE_STYLE` + `REVERT_STYLE` exports from this file stay as
they are.

### Application points

Every place that renders a bare address switches to `formatAddress(addr, lookup, showNames)`:

- `TxBar` address kickers (all tabs).
- `DebugTrace`: `CallTreeRow` (from→to), `NodeCard` header/body, `buildCrumb`.
- `TransactionParser`: tx from/to, `logs[].address`, decoded args that contain addresses.
- `EventQuery`: row `address` column, decoded `args` address fields.
- `HexParser`: decoded args.
- `AbiEncoder`: decoded results.
- `FunctionCall`: decoded results + history rows.
- `StateOverride`: account list, `from`, calls' target contract.

Decoded args are rendered via the `<DecodedValue />` component introduced in §4,
which walks the JS value tree and replaces any string that matches
`^0x[a-fA-F0-9]{40}$` with an `<AddressBadge addr lookup showNames />`.

---

## §3 Nested Tuple Formatter

### `utils/decodedFormat.ts` — `toDisplay`

```ts
import { Result } from 'ethers';
import { ParsedParam } from '../types';

type DisplayValue =
  | string | number | boolean | null
  | DisplayValue[]
  | { [key: string]: DisplayValue };

export function toDisplay(value: unknown, param?: ParsedParam | ParsedParam[]): DisplayValue {
  // top-level: an array of params means "multi-return"
  if (Array.isArray(param)) return param.map((p, i) => toDisplay((value as any)[i], p));

  if (typeof value === 'bigint') return value.toString();
  if (value == null || typeof value !== 'object') return value as DisplayValue;

  const components = param?.components;
  const isResult = typeof (value as any).toArray === 'function';
  const allNamed = !!components && components.length > 0 && components.every(c => !!c.name);

  if (isResult && allNamed) {
    const out: Record<string, DisplayValue> = {};
    for (const c of components!) out[c.name] = toDisplay((value as any)[c.name], c);
    return out;
  }

  if (Array.isArray(value)) {
    const elemParam: ParsedParam | undefined = param?.type?.endsWith('[]')
      ? { ...param, type: param.type.slice(0, -2) }
      : undefined;
    return (value as any[]).map((v) => toDisplay(v, elemParam));
  }

  // plain object fallback (unlikely from ethers, but safe)
  const out: Record<string, DisplayValue> = {};
  for (const k of Object.keys(value as any)) out[k] = toDisplay((value as any)[k]);
  return out;
}
```

Rules:
- `bigint` → string.
- ethers `Result` whose ABI `components` are all named → object, recurse.
- ethers `Result` with at least one unnamed component → array (as received), recurse.
- Plain array: recurse; if ABI type ends in `[]`, derive element `ParsedParam`.
- Primitives pass through.

Unnamed tuple components stay as arrays on purpose — without names there's no
way to assign keys honestly.

### Integration points

- `rpcCaller.formatResult` is **deleted**. Its callers (only
  `FunctionCallPage.handleCall` via `App.handleFunctionCall`) receive the raw
  ethers result and call `toDisplay(result, func.outputs)` themselves. This
  removes the duplicated "unwrap Result" logic.
- `debugTrace.parseTraceWithAbi`: after decode, run decoded args/output through
  `toDisplay` with the matching fragment inputs/outputs.
- `transactionParser.ts` / `eventQuery.ts` / `hexParser.ts`: same treatment at
  the point they produce `decodedInput.args` / `event.args` / `decoded args`.
- `abiEncoder.ts`: the decode path. AbiEncoder has no ABI `components` — it
  decodes from user-typed type strings like `['uint256', 'address']`. `toDisplay`
  still runs (for `bigint` → string), but tuple → object has nothing to do
  here; it degrades to plain array handling.

### UI: `<DecodedValue />`

```tsx
// src/components/common/DecodedValue.tsx
interface Props {
  value: DisplayValue;
  lookup: AddressNameLookup;
  showNames: boolean;
  // compact (inline, for table cells) vs block (multi-line tree) — block default
  variant?: 'compact' | 'block';
}
```

- `object`: one row per key, `{ key }: { <DecodedValue value=val /> }`.
- `array`: one row per item (compact: `[ item, item, ... ]`).
- `string` that matches `^0x[a-fA-F0-9]{40}$` → `<AddressBadge />`.
- other primitives → monospace span.

Replaces the current `<pre>{JSON.stringify(value, replacer, 2)}</pre>` in:
- `FunctionCallPage` history args/result
- `TransactionParserPage` decoded input + log args
- `HexParserPage` decoded args
- `EventQueryPage` per-event args (expanded row)
- `AbiEncoderPage` decode output
- `NodeCard` (DebugTrace) decodedInput.args, decodedOutput, decodedError.args

### `<AddressBadge />`

```tsx
interface AddressBadgeProps {
  addr: string;
  lookup: AddressNameLookup;
  showNames: boolean;
}
```

Renders `formatAddress(...)` in a `<span>` with the full address in `title`.
When the name starts with a loose match (ends in `?`), the span uses
`text-fg-dim` instead of the default; strict matches render at `text-fg`.

---

## §4 RpcPicker & ContractPicker

Shared combobox primitive. Key behaviors:

- Input renders the current text value.
- Focus → dropdown with filtered presets (fuzzy match on name, URL/address, chain).
- Click preset row → apply.
- Free-form input → commit on Enter / blur; preset reference cleared.
- Escape closes dropdown.
- Keyboard: ↑/↓ to navigate, Enter to select.

### `<RpcPicker />`

```tsx
interface RpcPickerProps {
  value: string;
  onChange: (rpcUrl: string, preset?: RpcPreset) => void;
  placeholder?: string;
  width?: string;
}
```

Row display: `[chain tag] name · rpcUrl (truncated, right-aligned)`. If
`chainId` is known, show chain label (e.g. `ETH`, `BSC`, `42161`).

### `<ContractPicker />`

```tsx
interface ContractPickerProps {
  value: string;
  onChange: (address: string, preset?: ContractPreset, entry?: ContractEntry) => void;
  currentChainId: number | null;
  placeholder?: string;
  width?: string;
}
```

- Search space: `ContractPreset.name` and every `entry.address`.
- Default visibility: entry is shown if `entry.chainId === currentChainId` OR
  `entry.chainId == null`. Toggle at the top of the dropdown: `☐ show all chains`.
- If a preset has multiple matching entries, they appear as separate rows
  underneath one name header.
- Free-form input → cleared preset/entry reference.

### Placement

Both pickers live in `src/components/common/`. `TxBar` hardcodes them:

```tsx
<TxBar
  rpcUrl={rpcUrl}
  onRpcChange={setRpcUrl}
  contractAddress={contractAddress}
  onContractChange={setContractAddress}
  currentChainId={currentChainId}
  // ... existing props
/>
```

FunctionCall's handwritten input bar is replaced with `<TxBar />`, so the same
pickers drive every tab.

---

## §5 FunctionCall — Left ABI Column, Function Grouping

### Layout

Three-column grid:

```
┌──────────┬─────────────┬────────────────────────┐
│ ABIs     │ Functions   │ Detail + History       │
│ ~14%     │ ~32%        │ ~54%                   │
└──────────┴─────────────┴────────────────────────┘
```

### Left ABI column

Consumes the existing `selectedAbis` / `selectedAbiNames` / `mergedAbi` state
from `App.tsx`. New `<AbiSelector />` component:

- Header: `ABIs · N selected  [select all] [clear]`.
- Rows: each `AbiPreset` with a checkbox on the left, name on the right.
- Footer: `+ new abi` → opens PresetModal with `initialFocus: 'abis'`.

State is single-source — changes made in PresetModal reflect here and vice
versa, because both surfaces read/write `selectedAbis`.

### Function list — ABI origin, grouping, ordering

**Data change**: `ParsedFunction` gets `abiName: string`.

```ts
// App.tsx — no longer flat-concats ABIs before parsing
const parsedFns = selectedAbis.flatMap((abiStr, i) => {
  const abiName = selectedAbiNames[i];
  const fns = parseAbi(JSON.parse(abiStr), true);
  return fns.map(fn => ({ ...fn, abiName }));
});
```

`mergedAbi` is still produced for use by other decoders (TxParser, etc.).

**Ordering** in `FunctionCallPage`:

1. Group by `abiName`, in the order the user selected ABIs (i.e., the order
   of `selectedAbiNames`).
2. Inside a group, by `stateMutability`: `view` → `pure` → `nonpayable` → `payable`.
3. Inside a mutability, by `name` ascending.

Stable sort; ties broken by original index.

**UI**: collapsible group header per ABI:

```
▸ ERC20 · 9
  [VIEW]  balanceOf(address)
  [VIEW]  totalSupply()
  [NP]    transfer(address, uint256)
  ...
▸ Uniswap V3 Pool · 15
  ...
```

- Header is sticky within the scroll area.
- Header click toggles collapse; state kept in a `Set<string>` (abiName keys),
  not persisted across sessions.
- Search filter (`searchFunctions` input) matches across groups. Groups with
  zero matches auto-hide. Header chevron + count update to match visible rows.
- Selection (`selectedKey`) behavior is unchanged; the row shows the same
  active left border.

---

## §6 Miscellaneous

### PresetModal contract editor

The contracts column becomes a card-per-preset editor:

```
┌─ Uniswap V3 Router ──────────────── [×]
│ [ETH 1     ] [0x68b3…aD5         ] [×]
│ [ARB 42161 ] [0x68b3…aD5         ] [×]
│ + add address
├─ description (optional)
│ [                                    ]
└─ [save]
```

Each entry row: chainId input (number; label rendered via a small `chainLabel`
helper with common chains), address input, remove. `+ add address` appends an
empty entry. "Save" calls `updateContractPreset(id, { entries })`.

### Default seed data

`initializeDefaultPresets` updated:

- ETH / BSC / Polygon RPCs with correct `chainId`.
- ERC20 ABI (no change).
- Seed contract examples with multi-entry structure (e.g. USDC with mainnet +
  Arbitrum + Polygon entries).

### i18n

New keys (both `zh.json` and `en.json`):

- `contractPreset.addEntry`, `contractPreset.chainIdLabel`, `contractPreset.noEntries`
- `picker.free`, `picker.showAllChains`, `picker.noMatch`
- `functionCall.ungroupedAbi` (fallback if `abiName` is empty)
- `decodedValue.unnamedTuple`, `decodedValue.arrayCount`

Stale keys from the old flat contract editor are removed.

---

## §7 Implementation Phases

### Phase 1 — data foundation

1. Type updates: `ContractPreset`, `ContractEntry`, `ParsedFunction.abiName`.
2. Migration in `presetStorage.ts` + version marker.
3. `presetStorage` API changes: `saveContractPreset`, `updateContractPreset`,
   `findContractByAddress`.
4. `initializeDefaultPresets` updated.
5. `App.tsx`: `currentChainId` derivation with backfill.
6. `addressDisplay.ts`: `AddressNameLookup` + refactored `formatAddress`.
7. PresetModal contract column rewrite to the card-per-preset editor.
8. Ensure existing callers of `formatAddress` compile (they'll just receive
   the lookup via props; `buildAddressNameMap` → `buildAddressNameLookup`).

### Phase 2 — decoded display unification

9. `utils/decodedFormat.ts` — `toDisplay`.
10. Delete `rpcCaller.formatResult`; `App.handleFunctionCall` calls
    `toDisplay(result, func.outputs)`.
11. Hook `toDisplay` into `debugTrace.parseTraceWithAbi`, `transactionParser`,
    `eventQuery`, `hexParser`, `abiEncoder` decode paths.
12. `<AddressBadge />` + `<DecodedValue />` components.
13. Replace the six `<pre>{JSON.stringify}</pre>` call sites.
14. All bare address renderers (DebugTrace rows, TxParser, etc.) call the
    new `formatAddress` with the lookup prop.

### Phase 3 — Function Call UX + pickers

15. `<RpcPicker />`, `<ContractPicker />`.
16. `TxBar` hardcodes pickers; `currentChainId` + `onRpcChange` + `onContractChange`
    added to props. 5 tabs' TxBars updated.
17. FunctionCall: replace handwritten input bar with TxBar.
18. FunctionCall: three-column layout, `<AbiSelector />` left column.
19. Function list: group headers, collapse toggles, search filter behavior,
    ordering helpers.
20. i18n additions.

Each phase ends with `npm run build` passing and all tabs working.

---

## §8 Open points and fallback behavior

- `eth_chainId` query failure → `currentChainId` stays `null`; all address
  lookups run with `currentChainId = null`, which means `loose` includes
  every entry and no `strict` match occurs. UX degrades gracefully to
  "best-effort naming without chain disambiguation."
- Old-data migration with duplicate names → merged into one preset's
  `entries`. Description taken from the earliest record.
- AbiEncoder decode: `toDisplay` runs but tuple→object is a no-op (no ABI
  components). `<DecodedValue />` + `<AddressBadge />` still provide address
  naming.
- Free-form RPC URL never written to preset → `currentChainId` is `null`;
  matching degrades to loose. No implicit preset creation.

## §9 Testing approach (manual — no test framework)

For each phase, verify the following paths in the browser:

Phase 1:
- Start app with legacy `{name, address}` in localStorage — migration triggers,
  PresetModal shows a single entry per preset.
- Select an RPC preset without chainId — observe one background `eth_chainId`
  request (devtools Network), preset updates, `currentChainId` propagates.
- Edit a contract preset, add a second entry with a different chainId, save,
  reload — entries persisted.

Phase 2:
- FunctionCall: call a view fn returning a named struct → object display (not
  array) in history.
- DebugTrace: load a tx with internal calls that match a preset address on the
  current chain → strict match (no trailing `?`). Load a tx on a different
  chain with the same contract saved under chainId=1 only → loose match
  (`name?`).
- HexParser: decode with no RPC configured → loose match works, no `?` feels
  wrong if user expects it, keep `?` per spec.

Phase 3:
- RpcPicker: type a substring of a preset name, select, observe `rpcUrl` +
  `currentChainId` update.
- ContractPicker on a 1-chain RPC: default dropdown hides addresses for other
  chains. Toggle "show all chains" — all entries appear.
- FunctionCall left column: check/uncheck an ABI, verify functions list
  re-groups; group collapse toggle works; search narrows across groups.
- Function ordering: two selected ABIs, each with mixed mutability functions —
  confirm view→pure→nonpayable→payable inside each group and group order
  matches selection order.
