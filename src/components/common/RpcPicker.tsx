import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { loadRpcPresets } from '../../utils/presetStorage';
import { RpcPreset } from '../../types';

interface Props {
  value: string;
  onChange: (rpcUrl: string, preset?: RpcPreset) => void;
  placeholder?: string;
  width?: string;
  refreshToken?: number;
}

function chainLabel(chainId?: number): string {
  if (chainId == null) return '';
  const known: Record<number, string> = {
    1: 'ETH', 10: 'OP', 56: 'BSC', 137: 'POL', 8453: 'BASE', 42161: 'ARB',
    43114: 'AVAX', 11155111: 'SEP',
  };
  return known[chainId] ?? String(chainId);
}

const RpcPicker: React.FC<Props> = ({
  value,
  onChange,
  placeholder,
  width,
  refreshToken,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const presets = useMemo(() => loadRpcPresets(), [refreshToken]);
  const q = value.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return presets;
    return presets.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.rpcUrl.toLowerCase().includes(q) ||
      String(p.chainId ?? '').includes(q),
    );
  }, [presets, q]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const pick = (p: RpcPreset) => {
    onChange(p.rpcUrl, p);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative" style={{ width }}>
      <input
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActiveIdx(0);
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIdx((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter' && filtered[activeIdx]) {
            e.preventDefault();
            pick(filtered[activeIdx]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        placeholder={placeholder ?? 'https://...'}
        className="w-full rounded-sm border border-line bg-bg px-2 py-1 font-mono text-[11px] text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute left-0 right-0 z-40 mt-0.5 max-h-60 overflow-y-auto rounded-sm border border-line bg-surface font-mono text-[11px] shadow-lg">
          {filtered.map((p, i) => (
            <li
              key={p.id}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              onMouseEnter={() => setActiveIdx(i)}
              className={
                'flex cursor-pointer items-center gap-2 px-2.5 py-1.5 ' +
                (i === activeIdx ? 'bg-surface-2' : '')
              }
            >
              {p.chainId != null && (
                <span className="rounded-xs bg-mint/15 px-1.5 text-[9px] font-bold text-mint">
                  {chainLabel(p.chainId)}
                </span>
              )}
              <span className="text-fg">{p.name}</span>
              <span className="ml-auto truncate text-fg-dim">{p.rpcUrl}</span>
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && (
        <div className="absolute left-0 right-0 z-40 mt-0.5 rounded-sm border border-line bg-surface px-2.5 py-1.5 font-mono text-[11px] text-fg-dim">
          {t('picker.noMatch')}
        </div>
      )}
    </div>
  );
};

export default RpcPicker;
