import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EncodingMode,
  OperationType,
  TypeDefPreset,
  AbiEncoderHistory,
} from '../types';
import {
  abiEncode,
  abiDecode,
  packedEncode,
  packedDecode,
  formatOutput,
  getCommonTypes,
  isValidType,
  areAllTypesFixedLength,
  getDynamicTypes,
} from '../utils/abiEncoder';
import {
  loadTypeDefPresets,
  saveTypeDefPreset,
  deleteTypeDefPreset,
  loadAbiEncoderHistory,
  addAbiEncoderHistory,
  deleteAbiEncoderHistory,
  clearAbiEncoderHistory,
} from '../utils/presetStorage';

interface TypeEntry {
  id: string;
  type: string;
  value: string;
}

function newId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function stringifySafe(v: any): string {
  try {
    return JSON.stringify(
      v,
      (_k, x) => (typeof x === 'bigint' ? x.toString() : x),
      2
    );
  } catch {
    return String(v);
  }
}

const AbiEncoderPage: React.FC = () => {
  const { t } = useTranslation();

  const [encodingMode, setEncodingMode] = useState<EncodingMode>('abi');
  const [operationType, setOperationType] = useState<OperationType>('encode');
  const [typeEntries, setTypeEntries] = useState<TypeEntry[]>([
    { id: newId(), type: 'uint256', value: '' },
  ]);
  const [hexInput, setHexInput] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outputAsHex, setOutputAsHex] = useState(false);
  const [presets, setPresets] = useState<TypeDefPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [savingPreset, setSavingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [history, setHistory] = useState<AbiEncoderHistory[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const commonTypes = getCommonTypes();

  useEffect(() => {
    setPresets(loadTypeDefPresets());
    setHistory(loadAbiEncoderHistory());
  }, []);

  const addType = useCallback(() => {
    setTypeEntries((prev) => [...prev, { id: newId(), type: 'uint256', value: '' }]);
  }, []);

  const removeType = useCallback((id: string) => {
    setTypeEntries((prev) => (prev.length <= 1 ? prev : prev.filter((e) => e.id !== id)));
  }, []);

  const updateType = useCallback((id: string, type: string) => {
    setTypeEntries((prev) => prev.map((e) => (e.id === id ? { ...e, type } : e)));
  }, []);

  const updateValue = useCallback((id: string, value: string) => {
    setTypeEntries((prev) => prev.map((e) => (e.id === id ? { ...e, value } : e)));
  }, []);

  const moveType = useCallback((id: string, direction: 'up' | 'down') => {
    setTypeEntries((prev) => {
      const i = prev.findIndex((e) => e.id === id);
      if (i === -1) return prev;
      const j = direction === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, []);

  const selectPreset = useCallback(
    (id: string) => {
      setSelectedPresetId(id);
      const p = presets.find((x) => x.id === id);
      if (p) {
        setTypeEntries(p.types.map((type) => ({ id: newId(), type, value: '' })));
      }
    },
    [presets]
  );

  const handleSavePreset = useCallback(() => {
    if (!newPresetName.trim()) return;
    const types = typeEntries.map((e) => e.type);
    saveTypeDefPreset(newPresetName.trim(), types);
    setPresets(loadTypeDefPresets());
    setSavingPreset(false);
    setNewPresetName('');
  }, [newPresetName, typeEntries]);

  const handleDeletePreset = useCallback(
    (id: string) => {
      if (window.confirm(t('abiEncoder.confirmDeletePreset'))) {
        deleteTypeDefPreset(id);
        setPresets(loadTypeDefPresets());
        if (selectedPresetId === id) setSelectedPresetId('');
      }
    },
    [selectedPresetId, t]
  );

  const handleExecute = useCallback(() => {
    setError(null);
    setResult(null);
    const types = typeEntries.map((e) => e.type.trim());

    for (const type of types) {
      if (!isValidType(type)) {
        setError(t('abiEncoder.invalidType', { type }));
        return;
      }
    }

    let exec: { success: boolean; data?: any; error?: string };
    let inputValues: string[];
    let outputStr: string;

    if (operationType === 'encode') {
      const values = typeEntries.map((e) => e.value);
      inputValues = values;
      exec = encodingMode === 'abi' ? abiEncode(types, values) : packedEncode(types, values);
      if (exec.success && exec.data) {
        outputStr = exec.data;
        setResult(exec.data);
      } else {
        outputStr = exec.error || t('abiEncoder.encodeFailed');
        setError(outputStr);
      }
    } else {
      inputValues = [hexInput];
      if (encodingMode === 'packed' && !areAllTypesFixedLength(types)) {
        const dyn = getDynamicTypes(types);
        const msg = t('abiEncoder.packedDecodeError', { types: dyn.join(', ') });
        setError(msg);
        addAbiEncoderHistory({
          encodingMode,
          operationType,
          types,
          inputValues,
          output: msg,
          success: false,
        });
        setHistory(loadAbiEncoderHistory());
        return;
      }
      exec = encodingMode === 'abi' ? abiDecode(types, hexInput) : packedDecode(types, hexInput);
      if (exec.success && exec.data) {
        const formatted = exec.data.map((v: any, i: number) => ({
          type: types[i],
          value: formatOutput(v, outputAsHex, types[i]),
        }));
        outputStr = stringifySafe(formatted);
        setResult(outputStr);
      } else {
        outputStr = exec.error || t('abiEncoder.decodeFailed');
        setError(outputStr);
      }
    }

    addAbiEncoderHistory({
      encodingMode,
      operationType,
      types,
      inputValues,
      output: outputStr,
      success: exec.success,
    });
    setHistory(loadAbiEncoderHistory());
  }, [typeEntries, operationType, encodingMode, hexInput, outputAsHex, t]);

  const handleDeleteHistory = (id: string) => {
    deleteAbiEncoderHistory(id);
    setHistory(loadAbiEncoderHistory());
  };
  const handleClearHistory = () => {
    if (window.confirm(t('abiEncoder.confirmClearHistory'))) {
      clearAbiEncoderHistory();
      setHistory([]);
    }
  };
  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const ModeBtn: React.FC<{
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }> = ({ active, onClick, children }) => (
    <button
      onClick={onClick}
      className={
        'rounded-sm px-2 py-0.5 text-[11px] ' +
        (active ? 'bg-mint font-semibold text-bg' : 'text-fg-dim hover:bg-surface-2')
      }
    >
      {children}
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* TxBar: mode + operation */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-bg px-5 py-2.5 font-mono text-[12px]">
        <span className="text-[11px] uppercase tracking-[0.2em] text-fg-mute">mode</span>
        <div className="flex gap-0.5">
          <ModeBtn active={encodingMode === 'abi'} onClick={() => setEncodingMode('abi')}>
            abi
          </ModeBtn>
          <ModeBtn
            active={encodingMode === 'packed'}
            onClick={() => setEncodingMode('packed')}
          >
            packed
          </ModeBtn>
        </div>

        <span className="text-line">/</span>
        <span className="text-[11px] uppercase tracking-[0.2em] text-fg-mute">op</span>
        <div className="flex gap-0.5">
          <ModeBtn
            active={operationType === 'encode'}
            onClick={() => setOperationType('encode')}
          >
            encode
          </ModeBtn>
          <ModeBtn
            active={operationType === 'decode'}
            onClick={() => setOperationType('decode')}
          >
            decode
          </ModeBtn>
        </div>

        <span className="text-line">/</span>
        <span className="text-[11px] uppercase tracking-[0.2em] text-fg-mute">preset</span>
        <select
          value={selectedPresetId}
          onChange={(e) => selectPreset(e.target.value)}
          className="rounded-sm border border-line bg-bg px-2 py-1 text-fg focus:border-mint focus:outline-none"
        >
          <option value="">{t('abiEncoder.selectPreset')}</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {selectedPresetId && (
          <button
            onClick={() => handleDeletePreset(selectedPresetId)}
            className="rounded-sm px-1.5 py-0.5 text-[11px] text-fg-mute hover:bg-surface-2"
          >
            × preset
          </button>
        )}
        <button
          onClick={() => setSavingPreset(!savingPreset)}
          className="rounded-sm border border-line px-2 py-0.5 text-[11px] text-fg-dim hover:bg-surface-2"
        >
          {savingPreset ? 'cancel' : '+ save preset'}
        </button>

        <div className="ml-auto">
          <button
            onClick={handleExecute}
            className="rounded-sm bg-mint px-4 py-1 font-mono text-[12px] font-semibold text-bg"
          >
            {operationType === 'encode'
              ? t('abiEncoder.encode')
              : t('abiEncoder.decode')}
          </button>
        </div>
      </div>

      {savingPreset && (
        <div className="flex items-center gap-2 border-b border-line bg-surface px-5 py-2">
          <input
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            placeholder={t('abiEncoder.newPresetName')}
            className="flex-1 rounded-sm border border-line bg-bg px-2 py-1 font-ui text-[13px] text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
          />
          <button
            onClick={handleSavePreset}
            className="rounded-sm bg-mint px-3 py-1 font-mono text-[12px] text-bg"
          >
            {t('presetModal.save')}
          </button>
        </div>
      )}

      {error && (
        <div className="border-b border-line bg-call-red/5 px-5 py-2 font-mono text-[12px] text-call-red">
          {error}
        </div>
      )}

      <div
        className="grid flex-1 min-h-0"
        style={{ gridTemplateColumns: '2fr 3fr' }}
      >
        {/* LEFT: types + values / hex input */}
        <div className="flex min-h-0 flex-col border-r border-line">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2 font-mono text-[11px]">
            <span className="uppercase tracking-[0.22em] text-fg-mute">
              {t('abiEncoder.typesSection')}
            </span>
            <span className="text-fg-mute">·</span>
            <span className="text-fg">{typeEntries.length}</span>
            <button
              onClick={addType}
              className="ml-auto rounded-sm px-2 py-0.5 text-[11px] text-fg-dim hover:bg-surface-2"
            >
              + add
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 font-mono text-[12px]">
            {typeEntries.map((entry, idx) => (
              <div
                key={entry.id}
                className="mb-2 flex items-start gap-2 border-b border-line-soft pb-2 last:border-b-0"
              >
                <span className="w-6 pt-1.5 text-[11px] text-fg-mute">[{idx}]</span>
                <div className="flex-1 space-y-1">
                  <input
                    list={`common-types-${entry.id}`}
                    value={entry.type}
                    onChange={(e) => updateType(entry.id, e.target.value)}
                    placeholder="type"
                    className="w-full rounded-sm border border-line bg-bg px-2 py-1 text-fg focus:border-mint focus:outline-none"
                  />
                  <datalist id={`common-types-${entry.id}`}>
                    {commonTypes.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                  {operationType === 'encode' && (
                    <input
                      value={entry.value}
                      onChange={(e) => updateValue(entry.id, e.target.value)}
                      placeholder={t('abiEncoder.valuePlaceholder')}
                      className="w-full rounded-sm border border-line bg-bg px-2 py-1 text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
                    />
                  )}
                </div>
                <div className="flex flex-col gap-0.5 pt-0.5">
                  <button
                    onClick={() => moveType(entry.id, 'up')}
                    disabled={idx === 0}
                    className="rounded-xs px-1 text-[11px] text-fg-mute hover:bg-surface-2 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveType(entry.id, 'down')}
                    disabled={idx === typeEntries.length - 1}
                    className="rounded-xs px-1 text-[11px] text-fg-mute hover:bg-surface-2 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => removeType(entry.id)}
                    disabled={typeEntries.length <= 1}
                    className="rounded-xs px-1 text-[11px] text-fg-mute hover:bg-surface-2 disabled:opacity-30"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}

            {operationType === 'decode' && (
              <div className="mt-3">
                <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">
                  {t('abiEncoder.hexInput')}
                </div>
                <textarea
                  value={hexInput}
                  onChange={(e) => setHexInput(e.target.value)}
                  placeholder="0x..."
                  rows={6}
                  className="w-full resize-none rounded-sm border border-line bg-bg px-2 py-1.5 font-mono text-[12px] text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
                />
                <label className="mt-2 flex items-center gap-2 text-[11px] text-fg-dim">
                  <input
                    type="checkbox"
                    checked={outputAsHex}
                    onChange={(e) => setOutputAsHex(e.target.checked)}
                  />
                  {t('abiEncoder.outputAsHex')}
                </label>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: output + history */}
        <div className="flex min-h-0 flex-col overflow-y-auto">
          {/* Output */}
          <div className="border-b border-line bg-surface px-5 py-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">
                {t('abiEncoder.output')}
              </span>
            </div>
            {result ? (
              <pre className="whitespace-pre-wrap break-all rounded-sm border border-line-soft bg-bg px-2.5 py-2 font-mono text-[12px] text-fg">
                {result}
              </pre>
            ) : (
              <div className="font-ui text-[13px] text-fg-mute">
                {t('abiEncoder.outputPlaceholder')}
              </div>
            )}
          </div>

          {/* History */}
          <div className="flex items-center gap-2 border-b border-line px-5 py-2 font-mono text-[11px]">
            <span className="uppercase tracking-[0.22em] text-fg-mute">
              {t('abiEncoder.history')}
            </span>
            <span className="text-fg-mute">·</span>
            <span className="text-fg">{history.length}</span>
            {history.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="ml-auto rounded-sm px-2 py-0.5 text-[11px] text-fg-mute hover:bg-surface-2"
              >
                {t('debugTrace.closeAll')}
              </button>
            )}
          </div>
          <div className="flex-1">
            {history.length === 0 ? (
              <div className="p-5 font-ui text-[13px] text-fg-mute">
                {t('abiEncoder.noHistory')}
              </div>
            ) : (
              history.map((h) => {
                const isCollapsed = collapsed.has(h.id);
                return (
                  <div key={h.id} className="border-b border-line-soft">
                    <div
                      className="flex cursor-pointer items-center gap-2 px-5 py-2 font-mono text-[11px] hover:bg-surface-2"
                      onClick={() => toggleCollapse(h.id)}
                    >
                      <span
                        className={
                          'rounded-xs px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em] ' +
                          (h.success ? 'bg-mint/15 text-mint' : 'bg-call-red/15 text-call-red')
                        }
                      >
                        {h.success ? 'OK' : 'ERR'}
                      </span>
                      <span className="text-fg-dim">
                        {h.encodingMode} · {h.operationType}
                      </span>
                      <span className="truncate text-fg-mute">
                        ({h.types.join(', ')})
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
                        <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">
                          {t('abiEncoder.input')}
                        </div>
                        <pre className="mb-3 whitespace-pre-wrap break-all rounded-sm border border-line-soft bg-bg px-2.5 py-2 text-[10.5px] text-fg-dim">
                          {h.inputValues.join('\n')}
                        </pre>
                        <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">
                          {t('abiEncoder.output')}
                        </div>
                        <pre
                          className={
                            'whitespace-pre-wrap break-all rounded-sm border px-2.5 py-2 text-[10.5px] ' +
                            (h.success
                              ? 'border-line-soft bg-bg text-fg'
                              : 'border-call-red/30 bg-call-red/5 text-call-red')
                          }
                        >
                          {h.output}
                        </pre>
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

export default AbiEncoderPage;
