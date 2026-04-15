import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DecodedData, HexParserHistory } from '../types';
import {
  autoDetectAndDecode,
  decodeHexAsFunction,
  decodeHexAsEvent,
  decodeHexAsError,
} from '../utils/hexParser';
import {
  saveHexParserResult,
  loadHexParserResult,
  loadHexParserHistory,
  addHexParserHistory,
  deleteHexParserHistory,
  clearHexParserHistory,
  loadContractPresets,
} from '../utils/presetStorage';
import { buildAddressNameLookup } from '../utils/addressDisplay';
import DecodedValue from './common/DecodedValue';

type DecodeType = 'auto' | 'function' | 'event' | 'error';

interface HexParserPageProps {
  mergedAbi: string;
  currentChainId: number | null;
  presetRefreshTrigger: number;
  showAddressNames: boolean;
}

const DECODE_TYPE_STYLE: Record<string, { bg: string; fg: string }> = {
  function: { bg: 'rgba(96,165,250,0.12)',  fg: 'var(--blue)' },
  event:    { bg: 'rgba(74,222,128,0.12)',  fg: 'var(--emerald)' },
  error:    { bg: 'rgba(255,91,110,0.14)',  fg: 'var(--red)' },
  unknown:  { bg: 'rgba(139,147,163,0.12)', fg: 'var(--fg-mute)' },
};

const TypeBadge: React.FC<{ type: string }> = ({ type }) => {
  const style = DECODE_TYPE_STYLE[type] ?? DECODE_TYPE_STYLE.unknown;
  return (
    <span
      className="rounded-xs px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em]"
      style={{ background: style.bg, color: style.fg }}
    >
      {type}
    </span>
  );
};

