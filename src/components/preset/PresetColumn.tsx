import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface PresetColumnItem {
  id: string;
  label: string;
  detail?: string;
  /** If set, the edit form pre-fills with this instead of `detail`. Use when `detail` is a short preview (e.g. "100 chars") rather than the full value. */
  editDetail?: string;
}

interface PresetColumnProps {
  title: string;
  items: PresetColumnItem[];
  mode: 'single' | 'multi';
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onAdd: (label: string, detail: string) => void;
  onEdit: (id: string, label: string, detail: string) => void;
  onDelete: (id: string) => void;
  addLabelPlaceholder: string;
  addDetailPlaceholder: string;
  addDetailMultiline?: boolean;
  /** Only meaningful in mode="multi". Replaces the entire selection in one call. */
  onBulkSet?: (ids: Set<string>) => void;
}

const PresetColumn: React.FC<PresetColumnProps> = ({
  title,
  items,
  mode,
  selectedIds,
  onToggle,
  onAdd,
  onEdit,
  onDelete,
  addLabelPlaceholder,
  addDetailPlaceholder,
  addDetailMultiline = false,
  onBulkSet,
}) => {
  const { t } = useTranslation();
  const [isAdding, setIsAdding] = useState(false);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftDetail, setDraftDetail] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editDetail, setEditDetail] = useState('');

  const startEdit = (item: PresetColumnItem) => {
    setEditingId(item.id);
    setEditLabel(item.label);
    setEditDetail(item.editDetail ?? item.detail ?? '');
  };

  const commitEdit = () => {
    if (editingId && editLabel.trim()) {
      onEdit(editingId, editLabel.trim(), editDetail.trim());
    }
    setEditingId(null);
  };

  const commitAdd = () => {
    if (draftLabel.trim()) {
      onAdd(draftLabel.trim(), draftDetail.trim());
      setDraftLabel('');
      setDraftDetail('');
      setIsAdding(false);
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-col border-r border-line last:border-r-0">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.22em] text-fg-mute">
          {title}
        </h3>
        {mode === 'multi' && onBulkSet && items.length > 0 && (() => {
          const allSelected = items.every((i) => selectedIds.has(i.id));
          return (
            <button
              onClick={() =>
                onBulkSet(allSelected ? new Set() : new Set(items.map((i) => i.id)))
              }
              className="ml-auto rounded-sm px-2 py-0.5 font-mono text-[11px] text-fg-dim hover:bg-surface-2"
            >
              {allSelected ? t('presetModal.clearAll') : t('presetModal.selectAll')}
            </button>
          );
        })()}
        <button
          onClick={() => setIsAdding(!isAdding)}
          className={
            'rounded-sm px-2 py-0.5 font-mono text-[11px] text-fg-dim hover:bg-surface-2 ' +
            (mode === 'multi' && onBulkSet && items.length > 0 ? '' : 'ml-auto')
          }
        >
          {isAdding ? '×' : '+ add'}
        </button>
      </div>

      {isAdding && (
        <div className="space-y-2 border-b border-line bg-surface-2 p-3">
          <input
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            placeholder={addLabelPlaceholder}
            className="w-full rounded-sm border border-line bg-bg px-2 py-1 font-ui text-[13px] text-fg placeholder:text-fg-mute"
          />
          {addDetailMultiline ? (
            <textarea
              value={draftDetail}
              onChange={(e) => setDraftDetail(e.target.value)}
              placeholder={addDetailPlaceholder}
              rows={5}
              className="w-full rounded-sm border border-line bg-bg px-2 py-1 font-mono text-[12px] text-fg placeholder:text-fg-mute"
            />
          ) : (
            <input
              value={draftDetail}
              onChange={(e) => setDraftDetail(e.target.value)}
              placeholder={addDetailPlaceholder}
              className="w-full rounded-sm border border-line bg-bg px-2 py-1 font-mono text-[12px] text-fg placeholder:text-fg-mute"
            />
          )}
          <button
            onClick={commitAdd}
            className="rounded-sm bg-mint px-3 py-1 font-mono text-[12px] text-bg"
          >
            {t('presetModal.save')}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 && !isAdding && (
          <div className="p-4 font-ui text-[13px] text-fg-mute">
            {t('presetModal.empty')}
          </div>
        )}
        {items.map((item) => {
          const selected = selectedIds.has(item.id);
          const editing = editingId === item.id;
          return (
            <div
              key={item.id}
              className={
                'group border-b border-line-soft px-4 py-2.5 transition-colors ' +
                (selected ? 'bg-mint/5' : 'hover:bg-surface-2')
              }
            >
              {editing ? (
                <div className="space-y-2">
                  <input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="w-full rounded-sm border border-line bg-bg px-2 py-1 font-ui text-[13px]"
                  />
                  {addDetailMultiline ? (
                    <textarea
                      value={editDetail}
                      onChange={(e) => setEditDetail(e.target.value)}
                      rows={5}
                      className="w-full rounded-sm border border-line bg-bg px-2 py-1 font-mono text-[12px]"
                    />
                  ) : (
                    <input
                      value={editDetail}
                      onChange={(e) => setEditDetail(e.target.value)}
                      className="w-full rounded-sm border border-line bg-bg px-2 py-1 font-mono text-[12px]"
                    />
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={commitEdit}
                      className="rounded-sm bg-mint px-2 py-0.5 font-mono text-[11px] text-bg"
                    >
                      {t('presetModal.save')}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-sm px-2 py-0.5 font-mono text-[11px] text-fg-dim hover:bg-surface-2"
                    >
                      {t('presetModal.cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <button
                    onClick={() => onToggle(item.id)}
                    className={
                      'mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-xs border text-[11px] ' +
                      (selected
                        ? 'border-mint bg-mint text-bg'
                        : 'border-line bg-bg')
                    }
                    title={mode === 'single' ? 'select' : 'toggle'}
                  >
                    {selected && (mode === 'single' ? '●' : '✓')}
                  </button>
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onToggle(item.id)}>
                    <div className="font-ui text-[14px] font-medium text-fg">
                      {item.label}
                    </div>
                    {item.detail && (
                      <div className="mt-0.5 truncate font-mono text-[11px] text-fg-mute">
                        {item.detail}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => startEdit(item)}
                      className="rounded-sm px-1.5 py-0.5 font-mono text-[11px] text-fg-dim hover:bg-surface-2"
                    >
                      {t('presetModal.edit')}
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(t('presetModal.confirmDelete'))) {
                          onDelete(item.id);
                        }
                      }}
                      className="rounded-sm px-1.5 py-0.5 font-mono text-[11px] text-call-red hover:bg-surface-2"
                    >
                      {t('presetModal.delete')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PresetColumn;
