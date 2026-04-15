import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ParsedCallTrace, CallTrace } from '../types';
import { fetchDebugTrace, parseTraceWithAbi } from '../utils/debugTrace';
import {
  loadContractPresets,
  saveDebugTraceResult,
  loadDebugTraceResult,
} from '../utils/presetStorage';
import { buildAddressNameLookup } from '../utils/addressDisplay';
import TxBar from './layout/TxBar';
import StatsRibbon, { StatCell } from './layout/StatsRibbon';
import CallTree from './debugTrace/CallTree';
import NodeStack from './debugTrace/NodeStack';
import { usePinStack } from '../hooks/usePinStack';

interface DebugTracePageProps {
  rpcUrl: string;
  selectedAbis: string[];
  showAddressNames: boolean;
  presetRefreshTrigger: number;
  currentChainId: number | null;
}

function gasNum(gas: string | undefined): number {
  if (!gas) return 0;
  const n = typeof gas === 'string' ? parseInt(gas, 16) : Number(gas);
  return isNaN(n) ? 0 : n;
}

function walkStats(
  node: ParsedCallTrace,
  acc: {
    calls: number;
    maxDepth: number;
    totalGas: number;
    reverts: number;
    decoded: number;
  },
  depth = 0
) {
  acc.calls++;
  acc.maxDepth = Math.max(acc.maxDepth, depth);
  acc.totalGas += gasNum(node.gasUsed);
  if (node.error) acc.reverts++;
  if (node.decodedInput) acc.decoded++;
  if (node.calls) for (const c of node.calls) walkStats(c, acc, depth + 1);
}

function findNodeByPath(
  root: ParsedCallTrace | null,
  path: string
): ParsedCallTrace | null {
  if (!root) return null;
  if (path === '0') return root;
  const parts = path.split('-').slice(1).map(Number);
  let node: ParsedCallTrace | undefined = root;
  for (const i of parts) {
    if (!node?.calls || i < 0 || i >= node.calls.length) return null;
    node = node.calls[i];
  }
  return node ?? null;
}

function allPaths(node: ParsedCallTrace, path = '0'): string[] {
  const out = [path];
  if (node.calls) {
    for (let i = 0; i < node.calls.length; i++) {
      out.push(...allPaths(node.calls[i], `${path}-${i}`));
    }
  }
  return out;
}

