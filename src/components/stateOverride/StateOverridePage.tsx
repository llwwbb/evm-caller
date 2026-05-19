import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { JsonRpcProvider } from 'ethers';
import {
  AccountOverrideConfig,
  StateOverride,
  StateOverridePreset,
  ParsedFunction,
  ParsedCallTrace,
  CallTrace,
} from '../../types';
import { parseAbi } from '../../utils/abiParser';
import { parseParamValue } from '../../utils/rpcCaller';
import { parseTraceWithAbi } from '../../utils/debugTrace';
import {
  executeBatch,
  BatchCall,
  BatchExecutionResult,
} from '../../utils/multiCall';
import {
  loadContractPresets,
  loadStateOverridePresets,
  saveStateOverridePreset,
  deleteStateOverridePreset,
} from '../../utils/presetStorage';
import { buildAddressNameLookup } from '../../utils/addressDisplay';
import StatsRibbon, { StatCell } from '../layout/StatsRibbon';
import CallTree from '../debugTrace/CallTree';
import NodeStack from '../debugTrace/NodeStack';
import { usePinStack } from '../../hooks/usePinStack';

interface StateOverridePageProps {
  rpcUrl: string;
  mergedAbi: string;
  showAddressNames: boolean;
  presetRefreshTrigger: number;
  currentChainId: number | null;
}

interface CallDraft {
  id: string;
  contractAddress: string;
  fnKey: string;           // stable key from fnKey(pf)
  argValues: string[];     // raw input strings
  allowFailure: boolean;
}

function cid(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function fnKey(fn: ParsedFunction): string {
  return `${fn.name}(${fn.inputs.map((i) => i.type).join(',')})`;
}

function stringifySafe(v: any): string {
  try {
    return JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x), 2);
  } catch {
    return String(v);
  }
}

function countOverrideSlots(acc: AccountOverrideConfig): number {
  return Object.keys(acc.override.state ?? {}).length + Object.keys(acc.override.stateDiff ?? {}).length;
}

// ===== Default from-address (Vitalik's canonical test address — has no practical meaning beyond "a known EOA") =====
const DEFAULT_FROM = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

