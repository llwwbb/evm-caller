import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { JsonRpcProvider } from 'ethers';
import { EventQueryParams, ParsedLog } from '../types';
import { queryEvents, extractEvents, validateBlockRange } from '../utils/eventQuery';
import { saveEventQueryResults, loadEventQueryResults, loadContractPresets } from '../utils/presetStorage';
import { buildAddressNameLookup } from '../utils/addressDisplay';
import DecodedValue from './common/DecodedValue';
import AddressBadge from './common/AddressBadge';
import StatsRibbon, { StatCell } from './layout/StatsRibbon';

interface EventQueryPageProps {
  rpcUrl: string;
  contractAddress: string;
  mergedAbi: string;
  selectedAbiNames: string[];
  selectedAbis: string[];
  currentChainId: number | null;
  presetRefreshTrigger: number;
  showAddressNames: boolean;
}

interface EventOption {
  name: string;
  inputs: any[];
  abiName?: string;
}

const EventQueryPage: React.FC<EventQueryPageProps> = ({
  rpcUrl,
  contractAddress,
  mergedAbi,
  selectedAbiNames,
  selectedAbis,
  currentChainId,
  presetRefreshTrigger,
  showAddressNames,
}) => {
  const { t } = useTranslation();
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [fromBlock, setFromBlock] = useState('');
  const [toBlock, setToBlock] = useState('');
  const [currentFromBlock, setCurrentFromBlock] = useState<number | null>(null);
  const [currentToBlock, setCurrentToBlock] = useState<number | null>(null);
  const [indexedParams, setIndexedParams] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ParsedLog[]>([]);
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set());

  const lookup = useMemo(
    () => buildAddressNameLookup(loadContractPresets(), currentChainId),
    [currentChainId, presetRefreshTrigger],
  );

  useEffect(() => {
    const saved = loadEventQueryResults();
    if (saved && saved.length > 0) setResults(saved);
  }, []);

  useEffect(() => {
    if (selectedAbis.length > 0 && selectedAbiNames.length > 0) {
      try {
        const all: EventOption[] = [];
        selectedAbis.forEach((abi, idx) => {
          const extracted = extractEvents(abi);
          extracted.forEach((e) =>
            all.push({ ...e, abiName: selectedAbiNames[idx] || `ABI ${idx + 1}` })
          );
        });
        setEvents(all);
        if (all.length > 0 && !all.some((e) => e.name === selectedEvent)) {
          setSelectedEvent(all[0].name);
          updateIndexedParams(all[0]);
        }
      } catch (err) {
        console.error('extract events failed:', err);
        setEvents([]);
      }
    } else if (mergedAbi) {
      try {
        const extracted = extractEvents(mergedAbi);
        setEvents(extracted);
        if (extracted.length > 0 && !extracted.some((e) => e.name === selectedEvent)) {
          setSelectedEvent(extracted[0].name);
          updateIndexedParams(extracted[0]);
        }
      } catch (err) {
        console.error('extract events failed:', err);
        setEvents([]);
      }
    } else {
      setEvents([]);
      setSelectedEvent('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAbis, selectedAbiNames, mergedAbi]);

  const updateIndexedParams = (event: { inputs: any[] }) => {
    const params: Record<string, string> = {};
    event.inputs.forEach((input) => {
      if (input.indexed) params[input.name] = '';
    });
    setIndexedParams(params);
  };

  const handleEventChange = (name: string) => {
    setSelectedEvent(name);
    const e = events.find((x) => x.name === name);
    if (e) updateIndexedParams(e);
  };

  const performQuery = async (from: string, to: string) => {
    if (!rpcUrl.trim()) { setError(t('eventQuery.configureRpcFirst')); return; }
    if (!contractAddress.trim()) { setError(t('eventQuery.configureContractFirst')); return; }
    if (!mergedAbi) { setError(t('eventQuery.selectAbiFirst')); return; }
    if (!selectedEvent) { setError(t('eventQuery.selectEventFirst')); return; }
    const v = validateBlockRange(from, to);
    if (!v.valid) { setError(v.error || t('eventQuery.blockRangeInvalid')); return; }

    setIsLoading(true);
    setError(null);

    try {
      const filteredParams: Record<string, any> = {};
      Object.entries(indexedParams).forEach(([k, v]) => {
        if (v.trim()) filteredParams[k] = v.trim();
      });

      const e = events.find((x) => x.name === selectedEvent);
      const params: EventQueryParams = {
        rpcUrl: rpcUrl.trim(),
        contractAddress: contractAddress.trim(),
        abi: mergedAbi,
        eventName: selectedEvent,
        fromBlock: isNaN(Number(from)) ? from : Number(from),
        toBlock: isNaN(Number(to)) ? to : Number(to),
        indexedParams: filteredParams,
        abiName: e?.abiName || selectedAbiNames.join(', '),
      };

      const result = await queryEvents(params);
      if (result.success && result.events) {
        const updated = [...result.events, ...results];
        setResults(updated);
        saveEventQueryResults(updated);
        setCurrentFromBlock(isNaN(Number(from)) ? null : Number(from));
        setCurrentToBlock(isNaN(Number(to)) ? null : Number(to));
      } else {
        setError(result.error || t('errors.queryEventFailed'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.queryEventFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickQuery = async () => {
    if (!rpcUrl.trim()) { setError(t('eventQuery.configureRpcFirst')); return; }
    try {
      const provider = new JsonRpcProvider(rpcUrl);
      const latest = await provider.getBlockNumber();
      const from = Math.max(0, latest - 1000);
      setFromBlock(from.toString());
      setToBlock(latest.toString());
      await performQuery(from.toString(), latest.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('eventQuery.getLatestBlockFailed'));
    }
  };

  const handleQueryPrevious = async () => {
    if (currentFromBlock === null) return;
    const newTo = currentFromBlock - 1;
    const newFrom = Math.max(0, newTo - 999);
    setFromBlock(newFrom.toString());
    setToBlock(newTo.toString());
    await performQuery(newFrom.toString(), newTo.toString());
  };

  const handleQueryNext = async () => {
    if (currentToBlock === null || !rpcUrl.trim()) return;
    try {
      const provider = new JsonRpcProvider(rpcUrl);
      const latest = await provider.getBlockNumber();
      const newFrom = currentToBlock + 1;
      const newTo = Math.min(latest, newFrom + 999);
      if (newFrom > latest) { setError(t('eventQuery.alreadyLatest')); return; }
      setFromBlock(newFrom.toString());
      setToBlock(newTo.toString());
      await performQuery(newFrom.toString(), newTo.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('eventQuery.getLatestBlockFailed'));
    }
  };

  const handleQuery = () => {
    if (!fromBlock.trim() || !toBlock.trim()) {
      setError(t('eventQuery.enterBlockRange'));
      return;
    }
    performQuery(fromBlock, toBlock);
  };

  const toggleResult = (i: number) => {
    setExpandedResults((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const handleDeleteResult = (i: number) => {
    const next = results.filter((_, idx) => idx !== i);
    setResults(next);
    saveEventQueryResults(next);
  };

  const handleClearAll = () => {
    if (window.confirm(t('eventQuery.confirmClearAll'))) {
      setResults([]);
      saveEventQueryResults([]);
    }
  };

  const selectedEventObj = events.find((e) => e.name === selectedEvent);
  const hasIndexed = selectedEventObj?.inputs.some((i) => i.indexed) ?? false;

  const stats: StatCell[] | null = useMemo(() => {
    if (results.length === 0) return null;
    return [
      { label: t('eventQueryUI.statEvents'), value: results.length },
      {
        label: t('eventQueryUI.statRange'),
        value:
          currentFromBlock !== null && currentToBlock !== null
            ? `${currentFromBlock}—${currentToBlock}`
            : '—',
      },
      {
        label: t('eventQueryUI.statLatestBlock'),
        value: results[0]?.blockNumber ?? '—',
      },
    ];
  }, [results, currentFromBlock, currentToBlock, t]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* TxBar: contract + event + blocks + actions */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-bg px-5 py-2.5 font-mono text-[12px]">
        <span className="text-[11px] uppercase tracking-[0.2em] text-fg-mute">contract</span>
        <span className="break-all text-fg">
          {contractAddress || '—'}
        </span>

        <span className="text-line">/</span>
        <span className="text-[11px] uppercase tracking-[0.2em] text-fg-mute">event</span>
        <select
          value={selectedEvent}
          onChange={(e) => handleEventChange(e.target.value)}
          disabled={events.length === 0}
          className="min-w-[180px] rounded-sm border border-line bg-bg px-2 py-1 text-fg focus:border-mint focus:outline-none disabled:opacity-50"
        >
          {events.length === 0 ? (
            <option>—</option>
          ) : (
            events.map((e, i) => (
              <option key={`${e.name}-${i}`} value={e.name}>
                {e.name}
                {e.abiName ? ` · ${e.abiName}` : ''}
              </option>
            ))
          )}
        </select>

        <span className="text-line">/</span>
        <span className="text-[11px] uppercase tracking-[0.2em] text-fg-mute">from</span>
        <input
          value={fromBlock}
          onChange={(e) => setFromBlock(e.target.value)}
          placeholder="block"
          className="w-[90px] rounded-sm border border-line bg-bg px-2 py-1 text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
        />
        <span className="text-[11px] uppercase tracking-[0.2em] text-fg-mute">to</span>
        <input
          value={toBlock}
          onChange={(e) => setToBlock(e.target.value)}
          placeholder="block"
          className="w-[90px] rounded-sm border border-line bg-bg px-2 py-1 text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
        />

        {hasIndexed && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={
              'rounded-sm px-2 py-0.5 text-[11px] ' +
              (showFilters ? 'bg-mint/10 text-mint' : 'text-fg-dim hover:bg-surface-2')
            }
          >
            filters
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleQuickQuery}
            disabled={isLoading}
            className="rounded-sm border border-line px-2.5 py-1 text-[11px] text-fg-dim hover:bg-surface-2 disabled:opacity-50"
          >
            {t('eventQueryUI.quickLatest1k')}
          </button>
          {currentFromBlock !== null && (
            <>
              <button
                onClick={handleQueryPrevious}
                disabled={isLoading || currentFromBlock === 0}
                className="rounded-sm border border-line px-2 py-1 text-[11px] text-fg-dim hover:bg-surface-2 disabled:opacity-50"
              >
                ← prev
              </button>
              <button
                onClick={handleQueryNext}
                disabled={isLoading}
                className="rounded-sm border border-line px-2 py-1 text-[11px] text-fg-dim hover:bg-surface-2 disabled:opacity-50"
              >
                next →
              </button>
            </>
          )}
          <button
            onClick={handleQuery}
            disabled={isLoading}
            className="rounded-sm bg-mint px-3 py-1 font-mono text-[11px] font-semibold text-bg disabled:opacity-50"
          >
            {isLoading ? t('eventQueryUI.querying') : t('eventQueryUI.query')}
          </button>
        </div>
      </div>

      {/* Indexed filters row */}
      {showFilters && hasIndexed && (
        <div className="border-b border-line bg-surface px-5 py-3">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">
            {t('eventQueryUI.indexedFilters')}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {selectedEventObj?.inputs
              .filter((i) => i.indexed)
              .map((i) => (
                <div key={i.name} className="flex items-center gap-2">
                  <span className="min-w-[80px] font-mono text-[11px] text-fg-mute">
                    {i.name}
                    <span className="ml-1 text-[10px]">({i.type})</span>
                  </span>
                  <input
                    value={indexedParams[i.name] ?? ''}
                    onChange={(e) =>
                      setIndexedParams((prev) => ({ ...prev, [i.name]: e.target.value }))
                    }
                    className="flex-1 rounded-sm border border-line bg-bg px-2 py-1 font-mono text-[11px] text-fg focus:border-mint focus:outline-none"
                  />
                </div>
              ))}
          </div>
        </div>
      )}

      {error && (
        <div className="border-b border-line bg-call-red/5 px-5 py-2 font-mono text-[12px] text-call-red">
          {error}
        </div>
      )}

      {stats && <StatsRibbon stats={stats} />}

      <div className="flex items-center gap-2 border-b border-line bg-bg px-5 py-2 font-mono text-[11px]">
        <span className="uppercase tracking-[0.22em] text-fg-mute">
          {t('eventQueryUI.results')}
        </span>
        <span className="text-fg-mute">·</span>
        <span className="text-fg">{results.length}</span>
        {results.length > 0 && (
          <button
            onClick={handleClearAll}
            className="ml-auto rounded-sm px-2 py-0.5 text-[11px] text-fg-mute hover:bg-surface-2"
          >
            {t('debugTrace.closeAll')}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {results.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <div>
              <div className="mb-3 font-mono text-[40px] text-fg-mute">◇</div>
              <p className="font-ui text-[14px] text-fg-dim">
                {t('eventQueryUI.noResults')}
              </p>
            </div>
          </div>
        ) : (
          results.map((log, i) => {
            const expanded = expandedResults.has(i);
            return (
              <div key={i} className="border-b border-line-soft">
                <div
                  className="flex cursor-pointer items-center gap-2.5 px-5 py-2 font-mono text-[12px] hover:bg-surface-2"
                  onClick={() => toggleResult(i)}
                >
                  <span className="text-[11px] text-fg-mute">#{log.logIndex}</span>
                  <span className="text-fg-mute">{log.blockNumber}</span>
                  {log.parsed ? (
                    <span className="rounded-xs bg-mint/15 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em] text-mint">
                      {log.parsed.eventName}
                    </span>
                  ) : (
                    <span className="rounded-xs bg-line px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em] text-fg-mute">
                      RAW
                    </span>
                  )}
                  <span className="break-all text-fg-dim">
                    {log.transactionHash}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteResult(i);
                      }}
                      className="rounded-sm px-1.5 text-fg-mute hover:bg-surface-2"
                    >
                      ×
                    </button>
                    <span className="text-fg-mute">{expanded ? '▾' : '▸'}</span>
                  </span>
                </div>
                {expanded && (
                  <div className="bg-surface px-5 py-3 font-mono text-[10.5px] leading-[1.55]">
                    <div className="mb-1.5">
                      <span className="text-fg-mute">address </span>
                      <AddressBadge addr={log.address} lookup={lookup} showNames={showAddressNames} />
                    </div>
                    {log.parsed?.signature && (
                      <div className="mb-1.5">
                        <span className="text-fg-mute">signature </span>
                        <span className="text-fg">{log.parsed.signature}</span>
                      </div>
                    )}
                    {log.parsed?.abiName && (
                      <div className="mb-2">
                        <span className="text-fg-mute">abi </span>
                        <span className="text-mint">{log.parsed.abiName}</span>
                      </div>
                    )}
                    <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">
                      {t('eventQueryUI.args')}
                    </div>
                    <div className="rounded-sm border border-line-soft bg-bg px-2.5 py-2 text-[10.5px] leading-[1.6]">
                      <DecodedValue
                        value={log.parsed ? (log.parsed.args as any) : ({ topics: log.topics, data: log.data } as any)}
                        lookup={lookup}
                        showNames={showAddressNames}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default EventQueryPage;
