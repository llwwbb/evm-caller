import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { JsonRpcProvider, toBeHex } from 'ethers';
import { StorageVariable } from '../../types';
import {
  calculateSimpleSlot,
  calculateMappingSlot,
  calculateArraySlot,
  encodeSlotValue,
} from '../../utils/storageSlot';

interface SlotCalcPageProps {
  rpcUrl: string;
}

type Mode = 'manual' | 'layout-json' | 'probe';

type ProbeType = 'hex' | 'uint' | 'address' | 'bool';

interface LayoutVar {
  label: string;
  type: string;          // resolved to Solidity-style e.g. uint256, mapping(address => uint256)
  slot: number;
  offset: number;
  numberOfBytes?: number;
  encoding?: string;     // inplace | mapping | dynamic_array | bytes
}

/** Parses a `solc --storage-layout` / `forge inspect storageLayout` JSON blob. */
function parseLayoutJson(raw: string): LayoutVar[] | { error: string } {
  try {
    const data = JSON.parse(raw);
    const storage = data.storage ?? data.storageLayout?.storage;
    const types = data.types ?? data.storageLayout?.types ?? {};
    if (!Array.isArray(storage)) return { error: 'no "storage" array found' };

    const resolve = (typeKey: string): string => {
      const t = types[typeKey];
      if (!t) return typeKey;
      if (t.encoding === 'mapping') {
        const k = resolve(t.key);
        const v = resolve(t.value);
        return `mapping(${k} => ${v})`;
      }
      if (t.encoding === 'dynamic_array') {
        return `${resolve(t.base)}[]`;
      }
      return t.label ?? typeKey;
    };

    return storage.map((s: any) => ({
      label: s.label,
      type: resolve(s.type),
      slot: Number(s.slot),
      offset: Number(s.offset ?? 0),
      numberOfBytes: types[s.type]?.numberOfBytes ? Number(types[s.type].numberOfBytes) : undefined,
      encoding: types[s.type]?.encoding,
    }));
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

const ModeBtn: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={
      'rounded-sm px-2.5 py-1 text-[10px] ' +
      (active ? 'bg-mint font-semibold text-bg' : 'text-fg-dim hover:bg-surface-2')
    }
  >
    {children}
  </button>
);

const CopyBtn: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="rounded-sm px-1.5 py-0.5 text-[9px] text-fg-mute hover:bg-surface-2"
    >
      {copied ? '✓ copied' : 'copy'}
    </button>
  );
};

// ==================== Manual mode ====================

