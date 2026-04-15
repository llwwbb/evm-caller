export type AddressNameMap = Map<string, string>;

export function formatAddress(
  address: string | undefined | null,
  nameMap: AddressNameMap,
  showNames: boolean
): string {
  if (!address) return '';
  const lower = address.toLowerCase();
  if (showNames && nameMap.has(lower)) return nameMap.get(lower)!;
  if (address.length > 10) {
    return address.slice(0, 6) + '…' + address.slice(-4);
  }
  return address;
}

export function buildAddressNameMap(
  contracts: Array<{ address: string; name: string }>
): AddressNameMap {
  const map: AddressNameMap = new Map();
  for (const c of contracts) map.set(c.address.toLowerCase(), c.name);
  return map;
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
