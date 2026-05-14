import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadPresetsAsJson, importPresetsFromFile } from '../../utils/presetStorage';

interface ConfigModalProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

const ConfigModal: React.FC<ConfigModalProps> = ({ open, onClose, onImportComplete }) => {
  const { t } = useTranslation();
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    imported: { rpc: number; contract: number; abi: number };
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setImportResult(null);
  }, [open]);

  const handleExport = () => {
    try {
      downloadPresetsAsJson();
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await importPresetsFromFile(file, importMode);
      setImportResult(result);
      if (result.success) {
        onImportComplete();
        setTimeout(() => {
          setImportResult(null);
          onClose();
        }, 1500);
      }
    } catch (err) {
      setImportResult({
        success: false,
        message: err instanceof Error ? err.message : 'Unknown error',
        imported: { rpc: 0, contract: 0, abi: 0 },
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-[min(560px,92vw)] flex-col overflow-hidden rounded border border-line bg-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-line px-5 py-3">
          <h2 className="font-mono text-[12px] uppercase tracking-[0.22em] text-fg-dim">
            {t('configManager.title')}
          </h2>
          <button
            onClick={onClose}
            className="ml-auto rounded-sm px-2 py-0.5 font-mono text-[12px] text-fg-dim hover:bg-surface-2"
          >
            Esc
          </button>
        </div>

        <div className="space-y-5 p-5 font-ui text-[13px] text-fg-dim">
          {/* Export */}
          <div>
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">
              {t('configManager.exportTitle')}
            </div>
            <p className="mb-2 text-[12px] text-fg-mute">
              {t('configManager.exportDescription')}
            </p>
            <button
              onClick={handleExport}
              className="rounded-sm border border-line px-3 py-1.5 font-mono text-[12px] text-fg hover:bg-surface-2"
            >
              ↓ {t('configManager.exportButton')}
            </button>
          </div>

          {/* Import */}
          <div className="border-t border-line pt-4">
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">
              {t('configManager.importTitle')}
            </div>
            <p className="mb-2 text-[12px] text-fg-mute">
              {t('configManager.importDescription')}
            </p>
            <div className="mb-3 flex gap-2">
              <label className="flex cursor-pointer items-center gap-2 font-mono text-[12px]">
                <input
                  type="radio"
                  name="importMode"
                  value="merge"
                  checked={importMode === 'merge'}
                  onChange={() => setImportMode('merge')}
                  className="accent-mint"
                />
                <span className="text-fg">{t('configManager.mergeMode')}</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 font-mono text-[12px]">
                <input
                  type="radio"
                  name="importMode"
                  value="replace"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="accent-mint"
                />
                <span className="text-fg">{t('configManager.replaceMode')}</span>
              </label>
            </div>
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={handleImportClick}
              className="rounded-sm bg-mint px-3 py-1.5 font-mono text-[12px] font-semibold text-bg hover:bg-mint/80"
            >
              ↑ {t('configManager.importButton')}
            </button>
          </div>

          {importResult && (
            <div
              className={
                'rounded-sm border px-3 py-2 font-mono text-[12px] ' +
                (importResult.success
                  ? 'border-mint/30 bg-mint/5 text-mint'
                  : 'border-call-red/30 bg-call-red/5 text-call-red')
              }
            >
              <div className="font-semibold">{importResult.message}</div>
              {importResult.success && (
                <div className="mt-1 text-[11px] text-fg-dim">
                  rpc: {importResult.imported.rpc} · contracts:{' '}
                  {importResult.imported.contract} · abis: {importResult.imported.abi}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfigModal;