const ManualMode: React.FC = () => {
  const { t } = useTranslation();
  const [varName, setVarName] = useState('balances');
  const [varType, setVarType] = useState('mapping(address => uint256)');
  const [varSlot, setVarSlot] = useState('0');
  const [keys, setKeys] = useState<string[]>(['']);
  const [arrayIndex, setArrayIndex] = useState('');
  const [valueToEncode, setValueToEncode] = useState('');
  const [computedSlot, setComputedSlot] = useState<string | null>(null);
  const [encodedValue, setEncodedValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isMapping = varType.startsWith('mapping');
  const isArray = varType.endsWith('[]');

  // sync key count with mapping nesting level
  const expectedKeyCount = useMemo(() => {
    let count = 0;
    let rest = varType;
    while (rest.startsWith('mapping')) {
      const m = rest.match(/^mapping\s*\(\s*(.+?)\s*=>\s*(.+?)\s*\)$/);
      if (!m) break;
      count++;
      rest = m[2].trim();
    }
    return count;
  }, [varType]);

  const handleCompute = () => {
    setError(null);
    const slotNum = parseInt(varSlot, 10);
    if (isNaN(slotNum) || slotNum < 0) {
      setError(t('slotCalc.invalidSlot'));
      return;
    }
    const variable: StorageVariable = {
      name: varName || 'var',
      type: varType.trim(),
      slot: slotNum,
    };
    try {
      let result;
      if (isMapping) {
        const usedKeys = keys.slice(0, expectedKeyCount).map((k) => k.trim());
        if (usedKeys.some((k) => !k)) {
          setError(t('slotCalc.fillAllKeys'));
          return;
        }
        result = calculateMappingSlot(variable, usedKeys);
      } else if (isArray) {
        const idx = parseInt(arrayIndex, 10);
        if (isNaN(idx) || idx < 0) {
          setError(t('slotCalc.invalidArrayIndex'));
          return;
        }
        result = calculateArraySlot(variable, idx);
      } else {
        result = calculateSimpleSlot(variable);
      }
      setComputedSlot(result.slot);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleEncodeValue = () => {
    setError(null);
    try {
      // find the innermost "value type" (for a mapping(x => mapping(y => T)) → T)
      let valueType = varType;
      while (valueType.startsWith('mapping')) {
        const m = valueType.match(/^mapping\s*\(\s*(.+?)\s*=>\s*(.+?)\s*\)$/);
        if (!m) break;
        valueType = m[2].trim();
      }
      if (valueType.endsWith('[]')) valueType = valueType.slice(0, -2);
      const hex = encodeSlotValue(valueToEncode.trim(), valueType);
      setEncodedValue(hex);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="grid flex-1 min-h-0" style={{ gridTemplateColumns: '2fr 3fr' }}>
      <div className="flex min-h-0 flex-col border-r border-line p-5">
        <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.22em] text-fg-mute">
          {t('slotCalc.variable')}
        </div>
        <div className="space-y-2 font-mono text-[11px]">
          <div className="grid grid-cols-[80px_1fr] items-center gap-3">
            <span className="text-fg-mute">name</span>
            <input
              value={varName}
              onChange={(e) => setVarName(e.target.value)}
              className="rounded-sm border border-line bg-bg px-2 py-1 text-fg focus:border-mint focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-[80px_1fr] items-center gap-3">
            <span className="text-fg-mute">type</span>
            <input
              value={varType}
              onChange={(e) => setVarType(e.target.value)}
              placeholder="uint256 / address / mapping(address => uint256)"
              className="rounded-sm border border-line bg-bg px-2 py-1 text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-[80px_1fr] items-center gap-3">
            <span className="text-fg-mute">base slot</span>
            <input
              value={varSlot}
              onChange={(e) => setVarSlot(e.target.value)}
              className="rounded-sm border border-line bg-bg px-2 py-1 text-fg focus:border-mint focus:outline-none"
            />
          </div>

          {isMapping && (
            <div className="mt-3">
              <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.22em] text-fg-mute">
                {t('slotCalc.mappingKeys')} · {expectedKeyCount} level{expectedKeyCount !== 1 ? 's' : ''}
              </div>
              {Array.from({ length: expectedKeyCount }).map((_, i) => (
                <input
                  key={i}
                  value={keys[i] ?? ''}
                  onChange={(e) => {
                    const next = [...keys];
                    next[i] = e.target.value;
                    setKeys(next);
                  }}
                  placeholder={`key[${i}]`}
                  className="mb-1 w-full rounded-sm border border-line bg-bg px-2 py-1 font-mono text-[11px] text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
                />
              ))}
            </div>
          )}

          {isArray && (
            <div className="mt-3">
              <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.22em] text-fg-mute">
                {t('slotCalc.arrayIndex')}
              </div>
              <input
                value={arrayIndex}
                onChange={(e) => setArrayIndex(e.target.value)}
                placeholder="0"
                className="w-full rounded-sm border border-line bg-bg px-2 py-1 font-mono text-[11px] text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
              />
            </div>
          )}

          <button
            onClick={handleCompute}
            className="mt-2 w-full rounded-sm bg-mint px-3 py-1.5 font-mono text-[11px] font-semibold text-bg hover:bg-mint/80"
          >
            {t('slotCalc.computeSlot')}
          </button>

          {error && (
            <div className="mt-2 rounded-sm border border-call-red/30 bg-call-red/5 px-2.5 py-1.5 text-[10px] text-call-red">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-col p-5">
        <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.22em] text-fg-mute">
          {t('slotCalc.computedSlot')}
        </div>
        {computedSlot ? (
          <div className="flex items-center gap-2 rounded-sm border border-line bg-bg px-3 py-2 font-mono text-[12px] text-mint">
            <span className="flex-1 break-all">{computedSlot}</span>
            <CopyBtn text={computedSlot} />
          </div>
        ) : (
          <div className="rounded-sm border border-line-soft bg-surface px-3 py-2 font-ui text-[11px] text-fg-mute">
            {t('slotCalc.computeHint')}
          </div>
        )}

        <div className="mt-6 mb-1 font-mono text-[9px] uppercase tracking-[0.22em] text-fg-mute">
          {t('slotCalc.encodeValue')}
        </div>
        <div className="space-y-2 font-mono text-[11px]">
          <input
            value={valueToEncode}
            onChange={(e) => setValueToEncode(e.target.value)}
            placeholder={t('slotCalc.valuePlaceholder')}
            className="w-full rounded-sm border border-line bg-bg px-2 py-1 text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
          />
          <button
            onClick={handleEncodeValue}
            className="rounded-sm border border-line px-3 py-1 text-[10px] text-fg-dim hover:bg-surface-2"
          >
            {t('slotCalc.encode')}
          </button>
          {encodedValue && (
            <div className="flex items-center gap-2 rounded-sm border border-line bg-bg px-3 py-2 text-[11px] text-fg">
              <span className="flex-1 break-all">{encodedValue}</span>
              <CopyBtn text={encodedValue} />
            </div>
          )}
        </div>

        <div className="mt-6 rounded-sm border border-line-soft bg-surface p-3 font-ui text-[11px] leading-relaxed text-fg-dim">
          <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.22em] text-fg-mute">
            {t('slotCalc.tips')}
          </div>
          {t('slotCalc.manualTips')}
        </div>
      </div>
    </div>
  );
};

// ==================== Layout JSON mode ====================

const LayoutJsonMode: React.FC = () => {
  const { t } = useTranslation();
  const [raw, setRaw] = useState('');
  const [vars, setVars] = useState<LayoutVar[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LayoutVar | null>(null);
  const [keys, setKeys] = useState<string[]>(['']);
  const [computedSlot, setComputedSlot] = useState<string | null>(null);
  const [computeError, setComputeError] = useState<string | null>(null);

  const handleParse = () => {
    setError(null);
    const result = parseLayoutJson(raw);
    if ('error' in result) {
      setError(result.error);
      setVars(null);
    } else {
      setVars(result);
      setSelected(null);
      setComputedSlot(null);
    }
  };

  const expectedKeyCount = useMemo(() => {
    if (!selected) return 0;
    let c = 0;
    let rest = selected.type;
    while (rest.startsWith('mapping')) {
      const m = rest.match(/^mapping\s*\(\s*(.+?)\s*=>\s*(.+?)\s*\)$/);
      if (!m) break;
      c++;
      rest = m[2].trim();
    }
    return c;
  }, [selected]);

  const handleCompute = () => {
    if (!selected) return;
    setComputeError(null);
    try {
      if (expectedKeyCount > 0) {
        const usedKeys = keys.slice(0, expectedKeyCount).map((k) => k.trim());
        if (usedKeys.some((k) => !k)) {
          setComputeError(t('slotCalc.fillAllKeys'));
          return;
        }
        const result = calculateMappingSlot(
          { name: selected.label, type: selected.type, slot: selected.slot },
          usedKeys
        );
        setComputedSlot(result.slot);
      } else {
        setComputedSlot(toBeHex(selected.slot, 32));
      }
    } catch (e) {
      setComputeError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="grid flex-1 min-h-0" style={{ gridTemplateColumns: '2fr 3fr' }}>
      <div className="flex min-h-0 flex-col border-r border-line p-5">
        <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.22em] text-fg-mute">
          {t('slotCalc.jsonInput')}
        </div>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={t('slotCalc.jsonPlaceholder')}
          className="mb-2 min-h-[180px] flex-1 resize-none rounded-sm border border-line bg-bg px-2 py-1.5 font-mono text-[10.5px] text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
        />
        <button
          onClick={handleParse}
          className="rounded-sm bg-mint px-3 py-1.5 font-mono text-[11px] font-semibold text-bg hover:bg-mint/80"
        >
          {t('slotCalc.parseLayout')}
        </button>
        {error && (
          <div className="mt-2 rounded-sm border border-call-red/30 bg-call-red/5 px-2.5 py-1.5 font-mono text-[10px] text-call-red">
            {error}
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-col overflow-y-auto p-5">
        {!vars ? (
          <div className="rounded-sm border border-line-soft bg-surface p-4 font-ui text-[11px] text-fg-mute">
            {t('slotCalc.jsonHint')}
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px]">
              <span className="uppercase tracking-[0.22em] text-fg-mute">
                {t('slotCalc.variables')}
              </span>
              <span className="text-fg-mute">·</span>
              <span className="text-fg">{vars.length}</span>
            </div>
            <div className="mb-4 max-h-[200px] overflow-y-auto rounded-sm border border-line bg-bg">
              {vars.map((v, i) => (
                <div
                  key={i}
                  onClick={() => {
                    setSelected(v);
                    setKeys(['']);
                    setComputedSlot(null);
                    setComputeError(null);
                  }}
                  className={
                    'cursor-pointer border-b border-line-soft px-3 py-1.5 font-mono text-[11px] last:border-b-0 ' +
                    (selected === v ? 'bg-mint/5 text-mint' : 'hover:bg-surface-2')
                  }
                >
                  <span className="text-fg">{v.label}</span>
                  <span className="ml-2 text-fg-mute">{v.type}</span>
                  <span className="ml-2 text-[9px] text-fg-mute">
                    slot {v.slot}
                    {v.offset > 0 ? ` · offset ${v.offset}` : ''}
                  </span>
                </div>
              ))}
            </div>

            {selected && (
              <>
                <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.22em] text-fg-mute">
                  {t('slotCalc.compute')} — {selected.label}
                </div>
                {expectedKeyCount > 0 ? (
                  <div className="mb-2 space-y-1 font-mono text-[11px]">
                    {Array.from({ length: expectedKeyCount }).map((_, i) => (
                      <input
                        key={i}
                        value={keys[i] ?? ''}
                        onChange={(e) => {
                          const next = [...keys];
                          next[i] = e.target.value;
                          setKeys(next);
                        }}
                        placeholder={`key[${i}]`}
                        className="w-full rounded-sm border border-line bg-bg px-2 py-1 text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="mb-2 font-mono text-[10px] text-fg-mute">
                    {t('slotCalc.simpleVar')}
                  </div>
                )}
                <button
                  onClick={handleCompute}
                  className="mb-2 rounded-sm bg-mint px-3 py-1.5 font-mono text-[11px] font-semibold text-bg hover:bg-mint/80"
                >
                  {t('slotCalc.computeSlot')}
                </button>
                {computeError && (
                  <div className="rounded-sm border border-call-red/30 bg-call-red/5 px-2.5 py-1.5 font-mono text-[10px] text-call-red">
                    {computeError}
                  </div>
                )}
                {computedSlot && (
                  <div className="flex items-center gap-2 rounded-sm border border-line bg-bg px-3 py-2 font-mono text-[12px] text-mint">
                    <span className="flex-1 break-all">{computedSlot}</span>
                    <CopyBtn text={computedSlot} />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ==================== Probe mode ====================

const ProbeMode: React.FC<{ rpcUrl: string }> = ({ rpcUrl }) => {
  const { t } = useTranslation();
  const [contract, setContract] = useState('');
  const [fromSlot, setFromSlot] = useState('0');
  const [toSlot, setToSlot] = useState('10');
  const [rows, setRows] = useState<Array<{ slot: string; value: string }>>([]);
  const [viewAs, setViewAs] = useState<Record<number, ProbeType>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async () => {
    if (!rpcUrl) {
      setError(t('slotCalc.noRpc'));
      return;
    }
    if (!contract.trim()) {
      setError(t('slotCalc.enterContract'));
      return;
    }
    const from = parseInt(fromSlot, 10);
    const to = parseInt(toSlot, 10);
    if (isNaN(from) || isNaN(to) || from < 0 || to < from || to - from > 100) {
      setError(t('slotCalc.invalidRange'));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const provider = new JsonRpcProvider(rpcUrl);
      const results: Array<{ slot: string; value: string }> = [];
      for (let i = from; i <= to; i++) {
        const slotHex = toBeHex(i, 32);
        const value = await provider.send('eth_getStorageAt', [contract.trim(), slotHex, 'latest']);
        results.push({ slot: slotHex, value });
      }
      setRows(results);
      setViewAs({});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const renderValue = (raw: string, type: ProbeType): string => {
    const h = raw.startsWith('0x') ? raw.slice(2) : raw;
    switch (type) {
      case 'hex':
        return raw;
      case 'uint':
        try { return BigInt('0x' + h).toString(); } catch { return raw; }
      case 'address':
        return '0x' + h.slice(-40);
      case 'bool':
        return h.replace(/^0+/, '') === '' ? 'false' : 'true';
    }
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col p-5">
      <div className="mb-3 flex items-end gap-3 font-mono text-[11px]">
        <div className="flex-1">
          <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.22em] text-fg-mute">
            {t('slotCalc.contract')}
          </div>
          <input
            value={contract}
            onChange={(e) => setContract(e.target.value)}
            placeholder="0x..."
            className="w-full rounded-sm border border-line bg-bg px-2 py-1 text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
          />
        </div>
        <div>
          <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.22em] text-fg-mute">
            {t('slotCalc.fromSlot')}
          </div>
          <input
            value={fromSlot}
            onChange={(e) => setFromSlot(e.target.value)}
            className="w-20 rounded-sm border border-line bg-bg px-2 py-1 text-fg focus:border-mint focus:outline-none"
          />
        </div>
        <div>
          <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.22em] text-fg-mute">
            {t('slotCalc.toSlot')}
          </div>
          <input
            value={toSlot}
            onChange={(e) => setToSlot(e.target.value)}
            className="w-20 rounded-sm border border-line bg-bg px-2 py-1 text-fg focus:border-mint focus:outline-none"
          />
        </div>
        <button
          onClick={handleFetch}
          disabled={loading}
          className="rounded-sm bg-mint px-4 py-1.5 font-mono text-[11px] font-semibold text-bg hover:bg-mint/80 disabled:opacity-50"
        >
          {loading ? t('slotCalc.fetching') : t('slotCalc.fetchSlots')}
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-sm border border-call-red/30 bg-call-red/5 px-2.5 py-1.5 font-mono text-[11px] text-call-red">
          {error}
        </div>
      )}

      {rows.length > 0 ? (
        <div className="flex-1 overflow-y-auto rounded-sm border border-line bg-bg font-mono text-[11px]">
          {rows.map((r, i) => {
            const type = viewAs[i] ?? 'hex';
            const isZero = /^0x0*$/.test(r.value);
            return (
              <div
                key={i}
                className="flex items-center gap-3 border-b border-line-soft px-3 py-1.5 last:border-b-0"
              >
                <span className="w-[210px] truncate text-fg-mute" title={r.slot}>
                  {r.slot}
                </span>
                <div className="flex gap-0.5">
                  {(['hex', 'uint', 'address', 'bool'] as ProbeType[]).map((tp) => (
                    <button
                      key={tp}
                      onClick={() => setViewAs((prev) => ({ ...prev, [i]: tp }))}
                      className={
                        'rounded-xs px-1.5 py-0.5 text-[9px] ' +
                        (type === tp
                          ? 'bg-mint text-bg font-semibold'
                          : 'text-fg-mute hover:bg-surface-2')
                      }
                    >
                      {tp}
                    </button>
                  ))}
                </div>
                <span
                  className={
                    'flex-1 break-all ' +
                    (isZero ? 'text-fg-mute' : type === 'uint' ? 'text-mint' : 'text-fg')
                  }
                >
                  {renderValue(r.value, type)}
                </span>
                {!isZero && <CopyBtn text={r.value} />}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-center">
          <div>
            <div className="mb-3 font-mono text-[40px] text-fg-mute">◇</div>
            <p className="font-ui text-[12px] text-fg-mute">{t('slotCalc.probeHint')}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== Main page ====================

const SlotCalcPage: React.FC<SlotCalcPageProps> = ({ rpcUrl }) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('manual');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-line bg-bg px-5 py-2.5 font-mono text-[11px]">
        <span className="text-[10px] uppercase tracking-[0.2em] text-fg-mute">mode</span>
        <div className="flex gap-0.5">
          <ModeBtn active={mode === 'manual'} onClick={() => setMode('manual')}>
            {t('slotCalc.modeManual')}
          </ModeBtn>
          <ModeBtn active={mode === 'layout-json'} onClick={() => setMode('layout-json')}>
            {t('slotCalc.modeJson')}
          </ModeBtn>
          <ModeBtn active={mode === 'probe'} onClick={() => setMode('probe')}>
            {t('slotCalc.modeProbe')}
          </ModeBtn>
        </div>
        <span className="ml-auto text-[10px] text-fg-mute">
          {mode === 'manual' && t('slotCalc.manualSubtitle')}
          {mode === 'layout-json' && t('slotCalc.jsonSubtitle')}
          {mode === 'probe' && t('slotCalc.probeSubtitle')}
        </span>
      </div>
      {mode === 'manual' && <ManualMode />}
      {mode === 'layout-json' && <LayoutJsonMode />}
      {mode === 'probe' && <ProbeMode rpcUrl={rpcUrl} />}
    </div>
  );
};

export default SlotCalcPage;