const HexParserPage: React.FC<HexParserPageProps> = ({
  mergedAbi,
  currentChainId,
  presetRefreshTrigger,
  showAddressNames,
}) => {
  const { t } = useTranslation();
  const [hexData, setHexData] = useState('');
  const [decodeType, setDecodeType] = useState<DecodeType>('auto');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HexParserHistory[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const lookup = useMemo(
    () => buildAddressNameLookup(loadContractPresets(), currentChainId),
    [currentChainId, presetRefreshTrigger],
  );

  useEffect(() => {
    const saved = loadHexParserResult();
    if (saved) {
      setHexData(saved.hexData || '');
      setDecodeType(saved.decodeType || 'auto');
    }
    setHistory(loadHexParserHistory());
  }, []);

  const handleDecode = () => {
    if (!hexData.trim()) {
      setError(t('hexParser.enterHexData'));
      return;
    }
    if (!mergedAbi) {
      setError(t('hexParser.selectAbiFirst'));
      return;
    }
    setError(null);

    const trimmed = hexData.trim();
    try {
      let decoded: DecodedData;
      switch (decodeType) {
        case 'function':
          decoded = decodeHexAsFunction(trimmed, mergedAbi);
          break;
        case 'event':
          decoded = decodeHexAsEvent(trimmed, mergedAbi);
          break;
        case 'error':
          decoded = decodeHexAsError(trimmed, mergedAbi);
          break;
        default:
          decoded = autoDetectAndDecode(trimmed, mergedAbi);
      }
      saveHexParserResult({ hexData: trimmed, decodeType, result: decoded });
      addHexParserHistory({ hexData: trimmed, decodeType, result: decoded, success: true });
      setHistory(loadHexParserHistory());
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('hexParser.parseFailed');
      setError(msg);
      addHexParserHistory({ hexData: trimmed, decodeType, result: null, success: false });
      setHistory(loadHexParserHistory());
    }
  };

  const handleDeleteHistory = useCallback((id: string) => {
    deleteHexParserHistory(id);
    setHistory(loadHexParserHistory());
  }, []);

  const handleClearHistory = useCallback(() => {
    if (window.confirm(t('hexParser.confirmClearHistory'))) {
      clearHexParserHistory();
      setHistory([]);
    }
  }, [t]);

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* TxBar with mode picker */}
      <div className="flex items-center gap-3 border-b border-line bg-bg px-5 py-2.5 font-mono text-[11px]">
        <span className="text-[10px] uppercase tracking-[0.2em] text-fg-mute">mode</span>
        <div className="flex gap-0.5">
          {(['auto', 'function', 'event', 'error'] as DecodeType[]).map((type) => (
            <button
              key={type}
              onClick={() => setDecodeType(type)}
              className={
                'rounded-sm px-2 py-0.5 text-[10px] transition-colors ' +
                (decodeType === type
                  ? 'bg-mint font-semibold text-bg'
                  : 'text-fg-dim hover:bg-surface-2')
              }
            >
              {type}
            </button>
          ))}
        </div>
        <span className="text-line">/</span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-fg-mute">abi</span>
        <span className={mergedAbi ? 'text-mint' : 'text-call-red'}>
          {mergedAbi ? 'loaded' : 'none'}
        </span>
      </div>

      {error && (
        <div className="border-b border-line bg-call-red/5 px-5 py-2 font-mono text-[11px] text-call-red">
          {error}
        </div>
      )}

      <div
        className="grid flex-1 min-h-0"
        style={{ gridTemplateColumns: '1fr 1fr' }}
      >
        {/* Left: input */}
        <div className="flex min-h-0 flex-col border-r border-line">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2 font-mono text-[10px]">
            <span className="uppercase tracking-[0.22em] text-fg-mute">
              {t('hexParser.hexDataLabel')}
            </span>
          </div>
          <div className="flex flex-1 flex-col p-5">
            <textarea
              value={hexData}
              onChange={(e) => setHexData(e.target.value)}
              placeholder={t('hexParser.hexDataPlaceholder')}
              className="min-h-[240px] flex-1 resize-none rounded-sm border border-line bg-bg px-3 py-2 font-mono text-[11px] text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
            />
            <button
              onClick={handleDecode}
              className="mt-3 rounded-sm bg-mint px-4 py-1.5 font-mono text-[11px] font-semibold text-bg hover:bg-mint/80"
            >
              {t('hexParser.decode')}
            </button>
          </div>
        </div>

        {/* Right: history */}
        <div className="flex min-h-0 flex-col">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2 font-mono text-[10px]">
            <span className="uppercase tracking-[0.22em] text-fg-mute">
              {t('hexParser.history')}
            </span>
            <span className="text-fg-mute">·</span>
            <span className="text-fg">{history.length}</span>
            {history.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="ml-auto rounded-sm px-2 py-0.5 text-[10px] text-fg-mute hover:bg-surface-2"
              >
                {t('debugTrace.closeAll')}
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {history.length === 0 ? (
              <div className="p-5 font-ui text-[12px] text-fg-mute">
                {t('hexParser.noHistory')}
              </div>
            ) : (
              history.map((h) => {
                const isCollapsed = collapsed.has(h.id);
                const r = h.result;
                const type = r?.type ?? 'unknown';
                return (
                  <div key={h.id} className="border-b border-line-soft">
                    <div
                      className="flex cursor-pointer items-center gap-2.5 bg-surface px-5 py-2 font-mono text-[10px]"
                      onClick={() => toggleCollapse(h.id)}
                    >
                      <span
                        className={
                          'rounded-xs px-1.5 py-0.5 text-[9px] font-bold tracking-[0.08em] ' +
                          (h.success ? 'bg-mint/15 text-mint' : 'bg-call-red/15 text-call-red')
                        }
                      >
                        {h.success ? 'OK' : 'ERR'}
                      </span>
                      <TypeBadge type={type} />
                      <span className="truncate text-fg-dim">
                        {r?.name || h.hexData.slice(0, 20) + '…'}
                      </span>
                      <span className="ml-auto text-fg-mute">
                        {new Date(h.timestamp).toLocaleTimeString()}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteHistory(h.id);
                        }}
                        className="rounded-sm px-1.5 text-fg-mute hover:bg-surface-2"
                      >
                        ×
                      </button>
                    </div>
                    {!isCollapsed && (
                      <div className="bg-surface-2 px-5 py-3 font-mono text-[10.5px] leading-[1.55]">
                        <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.22em] text-fg-mute">
                          {t('hexParser.hexData')}
                        </div>
                        <pre className="mb-3 whitespace-pre-wrap break-all rounded-sm border border-line-soft bg-bg px-2.5 py-2 text-[10.5px] text-fg-dim">
                          {h.hexData}
                        </pre>
                        {h.success && r ? (
                          <>
                            {r.signature && (
                              <div className="mb-1.5">
                                <span className="text-fg-mute">signature </span>
                                <span className="text-fg">{r.signature}</span>
                              </div>
                            )}
                            {r.args !== undefined && (
                              <>
                                <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.22em] text-fg-mute">
                                  {t('hexParser.decodedArgs')}
                                </div>
                                <div className="rounded-sm border border-line-soft bg-bg px-2.5 py-2 text-[10.5px] leading-[1.6]">
                                  <DecodedValue value={r.args as any} lookup={lookup} showNames={showAddressNames} />
                                </div>
                              </>
                            )}
                          </>
                        ) : (
                          <div className="rounded-sm border border-call-red/30 bg-call-red/5 px-2.5 py-2 text-call-red">
                            {r?.error || t('hexParser.parseFailed')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HexParserPage;
