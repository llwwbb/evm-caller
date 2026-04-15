import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PresetColumn, { PresetColumnItem } from './PresetColumn';
import {
  loadRpcPresets, saveRpcPreset, updateRpcPreset, deleteRpcPreset,
  loadContractPresets, saveContractPreset, updateContractPreset, deleteContractPreset,
  loadAbiPresets, saveAbiPreset, updateAbiPreset, deleteAbiPreset,
} from '../../utils/presetStorage';

interface PresetModalProps {
  open: boolean;
  onClose: () => void;
  currentRpcUrl: string;
  currentContractAddress: string;
  currentAbis: string[];
  onRpcUrlChange: (url: string) => void;
  onContractAddressChange: (addr: string) => void;
  onAbisChange: (abis: string[], names: string[]) => void;
  refreshToken: number;
  onRefreshPresets: () => void;
}

const PresetModal: React.FC<PresetModalProps> = ({
  open,
  onClose,
  currentRpcUrl,
  currentContractAddress,
  currentAbis,
  onRpcUrlChange,
  onContractAddressChange,
  onAbisChange,
  refreshToken,
  onRefreshPresets,
}) => {
  const { t } = useTranslation();
  const [rpcs, setRpcs] = useState(() => loadRpcPresets());
  const [contracts, setContracts] = useState(() => loadContractPresets());
  const [abis, setAbis] = useState(() => loadAbiPresets());

  useEffect(() => {
    if (open) {
      setRpcs(loadRpcPresets());
      setContracts(loadContractPresets());
      setAbis(loadAbiPresets());
    }
  }, [open, refreshToken]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const selectedAbiIds = useMemo(() => {
    const set = new Set<string>();
    for (const a of abis) {
      if (currentAbis.includes(a.abi)) set.add(a.id);
    }
    return set;
  }, [abis, currentAbis]);

  const selectedRpcId = useMemo(
    () => rpcs.find((r) => r.rpcUrl === currentRpcUrl)?.id ?? null,
    [rpcs, currentRpcUrl]
  );
  const selectedContractId = useMemo(
    () =>
      contracts.find(
        (c) => c.address.toLowerCase() === currentContractAddress.toLowerCase()
      )?.id ?? null,
    [contracts, currentContractAddress]
  );

  const rpcItems: PresetColumnItem[] = rpcs.map((r) => ({
    id: r.id,
    label: r.name,
    detail: r.rpcUrl,
  }));
  const contractItems: PresetColumnItem[] = contracts.map((c) => ({
    id: c.id,
    label: c.name,
    detail: c.address,
  }));
  const abiItems: PresetColumnItem[] = abis.map((a) => ({
    id: a.id,
    label: a.name,
    detail: `${a.abi.length} chars`,
  }));

  const commitAbis = (idSet: Set<string>) => {
    const selectedAbis: string[] = [];
    const selectedNames: string[] = [];
    for (const a of abis) {
      if (idSet.has(a.id)) {
        selectedAbis.push(a.abi);
        selectedNames.push(a.name);
      }
    }
    onAbisChange(selectedAbis, selectedNames);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[80vh] w-[min(1200px,92vw)] flex-col overflow-hidden rounded border border-line bg-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-line px-5 py-3">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-fg-dim">
            {t('presetModal.title')}
          </h2>
          <button
            onClick={onClose}
            className="ml-auto rounded-sm px-2 py-0.5 font-mono text-[11px] text-fg-dim hover:bg-surface-2"
          >
            Esc
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-3">
          <PresetColumn
            title={t('presetModal.rpc')}
            items={rpcItems}
            mode="single"
            selectedIds={new Set(selectedRpcId ? [selectedRpcId] : [])}
            onToggle={(id) => {
              const r = rpcs.find((x) => x.id === id);
              if (r) onRpcUrlChange(r.rpcUrl);
            }}
            onAdd={(label, detail) => {
              saveRpcPreset(label, detail);
              setRpcs(loadRpcPresets());
              onRefreshPresets();
            }}
            onEdit={(id, label, detail) => {
              updateRpcPreset(id, { name: label, rpcUrl: detail });
              setRpcs(loadRpcPresets());
              onRefreshPresets();
            }}
            onDelete={(id) => {
              deleteRpcPreset(id);
              setRpcs(loadRpcPresets());
              onRefreshPresets();
            }}
            addLabelPlaceholder={t('presetModal.rpcNamePlaceholder')}
            addDetailPlaceholder={t('presetModal.rpcUrlPlaceholder')}
          />
          <PresetColumn
            title={t('presetModal.contracts')}
            items={contractItems}
            mode="single"
            selectedIds={new Set(selectedContractId ? [selectedContractId] : [])}
            onToggle={(id) => {
              const c = contracts.find((x) => x.id === id);
              if (c) onContractAddressChange(c.address);
            }}
            onAdd={(label, detail) => {
              saveContractPreset(label, detail);
              setContracts(loadContractPresets());
              onRefreshPresets();
            }}
            onEdit={(id, label, detail) => {
              updateContractPreset(id, { name: label, address: detail });
              setContracts(loadContractPresets());
              onRefreshPresets();
            }}
            onDelete={(id) => {
              deleteContractPreset(id);
              setContracts(loadContractPresets());
              onRefreshPresets();
            }}
            addLabelPlaceholder={t('presetModal.contractNamePlaceholder')}
            addDetailPlaceholder={t('presetModal.contractAddressPlaceholder')}
          />
          <PresetColumn
            title={t('presetModal.abis')}
            items={abiItems}
            mode="multi"
            selectedIds={selectedAbiIds}
            onToggle={(id) => {
              const next = new Set(selectedAbiIds);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              commitAbis(next);
            }}
            onAdd={(label, detail) => {
              saveAbiPreset(label, detail);
              setAbis(loadAbiPresets());
              onRefreshPresets();
            }}
            onEdit={(id, label, detail) => {
              updateAbiPreset(id, { name: label, abi: detail });
              setAbis(loadAbiPresets());
              onRefreshPresets();
            }}
            onDelete={(id) => {
              const deleted = abis.find((a) => a.id === id);
              deleteAbiPreset(id);
              setAbis(loadAbiPresets());
              onRefreshPresets();
              if (deleted && currentAbis.includes(deleted.abi)) {
                const nextIds = new Set(selectedAbiIds);
                nextIds.delete(id);
                commitAbis(nextIds);
              }
            }}
            addLabelPlaceholder={t('presetModal.abiNamePlaceholder')}
            addDetailPlaceholder={t('presetModal.abiPlaceholder')}
            addDetailMultiline
            onBulkSet={(idSet) => commitAbis(idSet)}
          />
        </div>
      </div>
    </div>
  );
};

export default PresetModal;
