import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ContractPreset, ContractEntry } from '../../types';

interface Props {
  title: string;
  items: ContractPreset[];
  currentAddress: string;
  onPickAddress: (address: string) => void;
  onAdd: (name: string, entries: ContractEntry[], description?: string) => void;
  onEdit: (id: string, updates: { name?: string; description?: string; entries?: ContractEntry[] }) => void;
  onDelete: (id: string) => void;
}

function makeEmptyEntry(): ContractEntry {
  return { address: '' };
}

const ContractPresetColumn: React.FC<Props> = ({
  title,
  items,
  currentAddress,
  onPickAddress,
  onAdd,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const matched = new Set<string>();
  const loweredCurrent = currentAddress.toLowerCase();
  for (const p of items) {
    for (const e of p.entries) {
      if (e.address.toLowerCase() === loweredCurrent && loweredCurrent) matched.add(p.id);
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-col border-r border-line last:border-r-0">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.22em] text-fg-mute">{title}</h3>
        <button
          onClick={() => setIsAdding((v) => !v)}
          className="ml-auto rounded-sm px-2 py-0.5 font-mono text-[11px] text-fg-dim hover:bg-surface-2 hover:text-fg"
        >
          {isAdding ? '×' : '+ add'}
        </button>
      </div>

      {isAdding && (
        <div className="border-b border-line bg-surface-2 p-3">
          <NewContractForm
            onCancel={() => setIsAdding(false)}
            onSave={(name, entries, description) => {
              onAdd(name, entries, description);
              setIsAdding(false);
            }}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 && !isAdding && (
          <div className="p-4 font-ui text-[13px] text-fg-mute">{t('presetModal.empty')}</div>
        )}
        {items.map((preset) => {
          const selected = matched.has(preset.id);
          const editing = editingId === preset.id;
          if (editing) {
            return (
              <div
                key={preset.id}
                className="border-b border-line-soft bg-surface-2 px-4 py-3"
              >
                <EditContractForm
                  initial={preset}
                  onCancel={() => setEditingId(null)}
                  onSave={(updates) => {
                    onEdit(preset.id, updates);
                    setEditingId(null);
                  }}
                />
              </div>
            );
          }
          return (
            <div
              key={preset.id}
              className={
                'group border-b border-line-soft px-4 py-2.5 transition-colors ' +
                (selected ? 'bg-mint/5' : 'hover:bg-surface-2')
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-ui text-[14px] font-medium text-fg">{preset.name}</div>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => setEditingId(preset.id)}
                    className="rounded-sm px-1.5 py-0.5 font-mono text-[11px] text-fg-dim hover:bg-surface-2 hover:text-fg"
                  >
                    {t('presetModal.edit')}
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(t('presetModal.confirmDelete'))) onDelete(preset.id);
                    }}
                    className="rounded-sm px-1.5 py-0.5 font-mono text-[11px] text-call-red hover:bg-surface-2"
                  >
                    {t('presetModal.delete')}
                  </button>
                </div>
              </div>
              {preset.description && (
                <div className="mb-1 mt-0.5 font-ui text-[12px] text-fg-dim">{preset.description}</div>
              )}
              <div className="mt-1 space-y-0.5">
                {preset.entries.map((entry, i) => {
                  const isCurrent =
                    entry.address.toLowerCase() === loweredCurrent && loweredCurrent;
                  return (
                    <button
                      key={i}
                      onClick={() => entry.address && onPickAddress(entry.address)}
                      disabled={!entry.address}
                      className={
                        'group/row flex w-full items-center gap-2 rounded-xs px-1.5 py-0.5 font-mono text-[10.5px] text-left transition-colors ' +
                        (isCurrent
                          ? 'bg-mint/10 text-fg'
                          : 'text-fg-dim hover:bg-surface hover:text-fg disabled:hover:bg-transparent')
                      }
                    >
                      <span className={
                        'inline-block w-12 flex-shrink-0 rounded-xs px-1 text-center text-[10px] ' +
                        (entry.chainId == null
                          ? 'bg-mint/15 font-bold text-mint'
                          : 'bg-surface-2 text-fg-dim')
                      }>
                        {entry.chainId ?? 'ALL'}
                      </span>
                      <span className="truncate">{entry.address || '(empty)'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// -------- inner forms --------

const inputCls =
  'rounded-sm border border-line bg-bg px-2 py-1 font-mono text-[12px] text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none';

const NewContractForm: React.FC<{
  onCancel: () => void;
  onSave: (name: string, entries: ContractEntry[], description?: string) => void;
}> = ({ onCancel, onSave }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [entries, setEntries] = useState<ContractEntry[]>([makeEmptyEntry()]);

  const update = (i: number, e: ContractEntry) =>
    setEntries((prev) => prev.map((p, j) => (j === i ? e : p)));

  const canSave = name.trim() && entries.some((e) => e.address.trim());

  return (
    <div className="space-y-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('presetModal.contractNamePlaceholder')}
        className={`w-full ${inputCls}`}
      />
      <div className="space-y-1.5">
        {entries.map((entry, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              value={
                typeof entry.chainId === 'number' && Number.isFinite(entry.chainId)
                  ? entry.chainId
                  : ''
              }
              onChange={(e) => {
                const v = e.target.value;
                if (v === '' || /^\d+$/.test(v)) {
                  update(i, { ...entry, chainId: v === '' ? undefined : Number(v) });
                }
              }}
              inputMode="numeric"
              placeholder="ALL"
              className={`w-[84px] ${inputCls}`}
            />
            <input
              value={entry.address}
              onChange={(e) => update(i, { ...entry, address: e.target.value })}
              placeholder="0x..."
              className={`flex-1 min-w-0 ${inputCls}`}
            />
            {entries.length > 1 && (
              <button
                onClick={() => setEntries((prev) => prev.filter((_, j) => j !== i))}
                className="rounded-sm px-1.5 text-fg-dim hover:bg-surface-2 hover:text-call-red"
                title={t('presetModal.delete')}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          onClick={() => setEntries((prev) => [...prev, makeEmptyEntry()])}
          className="rounded-sm border border-line bg-surface px-2 py-0.5 text-[11px] text-fg-dim hover:bg-surface-2 hover:text-fg"
        >
          + {t('contractPreset.addEntry')}
        </button>
      </div>
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t('presetModal.descriptionPlaceholder')}
        className={`w-full ${inputCls}`}
      />
      <div className="flex gap-2">
        <button
          onClick={() =>
            onSave(
              name.trim(),
              entries.filter((e) => e.address.trim()),
              description.trim() || undefined,
            )
          }
          disabled={!canSave}
          className="rounded-sm bg-mint px-3 py-1 font-mono text-[11px] font-semibold text-bg hover:bg-mint/80 disabled:bg-line disabled:text-fg-mute"
        >
          {t('presetModal.save')}
        </button>
        <button
          onClick={onCancel}
          className="rounded-sm border border-line px-3 py-1 font-mono text-[11px] text-fg-dim hover:bg-surface-2 hover:text-fg"
        >
          {t('presetModal.cancel')}
        </button>
      </div>
    </div>
  );
};

const EditContractForm: React.FC<{
  initial: ContractPreset;
  onCancel: () => void;
  onSave: (updates: { name?: string; description?: string; entries?: ContractEntry[] }) => void;
}> = ({ initial, onCancel, onSave }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? '');
  const [entries, setEntries] = useState<ContractEntry[]>(() =>
    initial.entries.length ? initial.entries.map((e) => ({ ...e })) : [makeEmptyEntry()],
  );

  const update = (i: number, e: ContractEntry) =>
    setEntries((prev) => prev.map((p, j) => (j === i ? e : p)));

  const canSave = name.trim() && entries.some((e) => e.address.trim());

  return (
    <div className="space-y-2">
      <input value={name} onChange={(e) => setName(e.target.value)} className={`w-full ${inputCls}`} />
      <div className="space-y-1.5">
        {entries.map((entry, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              value={
                typeof entry.chainId === 'number' && Number.isFinite(entry.chainId)
                  ? entry.chainId
                  : ''
              }
              onChange={(e) => {
                const v = e.target.value;
                if (v === '' || /^\d+$/.test(v)) {
                  update(i, { ...entry, chainId: v === '' ? undefined : Number(v) });
                }
              }}
              inputMode="numeric"
              placeholder="ALL"
              className={`w-[84px] ${inputCls}`}
            />
            <input
              value={entry.address}
              onChange={(e) => update(i, { ...entry, address: e.target.value })}
              placeholder="0x..."
              className={`flex-1 min-w-0 ${inputCls}`}
            />
            {entries.length > 1 && (
              <button
                onClick={() => setEntries((prev) => prev.filter((_, j) => j !== i))}
                className="rounded-sm px-1.5 text-fg-dim hover:bg-surface-2 hover:text-call-red"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          onClick={() => setEntries((prev) => [...prev, makeEmptyEntry()])}
          className="rounded-sm border border-line bg-surface px-2 py-0.5 text-[11px] text-fg-dim hover:bg-surface-2 hover:text-fg"
        >
          + {t('contractPreset.addEntry')}
        </button>
      </div>
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t('presetModal.descriptionPlaceholder')}
        className={`w-full ${inputCls}`}
      />
      <div className="flex gap-2">
        <button
          onClick={() =>
            onSave({
              name: name.trim(),
              description: description.trim() || undefined,
              entries: entries.filter((e) => e.address.trim()),
            })
          }
          disabled={!canSave}
          className="rounded-sm bg-mint px-3 py-1 font-mono text-[11px] font-semibold text-bg hover:bg-mint/80 disabled:bg-line disabled:text-fg-mute"
        >
          {t('presetModal.save')}
        </button>
        <button
          onClick={onCancel}
          className="rounded-sm border border-line px-3 py-1 font-mono text-[11px] text-fg-dim hover:bg-surface-2 hover:text-fg"
        >
          {t('presetModal.cancel')}
        </button>
      </div>
    </div>
  );
};

export default ContractPresetColumn;
