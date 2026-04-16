import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TransactionResponse, TransactionReceipt, Log } from 'ethers';
import { ParsedTransaction, ParsedLog } from '../types';
import {
  fetchTransaction,
  fetchTransactionReceipt,
  formatTransactionInfo,
  parseTransactionLogs,
  decodeInputData,
} from '../utils/transactionParser';
import { saveTxParserResult, loadTxParserResult, loadContractPresets } from '../utils/presetStorage';
import { buildAddressNameLookup } from '../utils/addressDisplay';
import DecodedValue from './common/DecodedValue';
import AddressBadge from './common/AddressBadge';
import TxBar from './layout/TxBar';
import StatsRibbon, { StatCell } from './layout/StatsRibbon';

interface TransactionParserPageProps {
  rpcUrl: string;
  onRpcUrlChange: (url: string) => void;
  selectedAbis: string[];
  selectedAbiNames: string[];
  mergedAbi: string;
  currentChainId: number | null;
  presetRefreshTrigger: number;
  showAddressNames: boolean;
}

type ParseType = 'hex' | 'address' | 'number' | 'text';

const splitInto32Bytes = (data: string): string[] => {
  const hex = data.startsWith('0x') ? data.slice(2) : data;
  if (!hex) return [];
  const chunks: string[] = [];
  for (let i = 0; i < hex.length; i += 64) {
    chunks.push('0x' + hex.slice(i, i + 64).padEnd(64, '0'));
  }
  return chunks;
};

const parse32Bytes = (chunk: string, type: ParseType): string => {
  const hex = chunk.startsWith('0x') ? chunk.slice(2) : chunk;
  switch (type) {
    case 'hex':
      return '0x' + hex;
    case 'address':
      return '0x' + hex.slice(-40);
    case 'number':
      try { return BigInt('0x' + hex).toString(); } catch { return 'Invalid'; }
    case 'text':
      try {
        const bytes = hex.match(/.{2}/g)?.map((b) => parseInt(b, 16)) || [];
        const filtered = bytes.filter((b) => b !== 0);
        const text = new TextDecoder('utf-8', { fatal: false }).decode(
          new Uint8Array(filtered)
        );
        if (/^[\x20-\x7E]*$/.test(text) && text.length > 0) return text;
        return '(non-printable)';
      } catch { return '(decode error)'; }
    default:
      return chunk;
  }
};

const MiniLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.22em] text-fg-mute">
    {children}
  </div>
);

const ParseTypeButtons: React.FC<{
  current: ParseType;
  onChange: (t: ParseType) => void;
}> = ({ current, onChange }) => (
  <div className="flex gap-0.5">
    {(['hex', 'address', 'number', 'text'] as ParseType[]).map((type) => (
      <button
        key={type}
        onClick={() => onChange(type)}
        className={
          'rounded-xs px-1.5 py-0.5 font-mono text-[9px] tracking-[0.05em] ' +
          (current === type
            ? 'bg-mint text-bg font-semibold'
            : 'text-fg-mute hover:bg-surface-2')
        }
      >
        {type}
      </button>
    ))}
  </div>
);

