import React, { useState, useEffect } from 'react';
import { parseAbi, validateAbiInput } from '../utils/abiParser';
import { ParsedFunction, AbiPreset } from '../types';
import PresetSelector from './PresetSelector';
import PresetManager from './PresetManager';
import {
  loadAbiPresets,
  saveAbiPreset,
  updateAbiPreset,
  deleteAbiPreset,
  saveLastAbi,
} from '../utils/presetStorage';

interface AbiInputProps {
  onAbiParsed: (functions: ParsedFunction[], abiString: string) => void;
  disabled?: boolean;
  initialAbi?: string;
}

const AbiInput: React.FC<AbiInputProps> = ({ 
  onAbiParsed, 
  disabled = false,
  initialAbi = '',
}) => {
  const [abiInput, setAbiInput] = useState(initialAbi);
  const [error, setError] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // 预设相关状态
  const [abiPresets, setAbiPresets] = useState<AbiPreset[]>([]);
  const [selectedAbiPresetId, setSelectedAbiPresetId] = useState<string>();
  const [showAbiManager, setShowAbiManager] = useState(false);
  const [editingAbiPreset, setEditingAbiPreset] = useState<AbiPreset | null>(null);

  const exampleSolidityAbi = `function name() view returns (string)
function symbol() view returns (string)
function totalSupply() view returns (uint256)
function balanceOf(address account) view returns (uint256)`;

  const exampleJsonAbi = `[
  {
    "name": "name",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{"type": "string"}]
  }
]`;

  // 加载预设
  useEffect(() => {
    setAbiPresets(loadAbiPresets());
  }, []);

  // 自动保存到 localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      if (abiInput) saveLastAbi(abiInput);
    }, 1000);
    return () => clearTimeout(timer);
  }, [abiInput]);

  const handleParse = () => {
    setError('');
    
    const validation = validateAbiInput(abiInput);
    if (!validation.valid) {
      setError(validation.error || '输入格式错误');
      return;
    }

    setIsParsing(true);

    try {
      let parsedInput: any;
      
      const trimmed = abiInput.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        parsedInput = JSON.parse(trimmed);
      } else {
        parsedInput = trimmed;
      }

      const functions = parseAbi(parsedInput);
      
      if (functions.length === 0) {
        setError('未找到 view 或 pure 函数');
        return;
      }

      onAbiParsed(functions, abiInput);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('解析失败：未知错误');
      }
    } finally {
      setIsParsing(false);
    }
  };

  const loadExample = (type: 'solidity' | 'json') => {
    setAbiInput(type === 'solidity' ? exampleSolidityAbi : exampleJsonAbi);
    setError('');
    setSelectedAbiPresetId(undefined);
  };

  // ABI 预设相关
  const handleSelectAbiPreset = (preset: AbiPreset | null) => {
    if (preset) {
      setAbiInput(preset.abi);
      setSelectedAbiPresetId(preset.id);
      setError('');
    } else {
      setSelectedAbiPresetId(undefined);
    }
  };

  const handleSaveAbiPreset = () => {
    if (!abiInput.trim()) {
      alert('请先输入 ABI');
      return;
    }
    
    const validation = validateAbiInput(abiInput);
    if (!validation.valid) {
      alert('ABI 格式不正确：' + validation.error);
      return;
    }
    
    const name = prompt('请输入预设名称：', '我的 ABI');
    if (name) {
      const newPreset = saveAbiPreset(name.trim(), abiInput);
      setAbiPresets(loadAbiPresets());
      setSelectedAbiPresetId(newPreset.id);
    }
  };

  const handleEditAbiPreset = (preset: AbiPreset) => {
    setEditingAbiPreset(preset);
    setShowAbiManager(false);
  };

  const handleUpdateAbiPreset = () => {
    if (!editingAbiPreset) return;
    
    const name = prompt('修改预设名称：', editingAbiPreset.name);
    if (name && name.trim()) {
      updateAbiPreset(editingAbiPreset.id, { name: name.trim() });
      setAbiPresets(loadAbiPresets());
    }
    setEditingAbiPreset(null);
  };

  const handleDeleteAbiPreset = (id: string) => {
    deleteAbiPreset(id);
    setAbiPresets(loadAbiPresets());
    if (selectedAbiPresetId === id) {
      setSelectedAbiPresetId(undefined);
    }
  };

  // 处理编辑预设
  useEffect(() => {
    if (editingAbiPreset) {
      handleUpdateAbiPreset();
    }
  }, [editingAbiPreset]);

  // 处理文件拖拽
  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    
    // 检查文件类型
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.json') && !fileName.endsWith('.abi') && !fileName.endsWith('.txt')) {
      setError('请拖入 .json、.abi 或 .txt 文件');
      return;
    }

    try {
      const content = await file.text();
      setAbiInput(content);
      setSelectedAbiPresetId(undefined);
      setError('');
    } catch (err) {
      setError('读取文件失败：' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        步骤 2: 输入 ABI
      </h2>

      <div className="space-y-4">
        {/* ABI 预设选择 */}
        <PresetSelector
          label="ABI 预设"
          presets={abiPresets}
          selectedId={selectedAbiPresetId}
          onSelect={handleSelectAbiPreset}
          onSave={handleSaveAbiPreset}
          onManage={() => setShowAbiManager(true)}
          placeholder="选择 ABI 接口"
        />

        {/* ABI 输入框 */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">
              ABI（支持 JSON 或 Solidity 函数签名）
            </label>
            <div className="space-x-2">
              <button
                onClick={() => loadExample('solidity')}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                示例: Solidity
              </button>
              <button
                onClick={() => loadExample('json')}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                示例: JSON
              </button>
            </div>
          </div>
          
          <textarea
            value={abiInput}
            onChange={(e) => {
              setAbiInput(e.target.value);
              setSelectedAbiPresetId(undefined);
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            disabled={disabled}
            placeholder="粘贴 JSON ABI 或输入 Solidity 函数签名（每行一个）&#10;例如：function balanceOf(address) view returns (uint256)&#10;&#10;💡 提示：可以直接拖拽 .json、.abi 或 .txt 文件到此处"
            rows={12}
            className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors ${
              isDragging 
                ? 'border-blue-500 bg-blue-50 border-2' 
                : 'border-gray-300'
            }`}
          />
          
          <p className="text-xs text-gray-500 mt-1">
            支持两种格式：<br />
            1. JSON ABI 格式（标准 ABI 数组）<br />
            2. Solidity 函数签名（如：function name() view returns (string)）
          </p>
        </div>

        <button
          onClick={handleParse}
          disabled={disabled || isParsing || !abiInput.trim()}
          className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isParsing ? '解析中...' : '解析 ABI'}
        </button>

        {error && (
          <div className="p-4 rounded-md bg-red-50 text-red-800 border border-red-200">
            {error}
          </div>
        )}
      </div>

      {/* ABI 预设管理弹窗 */}
      {showAbiManager && (
        <PresetManager
          title="管理 ABI 预设"
          presets={abiPresets}
          onClose={() => setShowAbiManager(false)}
          onEdit={handleEditAbiPreset}
          onDelete={handleDeleteAbiPreset}
          renderPreview={(preset) => (
            <div className="text-sm">
              <pre className="text-gray-600 text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-24">
                {preset.abi.substring(0, 200)}
                {preset.abi.length > 200 && '...'}
              </pre>
            </div>
          )}
        />
      )}
    </div>
  );
};

export default AbiInput;