const StateOverridePage: React.FC<StateOverridePageProps> = ({
  rpcUrl,
  mergedAbi,
  showAddressNames,
  presetRefreshTrigger,
  currentChainId,
}) => {
  const { t } = useTranslation();

  const [rpcMethod, setRpcMethod] = useState<'eth_call' | 'debug_traceCall'>('eth_call');
  const [fromAddress, setFromAddress] = useState(DEFAULT_FROM);
  const [accounts, setAccounts] = useState<AccountOverrideConfig[]>([]);
  const [selectedAccountIdx, setSelectedAccountIdx] = useState<number>(-1);
  const [calls, setCalls] = useState<CallDraft[]>([]);
  const [expandedCallIdx, setExpandedCallIdx] = useState<number>(-1);
  const [result, setResult] = useState<BatchExecutionResult | null>(null);
  const [parsedTrace, setParsedTrace] = useState<ParsedCallTrace | null>(null);
  const [expandedTracePaths, setExpandedTracePaths] = useState<Set<string>>(new Set(['0']));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Presets
  const [presets, setPresets] = useState<StateOverridePreset[]>([]);
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetName, setPresetName] = useState('');

  // Address name map (for trace display)
  const [addressNameMap, setAddressNameMap] = useState(() => buildAddressNameLookup([], null));

  const pin = usePinStack();

  // Parsed functions from mergedAbi
  const parsedFunctions = useMemo<ParsedFunction[]>(() => {
    if (!mergedAbi) return [];
    try {
      return parseAbi(JSON.parse(mergedAbi), true);
    } catch {
      return [];
    }
  }, [mergedAbi]);

  useEffect(() => {
    setPresets(loadStateOverridePresets());
  }, []);

  useEffect(() => {
    setAddressNameMap(buildAddressNameLookup(loadContractPresets(), currentChainId));
  }, [presetRefreshTrigger, currentChainId]);

  // ==================== Account override management ====================

  const handleAddAccount = () => {
    const next: AccountOverrideConfig = { address: '', override: {} };
    setAccounts([...accounts, next]);
    setSelectedAccountIdx(accounts.length);
  };

  const handleDeleteAccount = (idx: number) => {
    const next = accounts.filter((_, i) => i !== idx);
    setAccounts(next);
    if (selectedAccountIdx === idx) setSelectedAccountIdx(-1);
    else if (selectedAccountIdx > idx) setSelectedAccountIdx(selectedAccountIdx - 1);
  };

  const updateSelectedAccount = (partial: Partial<AccountOverrideConfig>) => {
    if (selectedAccountIdx < 0) return;
    setAccounts((prev) =>
      prev.map((a, i) => (i === selectedAccountIdx ? { ...a, ...partial } : a))
    );
  };

  const updateOverride = (partial: Partial<StateOverride>) => {
    if (selectedAccountIdx < 0) return;
    setAccounts((prev) =>
      prev.map((a, i) =>
        i === selectedAccountIdx ? { ...a, override: { ...a.override, ...partial } } : a
      )
    );
  };

  const updateSlot = (oldSlot: string, newSlot: string, value: string) => {
    if (selectedAccountIdx < 0) return;
    const account = accounts[selectedAccountIdx];
    const state = { ...(account.override.state ?? {}) };
    if (oldSlot && oldSlot !== newSlot) delete state[oldSlot];
    if (newSlot) state[newSlot] = value;
    updateOverride({ state });
  };

  const deleteSlot = (slot: string) => {
    if (selectedAccountIdx < 0) return;
    const account = accounts[selectedAccountIdx];
    const state = { ...(account.override.state ?? {}) };
    delete state[slot];
    updateOverride({ state });
  };

  // ==================== Calls ====================

  const handleAddCall = () => {
    setCalls([
      ...calls,
      {
        id: cid(),
        contractAddress: '',
        fnKey: parsedFunctions[0] ? fnKey(parsedFunctions[0]) : '',
        argValues: parsedFunctions[0]?.inputs.map(() => '') ?? [],
        allowFailure: false,
      },
    ]);
    setExpandedCallIdx(calls.length);
  };

  const updateCall = (id: string, partial: Partial<CallDraft>) => {
    setCalls((prev) => prev.map((c) => (c.id === id ? { ...c, ...partial } : c)));
  };

  const deleteCall = (id: string) => {
    setCalls((prev) => prev.filter((c) => c.id !== id));
  };

  const setCallFn = (id: string, newFnKey: string) => {
    const fn = parsedFunctions.find((f) => fnKey(f) === newFnKey);
    if (!fn) return;
    updateCall(id, {
      fnKey: newFnKey,
      argValues: fn.inputs.map(() => ''),
    });
  };

  const updateCallArg = (id: string, argIdx: number, value: string) => {
    setCalls((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = [...c.argValues];
        next[argIdx] = value;
        return { ...c, argValues: next };
      })
    );
  };

  // ==================== Execute ====================

  const handleExecute = async () => {
    setError(null);
    setResult(null);
    setParsedTrace(null);
    pin.clearAll();

    if (!rpcUrl) {
      setError(t('stateOverride.noRpc'));
      return;
    }
    if (!mergedAbi) {
      setError(t('stateOverride.noAbi'));
      return;
    }
    if (calls.length === 0) {
      setError(t('stateOverride.noCalls'));
      return;
    }
    if (!fromAddress.trim()) {
      setError(t('stateOverride.noFromAddress'));
      return;
    }

    // Build BatchCalls
    const batchCalls: BatchCall[] = [];
    for (const draft of calls) {
      const fn = parsedFunctions.find((f) => fnKey(f) === draft.fnKey);
      if (!fn) {
        setError(t('stateOverride.callFunctionMissing', { key: draft.fnKey }));
        return;
      }
      if (!draft.contractAddress.trim()) {
        setError(t('stateOverride.callContractMissing'));
        return;
      }
      let parsedArgs: any[];
      try {
        parsedArgs = fn.inputs.map((inp, i) => parseParamValue(draft.argValues[i] ?? '', inp.type));
      } catch (e) {
        setError(`call "${fn.name}": ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
      batchCalls.push({
        contractAddress: draft.contractAddress.trim(),
        functionName: fn.name,
        args: parsedArgs,
        allowFailure: draft.allowFailure,
      });
    }

    // Build state-override map
    const stateOverride: Record<string, StateOverride> = {};
    for (const a of accounts) {
      if (!a.address.trim()) continue;
      stateOverride[a.address.trim()] = a.override;
    }

    setLoading(true);
    try {
      const provider = new JsonRpcProvider(rpcUrl);
      const res = await executeBatch(
        provider,
        mergedAbi,
        batchCalls,
        fromAddress.trim(),
        'latest',
        stateOverride,
        rpcMethod
      );
      setResult(res);
      if (res.success && res.trace) {
        try {
          const parsed = parseTraceWithAbi(res.trace as CallTrace, [mergedAbi]);
          setParsedTrace(parsed);
          setExpandedTracePaths(new Set(['0']));
        } catch (e) {
          console.error('parse trace failed:', e);
          setParsedTrace(res.trace as ParsedCallTrace);
        }
      }
      if (!res.success) setError(res.error ?? 'execution failed');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // ==================== Preset management ====================

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    saveStateOverridePreset(presetName.trim(), accounts);
    setPresets(loadStateOverridePresets());
    setPresetName('');
    setSavingPreset(false);
  };

  const handleLoadPreset = (preset: StateOverridePreset) => {
    setAccounts(preset.accounts);
    setSelectedAccountIdx(preset.accounts.length > 0 ? 0 : -1);
  };

  const handleDeletePreset = (id: string) => {
    if (window.confirm(t('stateOverride.confirmDeletePreset'))) {
      deleteStateOverridePreset(id);
      setPresets(loadStateOverridePresets());
    }
  };

  // ==================== Stats ====================

  const totalSlots = accounts.reduce((n, a) => n + countOverrideSlots(a), 0);
  const stats: StatCell[] = [
    { label: t('stateOverride.statCalls'), value: calls.length },
    {
      label: t('stateOverride.statAccounts'),
      value: accounts.filter((a) => a.address.trim()).length,
    },
    { label: t('stateOverride.statSlots'), value: totalSlots },
  ];

  // ==================== Trace helpers (debug_traceCall) ====================

  const getNodeByPath = (path: string): ParsedCallTrace | null => {
    if (!parsedTrace) return null;
    if (path === '0') return parsedTrace;
    const parts = path.split('-').slice(1).map(Number);
    let node: ParsedCallTrace | undefined = parsedTrace;
    for (const i of parts) {
      if (!node?.calls || i < 0 || i >= node.calls.length) return null;
      node = node.calls[i];
    }
    return node ?? null;
  };

  const handleToggleExpand = (path: string) => {
    setExpandedTracePaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const selectedAccount = selectedAccountIdx >= 0 ? accounts[selectedAccountIdx] : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Control bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-bg px-5 py-2.5 font-mono text-[13px]">
        <span className="text-[12px] uppercase tracking-[0.2em] text-fg-mute">method</span>
        <div className="flex gap-0.5">
          <button
            onClick={() => setRpcMethod('eth_call')}
            className={
              'rounded-sm px-2 py-0.5 text-[12px] ' +
              (rpcMethod === 'eth_call'
                ? 'bg-mint font-semibold text-bg'
                : 'text-fg-dim hover:bg-surface-2')
            }
          >
            eth_call
          </button>
          <button
            onClick={() => setRpcMethod('debug_traceCall')}
            className={
              'rounded-sm px-2 py-0.5 text-[12px] ' +
              (rpcMethod === 'debug_traceCall'
                ? 'bg-mint font-semibold text-bg'
                : 'text-fg-dim hover:bg-surface-2')
            }
          >
            debug_traceCall
          </button>
        </div>
        <span className="text-line">/</span>
        <span className="text-[12px] uppercase tracking-[0.2em] text-fg-mute">from</span>
        <input
          value={fromAddress}
          onChange={(e) => setFromAddress(e.target.value)}
          placeholder="0x..."
          className="w-[360px] rounded-sm border border-line bg-bg px-2 py-1 text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
        />
        <button
          onClick={handleExecute}
          disabled={loading}
          className="ml-auto rounded-sm bg-mint px-4 py-1.5 font-mono text-[13px] font-semibold text-bg hover:bg-mint/80 disabled:opacity-50"
        >
          {loading ? t('stateOverride.executing') : t('stateOverride.execute')}
        </button>
      </div>

      <StatsRibbon stats={stats} />

      {error && (
        <div className="border-b border-line bg-call-red/5 px-5 py-2 font-mono text-[13px] text-call-red">
          {error}
        </div>
      )}

      <div className="grid flex-1 min-h-0" style={{ gridTemplateColumns: '2fr 3fr' }}>
        {/* LEFT: account overrides */}
        <div className="flex min-h-0 flex-col border-r border-line">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2 font-mono text-[12px]">
            <span className="uppercase tracking-[0.22em] text-fg-mute">
              {t('stateOverride.accounts')}
            </span>
            <span className="text-fg-mute">·</span>
            <span className="text-fg">{accounts.length}</span>
            <button
              onClick={handleAddAccount}
              className="ml-auto rounded-sm px-2 py-0.5 text-[12px] text-fg-dim hover:bg-surface-2"
            >
              + add
            </button>
          </div>

          <div className="flex-shrink-0 overflow-y-auto" style={{ maxHeight: '30%' }}>
            {accounts.length === 0 ? (
              <div className="p-5 font-ui text-[13px] text-fg-mute">
                {t('stateOverride.noAccountsHint')}
              </div>
            ) : (
              accounts.map((a, i) => {
                const slotsN = countOverrideSlots(a);
                const parts: string[] = [];
                if (a.override.balance !== undefined) parts.push('balance');
                if (a.override.nonce !== undefined) parts.push('nonce');
                if (a.override.code !== undefined) parts.push('code');
                if (slotsN > 0) parts.push(`${slotsN} slot${slotsN !== 1 ? 's' : ''}`);
                return (
                  <div
                    key={i}
                    onClick={() => setSelectedAccountIdx(i)}
                    className={
                      'cursor-pointer border-b border-line-soft px-4 py-2 font-mono text-[13px] ' +
                      (selectedAccountIdx === i
                        ? 'border-l-2 border-l-mint bg-mint/5 pl-[14px]'
                        : 'border-l-2 border-l-transparent pl-[14px] hover:bg-surface-2')
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate text-fg">
                        {a.address || t('stateOverride.emptyAddress')}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAccount(i);
                        }}
                        className="rounded-sm px-1.5 text-fg-mute hover:bg-surface-2"
                      >
                        ×
                      </button>
                    </div>
                    {parts.length > 0 && (
                      <div className="mt-0.5 text-[12px] text-fg-mute">
                        {parts.join(' · ')}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-line">
            {selectedAccount ? (
              <div className="space-y-3 p-5 font-mono text-[13px]">
                <div className="grid grid-cols-[80px_1fr] items-center gap-3">
                  <span className="text-fg-mute">address</span>
                  <input
                    value={selectedAccount.address}
                    onChange={(e) => updateSelectedAccount({ address: e.target.value })}
                    placeholder="0x..."
                    className="rounded-sm border border-line bg-bg px-2 py-1 text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-[80px_1fr] items-center gap-3">
                  <span className="text-fg-mute">balance</span>
                  <input
                    value={selectedAccount.override.balance ?? ''}
                    onChange={(e) =>
                      updateOverride({ balance: e.target.value || undefined })
                    }
                    placeholder="0x... (wei, hex)"
                    className="rounded-sm border border-line bg-bg px-2 py-1 text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-[80px_1fr] items-center gap-3">
                  <span className="text-fg-mute">nonce</span>
                  <input
                    value={selectedAccount.override.nonce ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateOverride({ nonce: v === '' ? undefined : parseInt(v, 10) });
                    }}
                    type="number"
                    className="rounded-sm border border-line bg-bg px-2 py-1 text-fg focus:border-mint focus:outline-none"
                  />
                </div>
                <div>
                  <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.22em] text-fg-mute">
                    code
                  </div>
                  <textarea
                    value={selectedAccount.override.code ?? ''}
                    onChange={(e) => updateOverride({ code: e.target.value || undefined })}
                    placeholder="0x... (runtime bytecode)"
                    rows={3}
                    className="w-full resize-none rounded-sm border border-line bg-bg px-2 py-1 font-mono text-[12px] text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
                  />
                </div>
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-fg-mute">
                      storage slots
                    </span>
                    <button
                      onClick={() => {
                        const state = { ...(selectedAccount.override.state ?? {}) };
                        state['0x0'] = '0x0';
                        updateOverride({ state });
                      }}
                      className="ml-auto rounded-sm px-2 py-0.5 text-[12px] text-fg-dim hover:bg-surface-2"
                    >
                      + slot
                    </button>
                  </div>
                  <div className="space-y-1">
                    {Object.entries(selectedAccount.override.state ?? {}).map(([slot, value]) => (
                      <div key={slot} className="flex items-center gap-2">
                        <input
                          value={slot}
                          onChange={(e) => updateSlot(slot, e.target.value, value)}
                          placeholder="slot (0x...)"
                          className="flex-1 rounded-sm border border-line bg-bg px-2 py-1 font-mono text-[12px] text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
                        />
                        <input
                          value={value}
                          onChange={(e) => updateSlot(slot, slot, e.target.value)}
                          placeholder="value (0x...)"
                          className="flex-1 rounded-sm border border-line bg-bg px-2 py-1 font-mono text-[12px] text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
                        />
                        <button
                          onClick={() => deleteSlot(slot)}
                          className="rounded-sm px-1.5 text-fg-mute hover:bg-surface-2"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5 font-ui text-[13px] text-fg-mute">
                {t('stateOverride.selectAccountHint')}
              </div>
            )}
          </div>

          {/* Preset management at bottom */}
          <div className="border-t border-line bg-surface p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-fg-mute">
                {t('stateOverride.presets')}
              </span>
              <button
                onClick={() => setSavingPreset(!savingPreset)}
                className="ml-auto rounded-sm px-2 py-0.5 font-mono text-[12px] text-fg-dim hover:bg-surface-2"
              >
                {savingPreset ? 'cancel' : '+ save'}
              </button>
            </div>
            {savingPreset && (
              <div className="mb-2 flex gap-2">
                <input
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder={t('stateOverride.presetNamePlaceholder')}
                  className="flex-1 rounded-sm border border-line bg-bg px-2 py-1 font-ui text-[13px] text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
                />
                <button
                  onClick={handleSavePreset}
                  className="rounded-sm bg-mint px-3 py-1 font-mono text-[12px] text-bg"
                >
                  save
                </button>
              </div>
            )}
            <div className="max-h-[120px] space-y-0.5 overflow-y-auto">
              {presets.length === 0 ? (
                <div className="font-ui text-[13px] text-fg-mute">
                  {t('stateOverride.noPresets')}
                </div>
              ) : (
                presets.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 rounded-sm bg-bg px-2 py-1 font-mono text-[13px]"
                  >
                    <span
                      className="flex-1 cursor-pointer truncate text-fg hover:text-mint"
                      onClick={() => handleLoadPreset(p)}
                    >
                      {p.name}
                    </span>
                    <button
                      onClick={() => handleDeletePreset(p.id)}
                      className="rounded-sm px-1 text-fg-mute hover:bg-surface-2"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: calls + result */}
        <div className="flex min-h-0 flex-col">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2 font-mono text-[12px]">
            <span className="uppercase tracking-[0.22em] text-fg-mute">
              {t('stateOverride.calls')}
            </span>
            <span className="text-fg-mute">·</span>
            <span className="text-fg">{calls.length}</span>
            <button
              onClick={handleAddCall}
              disabled={parsedFunctions.length === 0}
              className="ml-auto rounded-sm px-2 py-0.5 text-[12px] text-fg-dim hover:bg-surface-2 disabled:opacity-50"
            >
              + add call
            </button>
          </div>

          <div className="flex-shrink-0 overflow-y-auto" style={{ maxHeight: '50%' }}>
            {parsedFunctions.length === 0 ? (
              <div className="p-5 font-ui text-[14px] text-fg-mute">
                {t('stateOverride.noAbiHint')}
              </div>
            ) : calls.length === 0 ? (
              <div className="p-5 font-ui text-[14px] text-fg-mute">
                {t('stateOverride.noCallsHint')}
              </div>
            ) : (
              calls.map((c, idx) => {
                const fn = parsedFunctions.find((f) => fnKey(f) === c.fnKey);
                const expanded = expandedCallIdx === idx;
                return (
                  <div key={c.id} className="border-b border-line-soft">
                    <div
                      className="flex cursor-pointer items-center gap-2 px-5 py-2 font-mono text-[13px] hover:bg-surface-2"
                      onClick={() => setExpandedCallIdx(expanded ? -1 : idx)}
                    >
                      <span className="text-[12px] text-fg-mute">#{idx}</span>
                      <span className="rounded-xs bg-call-blue/12 px-1.5 py-0.5 text-[11px] font-bold tracking-[0.08em] text-call-blue">
                        CALL
                      </span>
                      <span className="truncate text-fg">
                        {fn ? `${fn.name}()` : c.fnKey || '—'}
                      </span>
                      <span className="truncate text-fg-mute">
                        {c.contractAddress || t('stateOverride.noContract')}
                      </span>
                      <span className="ml-auto flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCall(c.id);
                          }}
                          className="rounded-sm px-1.5 text-fg-mute hover:bg-surface-2"
                        >
                          ×
                        </button>
                        <span className="text-fg-mute">{expanded ? '▾' : '▸'}</span>
                      </span>
                    </div>
                    {expanded && (
                      <div className="space-y-2 bg-surface px-5 py-3 font-mono text-[12px]">
                        <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                          <span className="text-fg-mute">contract</span>
                          <input
                            value={c.contractAddress}
                            onChange={(e) => updateCall(c.id, { contractAddress: e.target.value })}
                            placeholder="0x..."
                            className="rounded-sm border border-line bg-bg px-2 py-1 text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                          <span className="text-fg-mute">function</span>
                          <select
                            value={c.fnKey}
                            onChange={(e) => setCallFn(c.id, e.target.value)}
                            className="rounded-sm border border-line bg-bg px-2 py-1 text-fg focus:border-mint focus:outline-none"
                          >
                            {parsedFunctions.map((f) => {
                              const k = fnKey(f);
                              return (
                                <option key={k} value={k}>
                                  {f.name}({f.inputs.map((i) => i.type).join(', ')})
                                </option>
                              );
                            })}
                          </select>
                        </div>
                        {fn && fn.inputs.length > 0 && (
                          <div>
                            <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.22em] text-fg-mute">
                              args
                            </div>
                            {fn.inputs.map((inp, i) => (
                              <div
                                key={i}
                                className="mb-1 grid grid-cols-[80px_1fr] items-center gap-2"
                              >
                                <span className="truncate text-fg-mute">
                                  {inp.name || `arg${i}`}
                                  <span className="ml-1 text-[11px]">({inp.type})</span>
                                </span>
                                <input
                                  value={c.argValues[i] ?? ''}
                                  onChange={(e) => updateCallArg(c.id, i, e.target.value)}
                                  placeholder={inp.type}
                                  className="rounded-sm border border-line bg-bg px-2 py-1 text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                        <label className="flex items-center gap-2 text-fg-dim">
                          <input
                            type="checkbox"
                            checked={c.allowFailure}
                            onChange={(e) => updateCall(c.id, { allowFailure: e.target.checked })}
                          />
                          {t('stateOverride.allowFailure')}
                        </label>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Result area */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-line">
            <div className="flex items-center gap-2 border-b border-line px-4 py-2 font-mono text-[12px]">
              <span className="uppercase tracking-[0.22em] text-fg-mute">
                {t('stateOverride.result')}
              </span>
            </div>
            {result && rpcMethod === 'eth_call' && result.results ? (
              <div className="flex flex-col gap-px bg-line">
                {result.results.map((r, i) => (
                  <div key={i} className="bg-surface px-5 py-3 font-mono text-[12px]">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="text-fg-mute">#{i}</span>
                      <span
                        className={
                          'rounded-xs px-1.5 py-0.5 text-[11px] font-bold tracking-[0.08em] ' +
                          (r.success
                            ? 'bg-mint/15 text-mint'
                            : 'bg-call-red/15 text-call-red')
                        }
                      >
                        {r.success ? 'OK' : 'ERR'}
                      </span>
                      <span className="text-fg">{r.call.functionName}()</span>
                    </div>
                    {r.success ? (
                      <pre className="whitespace-pre-wrap break-all rounded-sm border border-line-soft bg-bg px-2.5 py-2 text-[12px] text-fg">
                        {stringifySafe(r.data)}
                      </pre>
                    ) : (
                      <div className="rounded-sm border border-call-red/30 bg-call-red/5 px-2.5 py-2 text-call-red">
                        {r.error}
                        {r.returnData && r.returnData !== '0x' && (
                          <div className="mt-1 text-[12px] text-fg-dim">
                            return: {r.returnData}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : result && rpcMethod === 'debug_traceCall' && parsedTrace ? (
              <div
                className="grid min-h-0 flex-1"
                style={{ gridTemplateColumns: '1.4fr 1fr' }}
              >
                <div className="flex min-h-0 flex-col overflow-y-auto border-r border-line">
                  <CallTree
                    root={parsedTrace}
                    expandedPaths={expandedTracePaths}
                    selectedPath={pin.selectedPath}
                    pinnedPaths={pin.pinnedPaths}
                    addressNameMap={addressNameMap}
                    showAddressNames={showAddressNames}
                    onRowClick={pin.clickPath}
                    onToggleExpand={handleToggleExpand}
                  />
                </div>
                <NodeStack
                  cards={pin.cards}
                  selectedPath={pin.selectedPath}
                  pinnedPaths={pin.pinnedPaths}
                  collapsedPaths={pin.collapsedPaths}
                  getNodeByPath={getNodeByPath}
                  addressNameMap={addressNameMap}
                  showAddressNames={showAddressNames}
                  onTogglePin={pin.togglePin}
                  onClose={pin.closeCard}
                  onToggleCollapse={pin.toggleCollapse}
                  onCloseAll={pin.clearAll}
                />
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center p-5 text-center">
                <p className="font-ui text-[14px] text-fg-mute">
                  {t('stateOverride.resultHint')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StateOverridePage;
