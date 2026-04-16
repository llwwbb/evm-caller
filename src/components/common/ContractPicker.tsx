import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { loadContractPresets } from '../../utils/presetStorage';
import { ContractPreset, ContractEntry } from '../../types';

interface Props {
  value: string;
  onChange: (address: string, preset?: ContractPreset, entry?: ContractEntry) => void;
  currentChainId: number | null;
  placeholder?: string;
  width?: string;
  refreshToken?: number;
}

interface Row {
  preset: ContractPreset;
  entry: ContractEntry;
}

function chainLabel(chainId?: number): string {
  if (chainId == null) return '';
  const known: Record<number, string> = {
    1: 'ETH', 10: 'OP', 56: 'BSC', 137: 'POL', 8453: 'BASE', 42161: 'ARB',
    43114: 'AVAX', 11155111: 'SEP',
  };
  return known[chainId] ?? String(chainId);
}

const ContractPicker: React.FC<Props> = ({
  value,
  onChange,
  currentChainId,
  placeholder,
  width,
  refreshToken,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [showAllChains, setShowAllChains] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const presets = useMemo(() => loadContractPresets(), [refreshToken]);
  const q = isTyping ? value.trim().toLowerCase() : '';

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const p of presets) {
      for (const e of p.entries) {
        if (!e.address) continue;
        const chainVisible =
          showAllChains ||
          currentChainId == null ||
          e.chainId == null ||
          e.chainId === currentChainId;
        if (!chainVisible) continue;
        if (q) {
          const hit =
            p.name.toLowerCase().includes(q) ||
            e.address.toLowerCase().includes(q);
          if (!hit) continue;
        }
        out.push({ preset: p, entry: e });
      }
    }
    return out;
  }, [presets, q, currentChainId, showAllChains]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setIsTyping(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const pick = (r: Row) => {
    onChange(r.entry.address, r.preset, r.entry);
    setOpen(false);
    setIsTyping(false);
  };

  return (
    <div ref={wrapRef} className="relative" style={{ width }}>
      <div className="relative">
        <input
          value={value}
          onFocus={() => { setOpen(true); setIsTyping(false); setActiveIdx(0); }}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setIsTyping(true);
            setActiveIdx(0);
          }}
          onKeyDown={(e) => {
            if (!open) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIdx((i) => Math.min(i + 1, rows.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter' && rows[activeIdx]) {
              e.preventDefault();
              pick(rows[activeIdx]);
            } else if (e.key === 'Escape') {
              setOpen(false);
              setIsTyping(false);
            }
          }}
          placeholder={placeholder ?? '0x...'}
          className="w-full rounded-sm border border-line bg-bg py-1 pl-2 pr-6 font-mono text-[11px] text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
        />
        {value && (
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              onChange('');
              setOpen(true);
              setIsTyping(false);
              setActiveIdx(0);
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-xs px-1 text-[10px] text-fg-mute hover:text-fg"
          >
            ×
          </button>
        )}
      </div>
      {open && (
        <div className="absolute left-0 right-0 z-40 mt-0.5 rounded-sm border border-line bg-surface font-mono text-[11px] shadow-lg">
          {currentChainId != null && (
            <label className="flex cursor-pointer items-center gap-1.5 border-b border-line-soft px-2.5 py-1 text-[10px] text-fg-dim">
              <input
                type="checkbox"
                checked={showAllChains}
                onChange={(e) => setShowAllChains(e.target.checked)}
              />
              {t('picker.showAllChains')}
            </label>
          )}
          {rows.length === 0 ? (
            <div className="px-2.5 py-1.5 text-fg-dim">{t('picker.noMatch')}</div>
          ) : (
            <ul className="max-h-60 overflow-y-auto">
              {rows.map((r, i) => (
                <li
                  key={`${r.preset.id}:${r.entry.address}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(r);
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={
                    'flex cursor-pointer items-center gap-2 px-2.5 py-1.5 ' +
                    (i === activeIdx ? 'bg-surface-2' : '')
                  }
                >
                  <span className="rounded-xs bg-mint/15 px-1.5 text-[9px] font-bold text-mint">
                    {r.entry.chainId != null ? chainLabel(r.entry.chainId) : 'ALL'}
                  </span>
                  <span className="text-fg">{r.preset.name}</span>
                  <span className="ml-auto truncate text-fg-dim">
                    {r.entry.address}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default ContractPicker;
