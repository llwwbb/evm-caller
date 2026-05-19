import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ParsedFunction, CallHistory } from '../../types';
import { parseParamValue } from '../../utils/rpcCaller';
import { loadContractPresets } from '../../utils/presetStorage';
import { buildAddressNameLookup } from '../../utils/addressDisplay';
import DecodedValue from '../common/DecodedValue';
import AbiSelector from '../common/AbiSelector';
import TxBar from '../layout/TxBar';

interface FunctionCallPageProps {
  rpcUrl: string;
  contractAddress: string;
  blockTag: string;
  onRpcUrlChange: (v: string) => void;
  onContractAddressChange: (v: string) => void;
  onBlockTagChange: (v: string) => void;
  onPresetsClick: () => void;
  functions: ParsedFunction[];
  selectedAbis: string[];
  selectedAbiNames: string[];
  onAbisChange: (abis: string[], names: string[]) => void;
  callHistory: CallHistory[];
  onFunctionCall: (name: string, args: any[], func: ParsedFunction) => Promise<void>;
  onDeleteResult: (id: string) => void;
  onClearAll: () => void;
  isCallInProgress: boolean;
  currentChainId: number | null;
  presetRefreshTrigger: number;
  showAddressNames: boolean;
}

function fnKey(fn: ParsedFunction): string {
  return `${fn.name}(${fn.inputs.map((i) => i.type).join(',')})`;
}

const MUTABILITY_STYLE: Record<string, { bg: string; fg: string }> = {
  view:       { bg: 'rgba(96,165,250,0.12)',  fg: 'var(--blue)' },
  pure:       { bg: 'rgba(167,139,250,0.14)', fg: 'var(--violet)' },
  nonpayable: { bg: 'rgba(251,191,36,0.12)',  fg: 'var(--amber)' },
  payable:    { bg: 'rgba(74,222,128,0.12)',  fg: 'var(--emerald)' },
};

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

const MutabilityBadge: React.FC<{ mutability: string }> = ({ mutability }) => {
  const style = MUTABILITY_STYLE[mutability] ?? MUTABILITY_STYLE.view;
  return (
    <span
      className="rounded-xs px-1.5 py-0.5 text-[11px] font-bold tracking-[0.08em]"
      style={{ background: style.bg, color: style.fg }}
    >
      {mutability.toUpperCase()}
    </span>
  );
};