const TransactionParserPage: React.FC<TransactionParserPageProps> = ({
  rpcUrl,
  onRpcUrlChange,
  selectedAbis,
  selectedAbiNames,
  currentChainId,
  presetRefreshTrigger,
  showAddressNames,
}) => {
  const { t } = useTranslation();
  const [txHash, setTxHash] = useState('');
  const [rawTx, setRawTx] = useState<TransactionResponse | null>(null);
  const [rawReceipt, setRawReceipt] = useState<TransactionReceipt | null>(null);
  const [parsedTx, setParsedTx] = useState<ParsedTransaction | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const [dataParseTypes, setDataParseTypes] = useState<Record<number, Record<number, ParseType>>>({});
  const [topicParseTypes, setTopicParseTypes] = useState<Record<number, Record<number, ParseType>>>({});

  const lookup = useMemo(
    () => buildAddressNameLookup(loadContractPresets(), currentChainId),
    [currentChainId, presetRefreshTrigger],
  );

  useEffect(() => {
    const saved = loadTxParserResult();
    if (saved) {
      setTxHash(saved.txHash || '');
      setParsedTx(saved.parsedTx || null);
    }
  }, []);

  // Re-parse when ABIs change and we have raw tx data
  useEffect(() => {
    const reParse = async () => {
      if (!rawTx || !rawReceipt) return;
      if (selectedAbis.length === 0) { setParsedTx(null); return; }
      try {
        const info = formatTransactionInfo(rawTx, rawReceipt);
        let decodedInput = null;
        for (const abi of selectedAbis) {
          const decoded = decodeInputData(rawTx.data, abi);
          if (decoded) { decodedInput = decoded; break; }
        }
        const parsedLogs = parseTransactionLogs(
          rawReceipt.logs as Log[],
          selectedAbis,
          selectedAbiNames
        );
        let timestamp: number | undefined;
        try {
          if (rawTx.blockNumber && rpcUrl) {
            const provider = new (await import('ethers')).JsonRpcProvider(rpcUrl);
            const block = await provider.getBlock(rawTx.blockNumber);
            timestamp = block?.timestamp;
          }
        } catch (e) { console.error('区块时间戳获取失败:', e); }
        const parsed: ParsedTransaction = {
          ...info,
          timestamp,
          decodedInput: decodedInput || undefined,
          logs: parsedLogs,
        } as ParsedTransaction;
        setParsedTx(parsed);
        saveTxParserResult({ txHash: rawTx.hash, parsedTx: parsed });
      } catch (err) {
        console.error('重新解析失败:', err);
      }
    };
    reParse();
  }, [selectedAbis, rawTx, rawReceipt, rpcUrl, selectedAbiNames]);

  const handleFetch = async () => {
    if (!txHash.trim()) { setError(t('transactionParser.enterTxHash')); return; }
    if (!rpcUrl.trim()) { setError(t('transactionParser.configureRpc')); return; }
    setIsFetching(true);
    setError(null);
    setParsedTx(null);
    try {
      const [tx, receipt] = await Promise.all([
        fetchTransaction(rpcUrl, txHash.trim()),
        fetchTransactionReceipt(rpcUrl, txHash.trim()),
      ]);
      setRawTx(tx);
      setRawReceipt(receipt);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('transactionParser.fetchFailed'));
      setRawTx(null);
      setRawReceipt(null);
    } finally {
      setIsFetching(false);
    }
  };

  const toggleLog = (index: number) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const stats: StatCell[] | null = useMemo(() => {
    if (!parsedTx) return null;
    const valueEth = (BigInt(parsedTx.value) * 10000n) / (10n ** 18n);
    const valueDisplay = Number(valueEth) / 10000;
    return [
      {
        label: t('txParser.statStatus'),
        value: parsedTx.status === 1 ? 'OK' : 'FAILED',
        variant: parsedTx.status === 1 ? 'ok' : 'warn',
      },
      {
        label: t('txParser.statLogs'),
        value: parsedTx.logs.length,
      },
      {
        label: t('txParser.statValue'),
        value: `${valueDisplay.toString()} ETH`,
      },
      {
        label: t('txParser.statDecoded'),
        value: parsedTx.decodedInput ? 'yes' : 'no',
        variant: parsedTx.decodedInput ? 'ok' : 'default',
      },
    ];
  }, [parsedTx, t]);

  const txBarExtra = parsedTx
    ? [
        { kicker: 'block', value: parsedTx.blockNumber?.toLocaleString() ?? '—' },
        { kicker: 'abis', value: <span className="text-mint">{selectedAbis.length}</span> },
      ]
    : [];

  const formatTimestamp = (ts?: number) =>
    ts ? new Date(ts * 1000).toLocaleString() : '—';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TxBar
        rpcUrl={rpcUrl}
        onRpcChange={(url) => onRpcUrlChange(url)}
        txHash={txHash}
        onTxHashChange={setTxHash}
        onTxHashSubmit={handleFetch}
        isFetching={isFetching}
        currentChainId={currentChainId}
        extra={txBarExtra}
        refreshToken={presetRefreshTrigger}
      />

      {error && (
        <div className="border-b border-line bg-call-red/5 px-5 py-2 text-[12px] text-call-red">
          {error}
        </div>
      )}

      {stats && <StatsRibbon stats={stats} />}

      {parsedTx ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Top: tx header + decoded input */}
          <div className="border-b border-line bg-surface px-5 py-4 font-mono text-[11px]">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              <div><span className="text-fg-mute">from </span><AddressBadge addr={parsedTx.from} lookup={lookup} showNames={showAddressNames} /></div>
              <div><span className="text-fg-mute">to </span>{parsedTx.to ? <AddressBadge addr={parsedTx.to} lookup={lookup} showNames={showAddressNames} /> : <span className="text-fg">{t('transactionParser.contractCreation')}</span>}</div>
              <div><span className="text-fg-mute">value </span><span className="text-fg">{(BigInt(parsedTx.value) / BigInt(10 ** 18)).toString()} ETH</span></div>
              <div><span className="text-fg-mute">nonce </span><span className="text-fg">{parsedTx.nonce}</span></div>
              <div><span className="text-fg-mute">gas limit </span><span className="text-fg">{parsedTx.gasLimit}</span></div>
              {parsedTx.gasPrice && (
                <div><span className="text-fg-mute">gas price </span><span className="text-fg">{(BigInt(parsedTx.gasPrice) / BigInt(10 ** 9)).toString()} gwei</span></div>
              )}
              <div className="col-span-2"><span className="text-fg-mute">time </span><span className="text-fg">{formatTimestamp(parsedTx.timestamp)}</span></div>
            </div>

            {parsedTx.decodedInput ? (
              <div className="mt-4 border-t border-line-soft pt-3">
                <MiniLabel>
                  {t('txParser.decodedInput')} — {parsedTx.decodedInput.functionName}
                </MiniLabel>
                <div className="mb-1 text-[10px] text-fg-mute">
                  {parsedTx.decodedInput.signature}
                </div>
                <div className="mt-1 rounded-sm border border-line-soft bg-bg px-2.5 py-2 text-[10.5px] leading-[1.6]">
                  <DecodedValue value={parsedTx.decodedInput.args as any} lookup={lookup} showNames={showAddressNames} />
                </div>
              </div>
            ) : (
              <div className="mt-4 border-t border-line-soft pt-3">
                <MiniLabel>{t('txParser.rawInput')}</MiniLabel>
                <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap break-all rounded-sm border border-line-soft bg-bg px-2.5 py-2 text-[10.5px] text-fg">
                  {parsedTx.inputData}
                </pre>
              </div>
            )}
          </div>

          {/* Bottom: logs */}
          <div className="flex items-center gap-2 border-b border-line bg-bg px-5 py-2 font-mono text-[10px]">
            <span className="uppercase tracking-[0.22em] text-fg-mute">
              {t('txParser.logs')}
            </span>
            <span className="text-fg-mute">·</span>
            <span className="text-fg">{parsedTx.logs.length}</span>
            {parsedTx.logs.length > 0 && (
              <div className="ml-auto flex gap-3 text-fg-mute">
                <button
                  onClick={() => setExpandedLogs(new Set(parsedTx.logs.map((_: ParsedLog, i: number) => i)))}
                  className="hover:text-fg"
                >
                  {t('debugTrace.expandAll')}
                </button>
                <button
                  onClick={() => setExpandedLogs(new Set())}
                  className="hover:text-fg"
                >
                  {t('debugTrace.collapseAll')}
                </button>
              </div>
            )}
          </div>

          {parsedTx.logs.length === 0 ? (
            <div className="p-5 font-ui text-[12px] text-fg-mute">
              {t('transactionParser.noLogs')}
            </div>
          ) : (
            parsedTx.logs.map((log: ParsedLog, index: number) => {
              const expanded = expandedLogs.has(index);
              const isParsed = !!log.parsed;
              return (
                <div key={index} className="border-b border-line-soft">
                  <div
                    onClick={() => toggleLog(index)}
                    className="flex cursor-pointer items-center gap-2.5 px-5 py-2 font-mono text-[11px] hover:bg-surface-2"
                  >
                    <span className="text-[10px] text-fg-mute">#{log.logIndex}</span>
                    {isParsed ? (
                      <span className="rounded-xs bg-mint/15 px-1.5 py-0.5 text-[9px] font-bold tracking-[0.08em] text-mint">
                        {log.parsed!.eventName}
                      </span>
                    ) : (
                      <span className="rounded-xs bg-line px-1.5 py-0.5 text-[9px] font-bold tracking-[0.08em] text-fg-mute">
                        RAW
                      </span>
                    )}
                    <AddressBadge addr={log.address} lookup={lookup} showNames={showAddressNames} />
                    <span className="ml-auto text-fg-mute">
                      {expanded ? '▾' : '▸'}
                    </span>
                  </div>

                  {expanded && (
                    <div className="bg-surface px-5 py-3 font-mono text-[10.5px] leading-[1.55]">
                      {isParsed ? (
                        <>
                          <div className="mb-1.5">
                            <span className="text-fg-mute">signature </span>
                            <span className="text-fg">{log.parsed!.signature}</span>
                          </div>
                          <div className="mb-1.5">
                            <span className="text-fg-mute">topic </span>
                            <span className="break-all text-fg">{log.parsed!.topic}</span>
                          </div>
                          <div className="mb-3">
                            <span className="text-fg-mute">abi </span>
                            <span className="text-mint">{log.parsed!.abiName}</span>
                          </div>
                          <MiniLabel>{t('txParser.args')}</MiniLabel>
                          <div className="rounded-sm border border-line-soft bg-bg px-2.5 py-2 text-[10.5px] leading-[1.6]">
                            <DecodedValue value={log.parsed!.args as any} lookup={lookup} showNames={showAddressNames} />
                          </div>
                        </>
                      ) : (
                        <>
                          {log.error && (
                            <div className="mb-3 whitespace-pre-wrap rounded-sm border border-call-red/30 bg-call-red/5 px-2.5 py-2 text-call-red">
                              {log.error}
                            </div>
                          )}
                          <MiniLabel>
                            {t('txParser.topics')} · {t('txParser.each32Bytes')}
                          </MiniLabel>
                          <div className="mb-3 space-y-1.5 rounded-sm border border-line-soft bg-bg px-2.5 py-2">
                            {log.topics.map((topic, i) => {
                              const selType = topicParseTypes[index]?.[i] || 'hex';
                              return (
                                <div key={i} className="border-b border-line-soft pb-1.5 last:border-b-0 last:pb-0">
                                  <div className="mb-0.5 flex items-center gap-2">
                                    <span className="text-fg-mute">[{i}]</span>
                                    {i > 0 && (
                                      <ParseTypeButtons
                                        current={selType}
                                        onChange={(type) =>
                                          setTopicParseTypes((prev) => ({
                                            ...prev,
                                            [index]: { ...prev[index], [i]: type },
                                          }))
                                        }
                                      />
                                    )}
                                  </div>
                                  <div className="break-all pl-4 text-fg">
                                    {i === 0 ? (
                                      <span className="text-call-violet">{topic}</span>
                                    ) : (
                                      <span className={
                                        selType === 'address' ? 'text-call-blue' :
                                        selType === 'number' ? 'text-mint' :
                                        selType === 'text' ? 'text-call-amber' : ''
                                      }>
                                        {parse32Bytes(topic, selType)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <MiniLabel>
                            {t('txParser.data')} · {t('txParser.bytes32Count', { count: splitInto32Bytes(log.data).length })}
                          </MiniLabel>
                          {log.data && log.data !== '0x' ? (
                            <div className="space-y-1.5 rounded-sm border border-line-soft bg-bg px-2.5 py-2">
                              {splitInto32Bytes(log.data).map((chunk, i) => {
                                const selType = dataParseTypes[index]?.[i] || 'hex';
                                return (
                                  <div key={i} className="border-b border-line-soft pb-1.5 last:border-b-0 last:pb-0">
                                    <div className="mb-0.5 flex items-center gap-2">
                                      <span className="text-fg-mute">[{i}]</span>
                                      <ParseTypeButtons
                                        current={selType}
                                        onChange={(type) =>
                                          setDataParseTypes((prev) => ({
                                            ...prev,
                                            [index]: { ...prev[index], [i]: type },
                                          }))
                                        }
                                      />
                                    </div>
                                    <div className="break-all pl-4">
                                      <span className={
                                        selType === 'address' ? 'text-call-blue' :
                                        selType === 'number' ? 'text-mint' :
                                        selType === 'text' ? 'text-call-amber' : 'text-fg'
                                      }>
                                        {parse32Bytes(chunk, selType)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="rounded-sm border border-line-soft bg-bg px-2.5 py-2 text-fg-mute">
                              (empty)
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 items-center justify-center text-center">
          <div>
            <div className="mb-3 font-mono text-[40px] text-fg-mute">◇</div>
            <p className="font-ui text-[13px] text-fg-dim">
              {t('transactionParser.enterTxHashToStart')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionParserPage;
