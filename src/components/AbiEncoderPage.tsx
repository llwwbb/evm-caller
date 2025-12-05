import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { EncodingMode, OperationType, TypeDefPreset, AbiEncoderHistory } from '../types';
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

const AbiEncoderPage: React.FC = () => {
  const { t } = useTranslation();
  
  // 编码模式和操作类型
  const [encodingMode, setEncodingMode] = useState<EncodingMode>('abi');
  const [operationType, setOperationType] = useState<OperationType>('encode');
  
  // 类型列表
  const [typeEntries, setTypeEntries] = useState<TypeEntry[]>([
    { id: generateId(), type: 'uint256', value: '' },
  ]);
  
  // Decode 模式下的 hex 输入
  const [hexInput, setHexInput] = useState('');
  
  // 结果
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outputAsHex, setOutputAsHex] = useState(false);
  
  // 预设
  const [presets, setPresets] = useState<TypeDefPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  
  // 历史记录
  const [history, setHistory] = useState<AbiEncoderHistory[]>([]);
  
  // 常用类型
  const commonTypes = getCommonTypes();
  
  // 加载预设和历史
  useEffect(() => {
    setPresets(loadTypeDefPresets());
    setHistory(loadAbiEncoderHistory());
  }, []);
  
  // 生成唯一 ID
  function generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // 添加类型
  const addType = useCallback(() => {
    setTypeEntries(prev => [...prev, { id: generateId(), type: 'uint256', value: '' }]);
  }, []);
  
  // 删除类型
  const removeType = useCallback((id: string) => {
    setTypeEntries(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter(entry => entry.id !== id);
    });
  }, []);
  
  // 更新类型
  const updateType = useCallback((id: string, type: string) => {
    setTypeEntries(prev => prev.map(entry => 
      entry.id === id ? { ...entry, type } : entry
    ));
  }, []);
  
  // 更新值
  const updateValue = useCallback((id: string, value: string) => {
    setTypeEntries(prev => prev.map(entry => 
      entry.id === id ? { ...entry, value } : entry
    ));
  }, []);
  
  // 移动类型（上移/下移）
  const moveType = useCallback((id: string, direction: 'up' | 'down') => {
    setTypeEntries(prev => {
      const index = prev.findIndex(entry => entry.id === id);
      if (index === -1) return prev;
      
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      
      const newEntries = [...prev];
      [newEntries[index], newEntries[newIndex]] = [newEntries[newIndex], newEntries[index]];
      return newEntries;
    });
  }, []);
  
  // 选择预设
  const selectPreset = useCallback((presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setTypeEntries(preset.types.map(type => ({
        id: generateId(),
        type,
        value: '',
      })));
    }
  }, [presets]);
  
  // 保存为预设
  const handleSavePreset = useCallback(() => {
    if (!newPresetName.trim()) return;
    
    const types = typeEntries.map(e => e.type);
    saveTypeDefPreset(newPresetName.trim(), types);
    setPresets(loadTypeDefPresets());
    setShowSavePresetModal(false);
    setNewPresetName('');
  }, [newPresetName, typeEntries]);
  
  // 删除预设
  const handleDeletePreset = useCallback((id: string) => {
    if (window.confirm(t('abiEncoder.confirmDeletePreset'))) {
      deleteTypeDefPreset(id);
      setPresets(loadTypeDefPresets());
      if (selectedPresetId === id) {
        setSelectedPresetId('');
      }
    }
  }, [selectedPresetId, t]);
  
  // 执行编码/解码
  const handleExecute = useCallback(() => {
    setError(null);
    setResult(null);
    
    const types = typeEntries.map(e => e.type.trim());
    
    // 验证类型
    for (const type of types) {
      if (!isValidType(type)) {
        setError(t('abiEncoder.invalidType', { type }));
        return;
      }
    }
    
    let executeResult: { success: boolean; data?: any; error?: string };
    let inputValues: string[];
    let outputStr: string;
    
    if (operationType === 'encode') {
      const values = typeEntries.map(e => e.value);
      inputValues = values;
      
      if (encodingMode === 'abi') {
        executeResult = abiEncode(types, values);
      } else {
        executeResult = packedEncode(types, values);
      }
      
      if (executeResult.success && executeResult.data) {
        outputStr = executeResult.data;
        setResult(executeResult.data);
      } else {
        outputStr = executeResult.error || t('abiEncoder.encodeFailed');
        setError(outputStr);
      }
    } else {
      // decode
      inputValues = [hexInput];
      
      // 检查 packed decode 的限制
      if (encodingMode === 'packed' && !areAllTypesFixedLength(types)) {
        const dynamicTypes = getDynamicTypes(types);
        const errorMsg = t('abiEncoder.packedDecodeError', { types: dynamicTypes.join(', ') });
        setError(errorMsg);
        
        // 添加到历史记录
        addAbiEncoderHistory({
          encodingMode,
          operationType,
          types,
          inputValues,
          output: errorMsg,
          success: false,
        });
        setHistory(loadAbiEncoderHistory());
        return;
      }
      
      if (encodingMode === 'abi') {
        executeResult = abiDecode(types, hexInput);
      } else {
        executeResult = packedDecode(types, hexInput);
      }
      
      if (executeResult.success && executeResult.data) {
        const formattedResult = executeResult.data.map((v: any, i: number) => ({
          type: types[i],
          value: formatOutput(v, outputAsHex),
        }));
        outputStr = JSON.stringify(formattedResult, null, 2);
        setResult(outputStr);
      } else {
        outputStr = executeResult.error || t('abiEncoder.decodeFailed');
        setError(outputStr);
      }
    }
    
    // 添加到历史记录
    addAbiEncoderHistory({
      encodingMode,
      operationType,
      types,
      inputValues,
      output: outputStr,
      success: executeResult.success,
    });
    setHistory(loadAbiEncoderHistory());
  }, [typeEntries, hexInput, encodingMode, operationType, outputAsHex, t]);
  
  // 从历史记录恢复
  const restoreFromHistory = useCallback((historyItem: AbiEncoderHistory) => {
    setEncodingMode(historyItem.encodingMode);
    setOperationType(historyItem.operationType);
    setTypeEntries(historyItem.types.map((type, i) => ({
      id: generateId(),
      type,
      value: historyItem.operationType === 'encode' ? (historyItem.inputValues[i] || '') : '',
    })));
    if (historyItem.operationType === 'decode') {
      setHexInput(historyItem.inputValues[0] || '');
    }
  }, []);
  
  // 删除历史记录
  const handleDeleteHistory = useCallback((id: string) => {
    deleteAbiEncoderHistory(id);
    setHistory(loadAbiEncoderHistory());
  }, []);
  
  // 清空历史记录
  const handleClearHistory = useCallback(() => {
    if (window.confirm(t('abiEncoder.confirmClearHistory'))) {
      clearAbiEncoderHistory();
      setHistory([]);
    }
  }, [t]);
  
  // 复制结果
  const copyResult = useCallback(() => {
    if (result) {
      navigator.clipboard.writeText(result);
    }
  }, [result]);
  
  // 格式化时间
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
      {/* 左列：输入区 */}
      <div className="flex flex-col space-y-4 overflow-y-auto pr-2">
        {/* 预设选择 */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">{t('abiEncoder.typePresets')}</h3>
            <button
              onClick={() => setShowSavePresetModal(true)}
              className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
            >
              {t('abiEncoder.saveAsPreset')}
            </button>
          </div>
          
          {presets.length > 0 ? (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {presets.map(preset => (
                <div
                  key={preset.id}
                  className={`flex items-center justify-between p-2 rounded cursor-pointer ${
                    selectedPresetId === preset.id
                      ? 'bg-blue-100 border border-blue-300'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                  onClick={() => selectPreset(preset.id)}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800 truncate block">{preset.name}</span>
                    <span className="text-xs text-gray-500 truncate block">
                      {preset.types.join(', ')}
                    </span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeletePreset(preset.id); }}
                    className="ml-2 text-red-500 hover:text-red-700 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">{t('abiEncoder.noPresets')}</p>
          )}
        </div>
        
        {/* 编码设置 */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <h2 className="text-lg font-bold mb-4 text-gray-800">{t('abiEncoder.title')}</h2>
          
          {/* 编码模式 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('abiEncoder.encodingMode')}
            </label>
            <div className="flex space-x-2">
              <button
                onClick={() => setEncodingMode('abi')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  encodingMode === 'abi'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t('abiEncoder.standardAbi')}
              </button>
              <button
                onClick={() => setEncodingMode('packed')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  encodingMode === 'packed'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t('abiEncoder.solidityPacked')}
              </button>
            </div>
          </div>
          
          {/* 操作类型 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('abiEncoder.operationType')}
            </label>
            <div className="flex space-x-2">
              <button
                onClick={() => setOperationType('encode')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  operationType === 'encode'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t('abiEncoder.encode')}
              </button>
              <button
                onClick={() => setOperationType('decode')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  operationType === 'decode'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t('abiEncoder.decode')}
              </button>
            </div>
          </div>
          
          {/* Packed decode 提示 */}
          {encodingMode === 'packed' && operationType === 'decode' && (
            <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
              {t('abiEncoder.packedDecodeNote')}
            </div>
          )}
          
          {/* 类型列表 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                {t('abiEncoder.typeList')}
              </label>
              <button
                onClick={addType}
                className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                + {t('abiEncoder.addType')}
              </button>
            </div>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {typeEntries.map((entry, index) => (
                <div key={entry.id} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                  {/* 排序按钮 */}
                  <div className="flex flex-col">
                    <button
                      onClick={() => moveType(entry.id, 'up')}
                      disabled={index === 0}
                      className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveType(entry.id, 'down')}
                      disabled={index === typeEntries.length - 1}
                      className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>
                  
                  {/* 序号 */}
                  <span className="text-xs text-gray-500 w-6">{index + 1}.</span>
                  
                  {/* 类型选择/输入 */}
                  <div className="flex-1">
                    <input
                      type="text"
                      value={entry.type}
                      onChange={(e) => updateType(entry.id, e.target.value)}
                      placeholder={t('abiEncoder.typePlaceholder')}
                      list={`types-${entry.id}`}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                    <datalist id={`types-${entry.id}`}>
                      {commonTypes.map(type => (
                        <option key={type} value={type} />
                      ))}
                    </datalist>
                  </div>
                  
                  {/* 值输入（仅 encode 模式） */}
                  {operationType === 'encode' && (
                    <input
                      type="text"
                      value={entry.value}
                      onChange={(e) => updateValue(entry.id, e.target.value)}
                      placeholder={t('abiEncoder.valuePlaceholder')}
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  )}
                  
                  {/* 删除按钮 */}
                  <button
                    onClick={() => removeType(entry.id)}
                    disabled={typeEntries.length <= 1}
                    className="text-red-500 hover:text-red-700 disabled:opacity-30"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          {/* Decode 模式的 Hex 输入 */}
          {operationType === 'decode' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('abiEncoder.hexInput')}
              </label>
              <textarea
                value={hexInput}
                onChange={(e) => setHexInput(e.target.value)}
                placeholder="0x..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>
          )}
          
          {/* 执行按钮 */}
          <button
            onClick={handleExecute}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            {operationType === 'encode' ? t('abiEncoder.executeEncode') : t('abiEncoder.executeDecode')}
          </button>
        </div>
      </div>
      
      {/* 右列：结果和历史 */}
      <div className="flex flex-col space-y-4 overflow-y-auto pr-2">
        {/* 结果显示 */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-800">{t('abiEncoder.result')}</h3>
            <div className="flex items-center space-x-2">
              {operationType === 'decode' && (
                <label className="flex items-center text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={outputAsHex}
                    onChange={(e) => setOutputAsHex(e.target.checked)}
                    className="mr-1"
                  />
                  {t('abiEncoder.outputAsHex')}
                </label>
              )}
              {result && (
                <button
                  onClick={copyResult}
                  className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  {t('abiEncoder.copy')}
                </button>
              )}
            </div>
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800 font-mono break-all">{error}</p>
            </div>
          )}
          
          {result && !error && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <pre className="text-sm text-green-800 font-mono break-all whitespace-pre-wrap">{result}</pre>
            </div>
          )}
          
          {!result && !error && (
            <p className="text-sm text-gray-500">{t('abiEncoder.noResult')}</p>
          )}
        </div>
        
        {/* 历史记录 */}
        <div className="bg-white rounded-lg shadow-md p-4 flex-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-800">{t('abiEncoder.history')}</h3>
            {history.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
              >
                {t('abiEncoder.clearHistory')}
              </button>
            )}
          </div>
          
          {history.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {history.map(item => (
                <div
                  key={item.id}
                  className={`p-3 rounded border cursor-pointer hover:bg-gray-50 ${
                    item.success ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'
                  }`}
                  onClick={() => restoreFromHistory(item)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        item.encodingMode === 'abi' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {item.encodingMode === 'abi' ? 'ABI' : 'Packed'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        item.operationType === 'encode' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {item.operationType === 'encode' ? 'Encode' : 'Decode'}
                      </span>
                      <span className={`text-xs ${item.success ? 'text-green-600' : 'text-red-600'}`}>
                        {item.success ? '✓' : '✗'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">{formatTime(item.timestamp)}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteHistory(item.id); }}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 font-mono truncate">
                    {t('abiEncoder.typesLabel')}: {item.types.join(', ')}
                  </div>
                  <div className="text-xs text-gray-500 font-mono truncate mt-1">
                    {t('abiEncoder.outputLabel')}: {item.output.substring(0, 80)}{item.output.length > 80 ? '...' : ''}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">{t('abiEncoder.noHistory')}</p>
          )}
        </div>
      </div>
      
      {/* 保存预设弹窗 */}
      {showSavePresetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-bold mb-4">{t('abiEncoder.savePresetTitle')}</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('abiEncoder.presetName')}
              </label>
              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder={t('abiEncoder.presetNamePlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="mb-4 p-2 bg-gray-50 rounded">
              <span className="text-xs text-gray-600 font-mono">
                {typeEntries.map(e => e.type).join(', ')}
              </span>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowSavePresetModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
              >
                {t('abiEncoder.cancel')}
              </button>
              <button
                onClick={handleSavePreset}
                disabled={!newPresetName.trim()}
                className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {t('abiEncoder.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AbiEncoderPage;