interface FnGroup {
  abiName: string;
  fns: ParsedFunction[];
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
  selectedAbis,
  selectedAbiNames,
  onAbisChange,
  callHistory,
  onFunctionCall,
  onDeleteResult,
  onClearAll,
  isCallInProgress,
  currentChainId,
  presetRefreshTrigger,
  showAddressNames,
}) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [argValuesByFn, setArgValuesByFn] = useState<Record<string, string[]>>({});
  const [callError, setCallError] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const selectedFn = useMemo(
    () => functions.find((f) => fnKey(f) === selectedKey) ?? null,
    [functions, selectedKey]
  );

  const lookup = useMemo(
    () => buildAddressNameLookup(loadContractPresets(), currentChainId),
    [currentChainId, presetRefreshTrigger],
  );

  const groups: FnGroup[] = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const byName = new Map<string, ParsedFunction[]>();
    const order: string[] = [];
    for (const fn of functions) {
      const key = fn.abiName || t('functionCall.ungroupedAbi');
      if (!byName.has(key)) {
        byName.set(key, []);
        order.push(key);
      }
      if (!q || fn.name.toLowerCase().includes(q)) {
        byName.get(key)!.push(fn);
      }
    }
    return order
      .map((name) => ({ abiName: name, fns: sortFunctions(byName.get(name) ?? []) }))
      .filter((g) => g.fns.length > 0);
  }, [functions, filter, t]);

  const toggleGroup = (name: string) => setCollapsedGroups((prev) => {
    const next = new Set(prev);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });

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
      <TxBar
        rpcUrl={rpcUrl}
        onRpcChange={(url) => onRpcUrlChange(url)}
        contractAddress={contractAddress}
        onContractChange={(addr) => onContractAddressChange(addr)}
        currentChainId={currentChainId}
        extra={[
          {
            kicker: 'block',
            value: (
              <input
                value={blockTag}
                onChange={(e) => onBlockTagChange(e.target.value)}
                placeholder="latest"
                className="w-[92px] rounded-sm border border-line bg-bg px-2 py-1 text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
              />
            ),
          },
          {
            kicker: 'abis',
            value: <span className="text-mint">{selectedAbiNames.length}</span>,
          },
        ]}
        actions={
          <button
            onClick={onPresetsClick}
            className="rounded-sm border border-line bg-surface px-2.5 py-1 text-[12px] text-fg-dim hover:bg-surface-2 hover:text-fg"
          >
            {t('topnav.presets')}
          </button>
        }
        refreshToken={presetRefreshTrigger}
      />

      {functions.length === 0 ? (
        <div
          className="grid flex-1 min-h-0"
          style={{ gridTemplateColumns: '260px 1fr' }}
        >
          <AbiSelector
            selectedAbis={selectedAbis}
            selectedAbiNames={selectedAbiNames}
            onChange={onAbisChange}
            onOpenPresets={onPresetsClick}
            refreshToken={presetRefreshTrigger}
          />
          <div className="flex items-center justify-center text-center">
            <div>
              <div className="mb-3 font-mono text-[40px] text-fg-mute">◇</div>
              <p className="font-ui text-[14px] text-fg-dim">
                {t('functionCall.noAbiSelected')}
              </p>
              <button
                onClick={onPresetsClick}
                className="mt-4 rounded-sm border border-mint px-3 py-1.5 font-mono text-[13px] text-mint hover:bg-mint/10"
              >
                {t('functionCall.selectAbi')}
              </button>
            </div>
          </div>
        </div>
      ) : (
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

          {/* middle: grouped function list */}
          <div className="flex min-h-0 flex-col border-r border-line">
            <div className="flex items-center gap-2 border-b border-line px-4 py-2 font-mono text-[12px]">
              <span className="uppercase tracking-[0.22em] text-fg-dim">
                {t('functionCall.functions')}
              </span>
              <span className="text-fg-mute">·</span>
              <span className="text-fg">{functions.length}</span>
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t('functionCall.searchFunctions')}
                className="ml-auto w-40 rounded-sm border border-line bg-bg px-2 py-0.5 font-ui text-[13px] text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {groups.length === 0 ? (
                <div className="p-4 font-ui text-[14px] text-fg-dim">
                  {t('functionCall.noMatchingFunctions')}
                </div>
              ) : (
                groups.map((g) => {
                  const collapsed = collapsedGroups.has(g.abiName);
                  return (
                    <div key={g.abiName}>
                      <div
                        onClick={() => toggleGroup(g.abiName)}
                        className="sticky top-0 z-10 flex cursor-pointer items-center gap-1.5 border-b border-line bg-surface px-4 py-1.5 font-mono text-[12px] text-fg-dim hover:text-fg"
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
                              'group cursor-pointer border-b border-line-soft px-4 py-2 font-mono text-[13px] transition-colors ' +
                              (selected
                                ? 'border-l-2 border-l-mint bg-mint/5 pl-[14px]'
                                : 'border-l-2 border-l-transparent pl-[14px] hover:bg-surface-2')
                            }
                          >
                            <div className="flex items-center gap-2">
                              <MutabilityBadge mutability={fn.stateMutability} />
                              <span className="truncate text-fg">{fn.name}</span>
                              <span className="truncate text-[12px] text-fg-mute">
                                ({fn.inputs.map((i) => i.type).join(', ')})
                              </span>
                            </div>
                            {fn.outputs.length > 0 && (
                              <div className="mt-0.5 ml-[46px] truncate text-[12px] text-fg-mute">
                                → {fn.outputs.map((o) => o.type).join(', ')}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* right: detail + history */}
          <div className="flex min-h-0 min-w-0 flex-col">
            {selectedFn ? (
              <div className="border-b border-line bg-bg px-5 py-4">
                <div className="mb-3 flex flex-wrap items-center gap-2 font-mono text-[13px]">
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
                          <div className="font-mono text-[12px]">
                            <div className="text-fg">{input.name || `arg${i}`}</div>
                            <div className="text-[11px] text-fg-dim">{input.type}</div>
                          </div>
                          <input
                            value={values[i] ?? ''}
                            onChange={(e) => setArgValue(selectedFn, i, e.target.value)}
                            placeholder={input.type}
                            className="rounded-sm border border-line bg-bg px-2 py-1 font-mono text-[13px] text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
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
                    className="rounded-sm bg-mint px-4 py-1.5 font-mono text-[13px] font-semibold text-bg hover:bg-mint/80 disabled:bg-line disabled:text-fg-mute"
                  >
                    {isCallInProgress
                      ? t('functionCall.calling')
                      : selectedFn.stateMutability === 'nonpayable' ||
                        selectedFn.stateMutability === 'payable'
                      ? t('functionCall.simulate')
                      : t('functionCall.call')}
                  </button>
                  {!hasConfig && (
                    <span className="font-mono text-[12px] text-fg-dim">
                      {t('functionCall.missingConfig')}
                    </span>
                  )}
                  {callError && (
                    <span className="font-mono text-[12px] text-call-red">
                      {callError}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="border-b border-line bg-bg px-5 py-4 font-ui text-[14px] text-fg-dim">
                {t('functionCall.selectFunctionHint')}
              </div>
            )}

            <div className="flex items-center gap-2 border-b border-line px-5 py-2 font-mono text-[12px]">
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
                  className="ml-auto rounded-sm border border-line px-2 py-0.5 text-[12px] text-fg-dim hover:bg-surface-2 hover:text-fg"
                >
                  {t('functionCall.clearAll')}
                </button>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {callHistory.length === 0 ? (
                <div className="p-5 font-ui text-[14px] text-fg-dim">
                  {t('functionCall.noRecentCalls')}
                </div>
              ) : (
                callHistory.map((item) => {
                  const success = item.result.success;
                  return (
                    <div key={item.id} className="border-b border-line-soft">
                      <div className="flex items-center gap-2 bg-surface px-5 py-2 font-mono text-[12px]">
                        <span
                          className={
                            'rounded-xs px-1.5 py-0.5 text-[11px] font-bold tracking-[0.08em] ' +
                            (success ? 'bg-mint/15 text-mint' : 'bg-call-red/15 text-call-red')
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
                      <div className="bg-surface-2 px-5 py-3 font-mono text-[13px] leading-[1.55]">
                        {item.args.length > 0 && (
                          <>
                            <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.22em] text-fg-dim">
                              {t('functionCall.args')}
                            </div>
                            <div className="mb-3 rounded-sm border border-line-soft bg-bg px-2.5 py-2 text-[13px] leading-[1.6]">
                              <DecodedValue value={item.args as any} lookup={lookup} showNames={showAddressNames} />
                            </div>
                          </>
                        )}
                        <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.22em] text-fg-dim">
                          {success ? t('functionCall.result') : t('functionCall.error')}
                        </div>
                        {success ? (
                          <div className="rounded-sm border border-line-soft bg-bg px-2.5 py-2 text-[13px] leading-[1.6]">
                            <DecodedValue value={item.result.data as any} lookup={lookup} showNames={showAddressNames} />
                          </div>
                        ) : (
                          <div className="rounded-sm border border-call-red/30 bg-call-red/5 px-2.5 py-2 text-[13px] text-call-red">
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
