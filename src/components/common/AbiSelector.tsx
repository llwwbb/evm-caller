import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AbiPreset } from '../../types';
import { loadAbiPresets } from '../../utils/presetStorage';

interface Props {
  selectedAbis: string[];
  selectedAbiNames: string[];
  onChange: (abis: string[], names: string[]) => void;
  onOpenPresets: () => void;
  refreshToken?: number;
}

const AbiSelector: React.FC<Props> = ({
  selectedAbis,
  selectedAbiNames,
  onChange,
  onOpenPresets,
  refreshToken,
}) => {
  const { t } = useTranslation();
  const presets = useMemo<AbiPreset[]>(() => loadAbiPresets(), [refreshToken]);
  const selectedSet = useMemo(() => new Set(selectedAbiNames), [selectedAbiNames]);

  const toggle = (p: AbiPreset) => {
    const wasSelected = selectedSet.has(p.name);
    if (wasSelected) {
      const keepIdx = selectedAbiNames
        .map((n, i) => (n === p.name ? -1 : i))
        .filter((i) => i >= 0);
      onChange(
        keepIdx.map((i) => selectedAbis[i]),
        keepIdx.map((i) => selectedAbiNames[i]),
      );
    } else {
      onChange([...selectedAbis, p.abi], [...selectedAbiNames, p.name]);
    }
  };

  const selectAll = () =>
    onChange(presets.map((p) => p.abi), presets.map((p) => p.name));

  const clear = () => onChange([], []);

  return (
    <div className="flex min-h-0 flex-col border-r border-line">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2 font-mono text-[10px]">
        <span className="uppercase tracking-[0.22em] text-fg-dim">
          {t('presetModal.abis')}
        </span>
        <span className="text-fg-mute">·</span>
        <span className="text-fg">{selectedAbiNames.length}</span>
        <button
          onClick={selectAll}
          className="ml-auto text-fg-dim hover:text-fg"
        >
          {t('presetModal.selectAll')}
        </button>
        <button onClick={clear} className="text-fg-dim hover:text-fg">
          {t('presetModal.clearAll')}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {presets.length === 0 ? (
          <div className="p-3 font-ui text-[11px] text-fg-dim">
            {t('presetModal.empty')}
          </div>
        ) : (
          presets.map((p) => {
            const checked = selectedSet.has(p.name);
            return (
              <label
                key={p.id}
                className={
                  'flex cursor-pointer items-center gap-2 border-b border-line-soft px-3 py-1.5 font-mono text-[11px] transition-colors ' +
                  (checked
                    ? 'border-l-2 border-l-mint bg-mint/5 pl-[10px]'
                    : 'border-l-2 border-l-transparent pl-[10px] hover:bg-surface-2')
                }
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(p)}
                />
                <span className="truncate text-fg">{p.name}</span>
              </label>
            );
          })
        )}
      </div>
      <div className="border-t border-line px-3 py-2">
        <button
          onClick={onOpenPresets}
          className="w-full rounded-sm border border-line bg-surface px-2 py-1 text-center font-mono text-[10px] text-fg-dim hover:bg-surface-2 hover:text-fg"
        >
          + {t('functionCall.addAbi')}
        </button>
      </div>
    </div>
  );
};

export default AbiSelector;
