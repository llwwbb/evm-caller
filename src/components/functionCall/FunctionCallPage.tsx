import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ParsedFunction, CallHistory } from '../../types';
import { parseParamValue } from '../../utils/rpcCaller';

interface FunctionCallPageProps {
  rpcUrl: string;
  contractAddress: string;
  blockTag: string;
  onRpcUrlChange: (v: string) => void;
  onContractAddressChange: (v: string) => void;
  onBlockTagChange: (v: string) => void;
  onPresetsClick: () => void;
  functions: ParsedFunction[];
  selectedAbiNames: string[];
  callHistory: CallHistory[];
  onFunctionCall: (name: string, args: any[], func: ParsedFunction) => Promise<void>;
  onDeleteResult: (id: string) => void;
  onClearAll: () => void;
  isCallInProgress: boolean;
}

// Build a stable key for a function (handles overloads by including input types)
function fnKey(fn: ParsedFunction): string {
  return `${fn.name}(${fn.inputs.map((i) => i.type).join(',')})`;
}

const MUTABILITY_STYLE: Record<string, { bg: string; fg: string }> = {
  view:       { bg: 'rgba(96,165,250,0.12)',  fg: 'var(--blue)' },
  pure:       { bg: 'rgba(167,139,250,0.14)', fg: 'var(--violet)' },
  nonpayable: { bg: 'rgba(251,191,36,0.12)',  fg: 'var(--amber)' },
  payable:    { bg: 'rgba(74,222,128,0.12)',  fg: 'var(--emerald)' },
};

const MutabilityBadge: React.FC<{ mutability: string }> = ({ mutability }) => {
  const style = MUTABILITY_STYLE[mutability] ?? MUTABILITY_STYLE.view;
  return (
    <span
      className="rounded-xs px-1.5 py-0.5 text-[9px] font-bold tracking-[0.08em]"
      style={{ background: style.bg, color: style.fg }}
    >
      {mutability.toUpperCase()}
    </span>
  );
};

/** Tiny formatter — JSON.stringify that degrades gracefully for BigInt, etc. */
function stringifySafe(value: any): string {
  try {
    return JSON.stringify(
      value,
      (_k, v) => (typeof v === 'bigint' ? v.toString() : v),
      2
    );
  } catch {
    return String(value);
  }
}

