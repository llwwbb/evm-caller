import React from 'react';
import { ParsedCallTrace } from '../../types';
import {
  AddressNameMap,
  formatAddress,
  CALL_TYPE_STYLE,
  REVERT_STYLE,
} from '../../utils/addressDisplay';

interface CallTreeRowProps {
  trace: ParsedCallTrace;
  depth: number;
  path: string;
  hasChildren: boolean;
  expanded: boolean;
  isSelected: boolean;
  isPinned: boolean;
  gasPercentOfParent: number; // 0..100
  addressNameMap: AddressNameMap;
  showAddressNames: boolean;
  onClick: (path: string, modifier: boolean) => void;
  onToggleExpand: (path: string) => void;
}

export function formatGas(gas: string | undefined): string {
  if (!gas) return '0';
  const n = typeof gas === 'string' ? parseInt(gas, 16) : Number(gas);
  if (isNaN(n)) return String(gas);
  return n.toLocaleString('en-US');
}

const RAIL_UNIT = '│  '; // 3 chars per depth unit — tightly aligned under mono

const CallTreeRow: React.FC<CallTreeRowProps> = ({
  trace,
  depth,
  path,
  hasChildren,
  expanded,
  isSelected,
  isPinned,
  gasPercentOfParent,
  addressNameMap,
  showAddressNames,
  onClick,
  onToggleExpand,
}) => {
  const isRevert = !!trace.error;
  const style = isRevert
    ? REVERT_STYLE
    : CALL_TYPE_STYLE[trace.type] ?? CALL_TYPE_STYLE.CALL;

  const rail = RAIL_UNIT.repeat(depth);

  const from = formatAddress(trace.from, addressNameMap, showAddressNames);
  const to = trace.to
    ? formatAddress(trace.to, addressNameMap, showAddressNames)
    : '(create)';
  const fn = trace.decodedInput?.functionName;

  const bgClass = isSelected
    ? 'bg-mint/5'
    : isPinned
    ? 'bg-mint/[0.03]'
    : 'hover:bg-surface-2';
  const leftBorder = isSelected
    ? 'border-l-2 border-mint pl-3'
    : 'border-l-2 border-transparent pl-3';

  return (
    <div
      onClick={(e) => onClick(path, e.metaKey || e.shiftKey || e.ctrlKey)}
      className={`group grid cursor-pointer items-center gap-2.5 border-b border-line-soft px-3.5 py-1.5 font-mono text-[13px] transition-colors ${bgClass} ${leftBorder}`}
      style={{ gridTemplateColumns: 'auto auto minmax(0,1fr) auto 60px auto' }}
    >
      <span className="whitespace-pre text-[12px] text-line">{rail}</span>

      <span
        className="rounded-xs px-1.5 py-0.5 text-[11px] font-bold tracking-[0.08em]"
        style={{ background: style.bg, color: style.fg }}
      >
        {style.label}
      </span>

      <span className="truncate">
        <span className="text-mint">{from}</span>
        <span className="mx-1 text-fg-mute">→</span>
        <span className="text-mint">{to}</span>
        {fn && (
          <>
            <span className="mx-1 text-fg-mute">.</span>
            <span className="text-fg">{fn}</span>
          </>
        )}
        {isPinned && <span className="ml-2 text-[11px] text-mint">📌</span>}
      </span>

      <span className="min-w-[68px] text-right text-[12px] text-fg-mute">
        {formatGas(trace.gasUsed)}
      </span>

      <span className="h-[3px] w-[60px] overflow-hidden rounded-xs bg-line-soft">
        <span
          className="block h-full"
          style={{
            width: `${Math.min(gasPercentOfParent, 100)}%`,
            background: isRevert ? 'var(--red)' : 'var(--mint)',
          }}
        />
      </span>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand(path);
        }}
        className="text-fg-mute hover:text-fg"
        title={expanded ? 'collapse' : 'expand'}
      >
        {hasChildren ? (expanded ? '▾' : '▸') : ' '}
      </button>
    </div>
  );
};

export default CallTreeRow;
