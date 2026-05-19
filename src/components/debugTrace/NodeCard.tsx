import React from 'react';
import { useTranslation } from 'react-i18next';
import { ParsedCallTrace } from '../../types';
import {
  AddressNameLookup,
  CALL_TYPE_STYLE,
  REVERT_STYLE,
} from '../../utils/addressDisplay';
import DecodedValue from '../common/DecodedValue';
import AddressBadge from '../common/AddressBadge';
import { formatGas } from './CallTreeRow';

interface NodeCardProps {
  trace: ParsedCallTrace;
  path: string;
  crumb: string;
  isFocused: boolean;
  isPinned: boolean;
  isCollapsed: boolean;
  addressNameMap: AddressNameLookup;
  showAddressNames: boolean;
  onTogglePin: (path: string) => void;
  onClose: (path: string) => void;
  onToggleCollapse: (path: string) => void;
}

const KV: React.FC<{ k: string; v: React.ReactNode }> = ({ k, v }) => (
  <div className="mb-0.5 grid grid-cols-[68px_1fr] gap-1.5">
    <span className="text-[12px] text-fg-mute">{k}</span>
    <span className="break-all text-[12px] text-fg">{v}</span>
  </div>
);

const MiniLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mb-1 mt-2.5 font-mono text-[11px] uppercase tracking-[0.22em] text-fg-mute">
    {children}
  </div>
);

const Pre: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <pre className="mt-1.5 whitespace-pre-wrap break-all rounded-sm border border-line-soft bg-bg px-2.5 py-2 text-[12px] text-fg">
    {children}
  </pre>
);

const DecodedBlock: React.FC<{
  value: any;
  lookup: AddressNameLookup;
  showNames: boolean;
}> = ({ value, lookup, showNames }) => (
  <div className="mt-1.5 rounded-sm border border-line-soft bg-bg px-2.5 py-2 text-[12px] leading-[1.6]">
    <DecodedValue value={value} lookup={lookup} showNames={showNames} />
  </div>
);

const NodeCard: React.FC<NodeCardProps> = ({
  trace,
  path,
  crumb,
  isFocused,
  isPinned,
  isCollapsed,
  addressNameMap,
  showAddressNames,
  onTogglePin,
  onClose,
  onToggleCollapse,
}) => {
  const { t } = useTranslation();
  const isRevert = !!trace.error;
  const style = isRevert
    ? REVERT_STYLE
    : CALL_TYPE_STYLE[trace.type] ?? CALL_TYPE_STYLE.CALL;


  return (
    <div className={isFocused ? 'bg-surface-2' : 'bg-surface'}>
      <div
        className="flex cursor-pointer items-center gap-2.5 border-b border-line-soft px-3.5 py-2 font-mono text-[12px]"
        onClick={() => onToggleCollapse(path)}
      >
        <span
          className="rounded-xs px-1.5 py-0.5 text-[11px] font-bold tracking-[0.08em]"
          style={{ background: style.bg, color: style.fg }}
        >
          {style.label}
        </span>
        <span className="flex-1 truncate text-fg-dim" title={crumb}>
          {crumb}
        </span>
        {isFocused && (
          <span className="text-[11px] uppercase tracking-[0.18em] text-mint">
            {t('debugTrace.focused')}
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin(path);
          }}
          title={isPinned ? t('debugTrace.unpin') : t('debugTrace.pin')}
          className={`rounded-sm px-1.5 py-0.5 text-[13px] hover:bg-surface-2 ${
            isPinned ? 'text-mint' : 'text-fg-mute'
          }`}
        >
          📌
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose(path);
          }}
          title={t('debugTrace.close')}
          className="rounded-sm px-1.5 py-0.5 text-[14px] text-fg-mute hover:bg-surface-2"
        >
          ×
        </button>
      </div>

      {!isCollapsed && (
        <div className="overflow-auto px-3.5 py-3 font-mono text-[12px] leading-[1.55]">
          <KV
            k="from"
            v={
              <span className="inline-flex gap-1.5">
                <span className="break-all">{trace.from}</span>
                <span className="text-fg-dim">
                  (<AddressBadge addr={trace.from} lookup={addressNameMap} showNames={showAddressNames} />)
                </span>
              </span>
            }
          />
          <KV
            k="to"
            v={
              trace.to ? (
                <span className="inline-flex gap-1.5">
                  <span className="break-all">{trace.to}</span>
                  <span className="text-fg-dim">
                    (<AddressBadge addr={trace.to} lookup={addressNameMap} showNames={showAddressNames} />)
                  </span>
                </span>
              ) : (
                '(contract creation)'
              )
            }
          />
          <KV k="gas" v={`${formatGas(trace.gasUsed)} / ${formatGas(trace.gas)}`} />
          {trace.decodedInput?.signature && (
            <KV k="sig" v={trace.decodedInput.signature} />
          )}

          {trace.decodedInput ? (
            <>
              <MiniLabel>
                {t('debugTrace.input')} — {trace.decodedInput.functionName}
              </MiniLabel>
              <DecodedBlock
                value={trace.decodedInput.args}
                lookup={addressNameMap}
                showNames={showAddressNames}
              />
            </>
          ) : trace.input && trace.input !== '0x' ? (
            <>
              <MiniLabel>{t('debugTrace.rawInput')}</MiniLabel>
              <Pre>{trace.input}</Pre>
            </>
          ) : null}

          {isRevert ? (
            <>
              <MiniLabel>{t('debugTrace.output')} — revert</MiniLabel>
              <div className="rounded-sm border border-call-red/30 bg-call-red/5 px-2.5 py-2 text-call-red">
                {trace.decodedError?.errorName ? (
                  <>
                    <div className="font-semibold">
                      {trace.decodedError.errorName}
                    </div>
                    {trace.decodedError.args && (
                      <div className="mt-1">
                        <DecodedValue
                          value={trace.decodedError.args}
                          lookup={addressNameMap}
                          showNames={showAddressNames}
                        />
                      </div>
                    )}
                    {trace.decodedError.signature && (
                      <div className="mt-0.5 text-[11px] text-fg-dim">
                        selector {trace.decodedError.signature}
                      </div>
                    )}
                  </>
                ) : trace.revertReason ? (
                  <div>{trace.revertReason}</div>
                ) : (
                  <div className="break-all">{trace.error}</div>
                )}
              </div>
            </>
          ) : trace.output && trace.output !== '0x' ? (
            <>
              <MiniLabel>{t('debugTrace.output')}</MiniLabel>
              {trace.decodedOutput !== undefined ? (
                <DecodedBlock
                  value={trace.decodedOutput}
                  lookup={addressNameMap}
                  showNames={showAddressNames}
                />
              ) : (
                <Pre>{trace.output}</Pre>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default NodeCard;
