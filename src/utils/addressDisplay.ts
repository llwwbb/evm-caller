import { ContractPreset } from '../types';

export interface AddressNameLookup {
  strict: Map<string, string>;
  loose: Map<string, string>;
}

// Legacy alias; kept so older imports still compile during incremental migration.
export type AddressNameMap = AddressNameLookup;

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

export const CALL_TYPE_STYLE: Record<
  string,
  { bg: string; fg: string; label: string }
> = {
  CALL:         { bg: 'rgba(96,165,250,0.12)',  fg: 'var(--blue)',    label: 'CALL' },
  DELEGATECALL: { bg: 'rgba(251,191,36,0.12)',  fg: 'var(--amber)',   label: 'DELEGATE' },
  STATICCALL:   { bg: 'rgba(167,139,250,0.14)', fg: 'var(--violet)',  label: 'STATIC' },
  CREATE:       { bg: 'rgba(74,222,128,0.12)',  fg: 'var(--emerald)', label: 'CREATE' },
  CREATE2:      { bg: 'rgba(74,222,128,0.12)',  fg: 'var(--emerald)', label: 'CREATE2' },
  SELFDESTRUCT: { bg: 'rgba(255,91,110,0.14)',  fg: 'var(--red)',     label: 'DESTROY' },
};

export const REVERT_STYLE = { bg: 'rgba(255,91,110,0.14)', fg: 'var(--red)', label: 'REVERT' };