const DebugTracePage: React.FC<DebugTracePageProps> = ({
  rpcUrl,
  selectedAbis,
  showAddressNames,
  presetRefreshTrigger,
  currentChainId,
}) => {
  const { t } = useTranslation();
  const [txHash, setTxHash] = useState('');
  const [rawTrace, setRawTrace] = useState<CallTrace | null>(null);
  const [parsedTrace, setParsedTrace] = useState<ParsedCallTrace | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['0']));
  const [addressNameMap, setAddressNameMap] = useState(() => buildAddressNameLookup([], null));
  const [didHydrate, setDidHydrate] = useState(false);

  const pin = usePinStack();

  // Hydrate from localStorage once
  useEffect(() => {
    const saved = loadDebugTraceResult();
    if (saved) {
      setTxHash(saved.txHash || '');
      if (saved.rawTrace) setRawTrace(saved.rawTrace);
      if (saved.expandedNodes?.length) setExpandedPaths(new Set(saved.expandedNodes));
      pin.hydrate({
        selectedPath: saved.selectedPath ?? null,
        pinnedPaths: saved.pinnedPaths ?? [],
        collapsedPaths: saved.collapsedPaths ?? [],
      });
    }
    setDidHydrate(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on change (skip until hydrated to avoid stomping restored state)
  useEffect(() => {
    if (!didHydrate) return;
    saveDebugTraceResult({
      txHash,
      rawTrace,
      parsedTrace,
      expandedNodes: [...expandedPaths],
      selectedPath: pin.selectedPath,
      pinnedPaths: [...pin.pinnedPaths],
      collapsedPaths: [...pin.collapsedPaths],
    });
  }, [
    didHydrate,
    txHash,
    rawTrace,
    parsedTrace,
    expandedPaths,
    pin.selectedPath,
    pin.pinnedPaths,
    pin.collapsedPaths,
  ]);

  // Refresh address name map when presets or chain change
  useEffect(() => {
    setAddressNameMap(buildAddressNameLookup(loadContractPresets(), currentChainId));
  }, [presetRefreshTrigger, currentChainId]);

  // Re-parse whenever ABIs or rawTrace change
  useEffect(() => {
    if (!rawTrace) {
      setParsedTrace(null);
      return;
    }
    try {
      const parsed =
        selectedAbis.length > 0
          ? parseTraceWithAbi(rawTrace, selectedAbis)
          : (rawTrace as ParsedCallTrace);
      setParsedTrace(parsed);
    } catch (err) {
      console.error('Failed to parse trace with ABI:', err);
      setParsedTrace(rawTrace as ParsedCallTrace);
    }
  }, [selectedAbis, rawTrace]);

  const stats: StatCell[] | null = useMemo(() => {
    if (!parsedTrace) return null;
    const acc = { calls: 0, maxDepth: 0, totalGas: 0, reverts: 0, decoded: 0 };
    walkStats(parsedTrace, acc);
    return [
      { label: t('debugTrace.statCalls'), value: acc.calls },
      { label: t('debugTrace.statDepth'), value: acc.maxDepth },
      { label: t('debugTrace.statGas'), value: acc.totalGas.toLocaleString('en-US') },
      {
        label: t('debugTrace.statReverts'),
        value: acc.reverts,
        variant: acc.reverts > 0 ? 'warn' : 'default',
      },
      {
        label: t('debugTrace.statDecoded'),
        value: (
          <>
            {acc.decoded}
            <span className="text-[12px] text-fg-mute">/{acc.calls}</span>
          </>
        ),
        variant: acc.decoded === acc.calls ? 'ok' : 'default',
      },
    ];
  }, [parsedTrace, t]);

  const getNodeByPath = useCallback(
    (path: string) => findNodeByPath(parsedTrace, path),
    [parsedTrace]
  );

  const handleToggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const expandAll = () => {
    if (!parsedTrace) return;
    setExpandedPaths(new Set(allPaths(parsedTrace)));
  };
  const collapseAll = () => setExpandedPaths(new Set(['0']));

  const handleFetch = async () => {
    if (!txHash.trim()) {
      setError(t('debugTrace.enterTxHash'));
      return;
    }
    if (!rpcUrl.trim()) {
      setError(t('debugTrace.configureRpc'));
      return;
    }
    setIsFetching(true);
    setError(null);
    setRawTrace(null);
    setParsedTrace(null);
    try {
      const trace = await fetchDebugTrace(rpcUrl, txHash.trim());
      setRawTrace(trace);
      setExpandedPaths(new Set(['0']));
      pin.clearAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('debug_traceTransaction')) setError(t('debugTrace.rpcNotSupport'));
      else if (msg.includes('not found') || msg.includes('does not exist'))
        setError(t('debugTrace.txNotFound'));
      else setError(t('debugTrace.fetchFailed') + ': ' + msg);
    } finally {
      setIsFetching(false);
    }
  };

  const txBarItems = rawTrace
    ? [
        { kicker: 'tx', value: `${txHash.slice(0, 10)}…${txHash.slice(-6)}` },
        { kicker: 'abis', value: <span className="text-mint">{selectedAbis.length}</span> },
      ]
    : [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {rawTrace ? (
        <TxBar
          items={txBarItems}
          actions={
            <button
              onClick={handleFetch}
              disabled={isFetching}
              className="rounded-sm border border-line px-2.5 py-1 text-[10px] text-fg-dim hover:bg-surface-2 disabled:opacity-50"
            >
              {isFetching ? t('debugTrace.fetching') : t('debugTrace.refetch')}
            </button>
          }
        />
      ) : (
        <div className="flex items-center gap-3 border-b border-line bg-bg px-5 py-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-mute">
            tx hash
          </span>
          <input
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            placeholder="0x..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFetch();
            }}
            className="flex-1 rounded-sm border border-line bg-bg px-3 py-1.5 font-mono text-[12px] text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
          />
          <button
            onClick={handleFetch}
            disabled={isFetching}
            className="rounded-sm bg-mint px-4 py-1.5 font-mono text-[11px] font-semibold text-bg disabled:opacity-50"
          >
            {isFetching ? t('debugTrace.fetching') : t('debugTrace.fetchTrace')}
          </button>
        </div>
      )}

      {error && (
        <div className="border-b border-line bg-call-red/5 px-5 py-2 text-[12px] text-call-red">
          {error}
        </div>
      )}

      {stats && <StatsRibbon stats={stats} />}

      {parsedTrace ? (
        <div
          className="grid flex-1 min-h-0"
          style={{ gridTemplateColumns: '1.4fr 1fr' }}
        >
          <div className="flex min-h-0 flex-col border-r border-line">
            <div className="flex items-center gap-2 border-b border-line px-4 py-2 font-mono text-[10px]">
              <span className="uppercase tracking-[0.22em] text-fg-mute">
                {t('debugTrace.callTree')}
              </span>
              <div className="ml-auto flex gap-3 text-fg-mute">
                <button onClick={expandAll} className="hover:text-fg">
                  {t('debugTrace.expandAll')}
                </button>
                <button onClick={collapseAll} className="hover:text-fg">
                  {t('debugTrace.collapseAll')}
                </button>
              </div>
            </div>
            <CallTree
              root={parsedTrace}
              expandedPaths={expandedPaths}
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
        <div className="flex flex-1 min-h-0 items-center justify-center text-center">
          <div>
            <div className="mb-3 font-mono text-[40px] text-fg-mute">◇</div>
            <p className="font-ui text-[13px] text-fg-dim">{t('debugTrace.noResult')}</p>
            <p className="mt-1 font-mono text-[10px] text-fg-mute">
              {t('debugTrace.enterTxHashToStart')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DebugTracePage;