const FunctionCallPage: React.FC<FunctionCallPageProps> = ({
  rpcUrl,
  contractAddress,
  blockTag,
  onRpcUrlChange,
  onContractAddressChange,
  onBlockTagChange,
  onPresetsClick,
  functions,
  selectedAbiNames,
  callHistory,
  onFunctionCall,
  onDeleteResult,
  onClearAll,
  isCallInProgress,
}) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // arg values kept per function key so switching doesn't lose in-progress input
  const [argValuesByFn, setArgValuesByFn] = useState<Record<string, string[]>>({});
  const [callError, setCallError] = useState<string | null>(null);

  const filteredFns = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return functions;
    return functions.filter((f) => f.name.toLowerCase().includes(q));
  }, [filter, functions]);

  const selectedFn = useMemo(
    () => functions.find((f) => fnKey(f) === selectedKey) ?? null,
    [functions, selectedKey]
  );

  const getArgValues = (fn: ParsedFunction): string[] => {
    const k = fnKey(fn);
    return argValuesByFn[k] ?? fn.inputs.map(() => '');
  };

  const setArgValue = (fn: ParsedFunction, idx: number, value: string) => {
    const k = fnKey(fn);
    setArgValuesByFn((prev) => {
      const cur = prev[k] ?? fn.inputs.map(() => '');
      const next = [...cur];
      next[idx] = value;
      return { ...prev, [k]: next };
    });
  };

  const handleCall = async () => {
    if (!selectedFn) return;
    setCallError(null);
    try {
      const raw = getArgValues(selectedFn);
      const parsed = selectedFn.inputs.map((input, i) => {
        // empty string fine for zero-arg; otherwise must parse
        if (selectedFn.inputs.length === 0) return undefined;
        return parseParamValue(raw[i] ?? '', input.type);
      });
      await onFunctionCall(selectedFn.name, parsed, selectedFn);
    } catch (err) {
      setCallError(err instanceof Error ? err.message : String(err));
    }
  };

  const hasConfig = !!rpcUrl.trim() && !!contractAddress.trim();
  const canCall = hasConfig && !!selectedFn && !isCallInProgress;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Editable input bar */}
      <div className="flex items-center gap-3 border-b border-line bg-bg px-5 py-2.5 font-mono text-[11px]">
        <span className="text-[10px] uppercase tracking-[0.2em] text-fg-mute">rpc</span>
        <input
          value={rpcUrl}
          onChange={(e) => onRpcUrlChange(e.target.value)}
          placeholder="https://..."
          className="w-[240px] min-w-0 flex-shrink rounded-sm border border-line bg-bg px-2 py-1 text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
        />
        <span className="text-line">/</span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-fg-mute">contract</span>
        <input
          value={contractAddress}
          onChange={(e) => onContractAddressChange(e.target.value)}
          placeholder="0x..."
          className="w-[360px] min-w-0 flex-shrink rounded-sm border border-line bg-bg px-2 py-1 text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
        />
        <span className="text-line">/</span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-fg-mute">block</span>
        <input
          value={blockTag}
          onChange={(e) => onBlockTagChange(e.target.value)}
          placeholder="latest"
          className="w-[92px] rounded-sm border border-line bg-bg px-2 py-1 text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
        />
        <span className="text-line">/</span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-fg-mute">abis</span>
        <span className="text-mint">{selectedAbiNames.length}</span>
        <button
          onClick={onPresetsClick}
          className="ml-auto rounded-sm border border-line px-2.5 py-1 text-[10px] text-fg-dim hover:bg-surface-2"
        >
          {t('topnav.presets')}
        </button>
      </div>

      {functions.length === 0 ? (
        <div className="flex flex-1 min-h-0 items-center justify-center text-center">
          <div>
            <div className="mb-3 font-mono text-[40px] text-fg-mute">◇</div>
            <p className="font-ui text-[13px] text-fg-dim">
              {t('functionCall.noAbiSelected')}
            </p>
            <button
              onClick={onPresetsClick}
              className="mt-4 rounded-sm border border-mint px-3 py-1.5 font-mono text-[11px] text-mint hover:bg-mint/10"
            >
              {t('functionCall.selectAbi')}
            </button>
          </div>
        </div>
      ) : (
        <div
          className="grid flex-1 min-h-0"
          style={{ gridTemplateColumns: '2fr 3fr' }}
        >
          {/* LEFT: function list */}
          <div className="flex min-h-0 flex-col border-r border-line">
            <div className="flex items-center gap-2 border-b border-line px-4 py-2 font-mono text-[10px]">
              <span className="uppercase tracking-[0.22em] text-fg-mute">
                {t('functionCall.functions')}
              </span>
              <span className="text-fg-mute">·</span>
              <span className="text-fg">{functions.length}</span>
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t('functionCall.searchFunctions')}
                className="ml-auto w-40 rounded-sm border border-line bg-bg px-2 py-0.5 font-ui text-[11px] text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredFns.length === 0 ? (
                <div className="p-4 font-ui text-[12px] text-fg-mute">
                  {t('functionCall.noMatchingFunctions')}
                </div>
              ) : (
                filteredFns.map((fn) => {
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
                })
              )}
            </div>
          </div>

          {/* RIGHT: function form (if selected) + always-visible global history */}
          <div className="flex min-h-0 min-w-0 flex-col">
            {selectedFn ? (
              <div className="border-b border-line bg-bg px-5 py-4">
                <div className="mb-3 flex flex-wrap items-center gap-2 font-mono text-[11px]">
                  <MutabilityBadge mutability={selectedFn.stateMutability} />
                  <span className="text-fg">{selectedFn.name}</span>
                  <span className="text-fg-dim">
                    ({selectedFn.inputs.map((i) => i.type).join(', ')})
                  </span>
                  {selectedFn.outputs.length > 0 && (
                    <span className="text-fg-dim">
                      →{' '}
                      {selectedFn.outputs
                        .map((o) => (o.name ? `${o.type} ${o.name}` : o.type))
                        .join(', ')}
                    </span>
                  )}
                </div>

                {selectedFn.inputs.length > 0 && (
                  <div className="space-y-2">
                    {selectedFn.inputs.map((input, i) => {
                      const values = getArgValues(selectedFn);
                      return (
                        <div
                          key={i}
                          className="grid grid-cols-[120px_1fr] items-center gap-3"
                        >
                          <div className="font-mono text-[10px]">
                            <div className="text-fg">{input.name || `arg${i}`}</div>
                            <div className="text-[9px] text-fg-dim">{input.type}</div>
                          </div>
                          <input
                            value={values[i] ?? ''}
                            onChange={(e) => setArgValue(selectedFn, i, e.target.value)}
                            placeholder={input.type}
                            className="rounded-sm border border-line bg-bg px-2 py-1 font-mono text-[11px] text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={handleCall}
                    disabled={!canCall}
                    className="rounded-sm bg-mint px-4 py-1.5 font-mono text-[11px] font-semibold text-bg hover:bg-mint/80 disabled:bg-line disabled:text-fg-mute"
                  >
                    {isCallInProgress
                      ? t('functionCall.calling')
                      : selectedFn.stateMutability === 'nonpayable' ||
                        selectedFn.stateMutability === 'payable'
                      ? t('functionCall.simulate')
                      : t('functionCall.call')}
                  </button>
                  {!hasConfig && (
                    <span className="font-mono text-[10px] text-fg-dim">
                      {t('functionCall.missingConfig')}
                    </span>
                  )}
                  {callError && (
                    <span className="font-mono text-[10px] text-call-red">
                      {callError}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="border-b border-line bg-bg px-5 py-4 font-ui text-[12px] text-fg-dim">
                {t('functionCall.selectFunctionHint')}
              </div>
            )}

            {/* Global call history — always visible */}
            <div className="flex items-center gap-2 border-b border-line px-5 py-2 font-mono text-[10px]">
              <span className="uppercase tracking-[0.22em] text-fg-dim">
                {t('functionCall.recentCalls')}
              </span>
              <span className="text-fg-mute">·</span>
              <span className="text-fg">{callHistory.length}</span>
              {callHistory.length > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm(t('functionCall.confirmClearAll'))) {
                      onClearAll();
                    }
                  }}
                  className="ml-auto rounded-sm border border-line px-2 py-0.5 text-[10px] text-fg-dim hover:bg-surface-2 hover:text-fg"
                >
                  {t('functionCall.clearAll')}
                </button>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {callHistory.length === 0 ? (
                <div className="p-5 font-ui text-[12px] text-fg-dim">
                  {t('functionCall.noRecentCalls')}
                </div>
              ) : (
                callHistory.map((item) => {
                  const success = item.result.success;
                  return (
                    <div key={item.id} className="border-b border-line-soft">
                      <div className="flex items-center gap-2 bg-surface px-5 py-2 font-mono text-[10px]">
                        <span
                          className={
                            'rounded-xs px-1.5 py-0.5 text-[9px] font-bold tracking-[0.08em] ' +
                            (success
                              ? 'bg-mint/15 text-mint'
                              : 'bg-call-red/15 text-call-red')
                          }
                        >
                          {success ? 'OK' : 'ERR'}
                        </span>
                        <span className="text-fg">{item.functionName}</span>
                        <span className="text-fg-dim">
                          · {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                        {item.rpcName && (
                          <span className="text-fg-dim">· {item.rpcName}</span>
                        )}
                        {item.blockTag !== undefined && (
                          <span className="text-fg-dim">· block {item.blockTag}</span>
                        )}
                        <button
                          onClick={() => onDeleteResult(item.id)}
                          className="ml-auto rounded-sm px-1.5 text-fg-dim hover:bg-surface-2 hover:text-fg"
                        >
                          ×
                        </button>
                      </div>
                      <div className="bg-surface-2 px-5 py-3 font-mono text-[10.5px] leading-[1.55]">
                        {item.args.length > 0 && (
                          <>
                            <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.22em] text-fg-dim">
                              {t('functionCall.args')}
                            </div>
                            <pre className="mb-3 whitespace-pre-wrap break-all rounded-sm border border-line-soft bg-bg px-2.5 py-2 text-[10.5px] text-fg">
                              {stringifySafe(item.args)}
                            </pre>
                          </>
                        )}
                        <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.22em] text-fg-dim">
                          {success ? t('functionCall.result') : t('functionCall.error')}
                        </div>
                        {success ? (
                          <pre className="whitespace-pre-wrap break-all rounded-sm border border-line-soft bg-bg px-2.5 py-2 text-[10.5px] text-fg">
                            {stringifySafe(item.result.data)}
                          </pre>
                        ) : (
                          <div className="rounded-sm border border-call-red/30 bg-call-red/5 px-2.5 py-2 text-[11px] text-call-red">
                            {item.result.error}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FunctionCallPage;
