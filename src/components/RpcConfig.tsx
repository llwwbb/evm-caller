import React, { useState, useEffect } from 'react';
import { validateRpcConnection, isValidAddress } from '../utils/rpcCaller';
import { RpcPreset, ContractPreset } from '../types';
import PresetSelector from './PresetSelector';
import PresetManager from './PresetManager';
import {
  loadRpcPresets,
  saveRpcPreset,
  updateRpcPreset,
  deleteRpcPreset,
  loadContractPresets,
  saveContractPreset,
  updateContractPreset,
  deleteContractPreset,
  saveLastRpcUrl,
  saveLastContractAddress,
  saveLastBlockTag,
} from '../utils/presetStorage';

interface RpcConfigProps {
  onRpcUrlChange: (rpcUrl: string) => void;
  onContractAddressChange: (address: string) => void;
  onBlockTagChange: (blockTag: string) => void;
  initialRpcUrl?: string;
  initialContractAddress?: string;
  initialBlockTag?: string;
}

const RpcConfig: React.FC<RpcConfigProps> = ({ 
  onRpcUrlChange,
  onContractAddressChange,
  onBlockTagChange,
  initialRpcUrl = '',
  initialContractAddress = '',
  initialBlockTag = 'latest',
}) => {
  const [rpcUrl, setRpcUrl] = useState(initialRpcUrl);
  const [contractAddress, setContractAddress] = useState(initialContractAddress);
  const [blockTag, setBlockTag] = useState(initialBlockTag);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    type: 'success' | 'error' | null;
    message: string;
    chainId?: number;
  }>({ type: null, message: '' });

  // 预设相关状态
  const [rpcPresets, setRpcPresets] = useState<RpcPreset[]>([]);
  const [contractPresets, setContractPresets] = useState<ContractPreset[]>([]);
  const [selectedRpcPresetId, setSelectedRpcPresetId] = useState<string>();
  const [selectedContractPresetId, setSelectedContractPresetId] = useState<string>();
  
  // 管理弹窗状态
  const [showRpcManager, setShowRpcManager] = useState(false);
  const [showContractManager, setShowContractManager] = useState(false);
  
  // 编辑预设状态
  const [editingRpcPreset, setEditingRpcPreset] = useState<RpcPreset | null>(null);
  const [editingContractPreset, setEditingContractPreset] = useState<ContractPreset | null>(null);

  // 加载预设
  useEffect(() => {
    setRpcPresets(loadRpcPresets());
    setContractPresets(loadContractPresets());
  }, []);

  // 实时通知父组件并自动保存到 localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      if (rpcUrl) {
        saveLastRpcUrl(rpcUrl);
        onRpcUrlChange(rpcUrl);
      }
      if (contractAddress) {
        saveLastContractAddress(contractAddress);
        onContractAddressChange(contractAddress);
      }
      if (blockTag) {
        saveLastBlockTag(blockTag);
        onBlockTagChange(blockTag);
      }
    }, 500); // 延迟500ms，防止输入时频繁触发
    return () => clearTimeout(timer);
  }, [rpcUrl, contractAddress, blockTag, onRpcUrlChange, onContractAddressChange, onBlockTagChange]);

  const handleValidate = async () => {
    if (!rpcUrl.trim()) {
      setValidationResult({ type: 'error', message: '请输入 RPC URL' });
      return;
    }

    setIsValidating(true);
    setValidationResult({ type: null, message: '' });

    try {
      const result = await validateRpcConnection(rpcUrl);
      
      if (result.valid) {
        setValidationResult({
          type: 'success',
          message: `✅ RPC 连接成功！Chain ID: ${result.chainId}`,
          chainId: result.chainId,
        });
      } else {
        setValidationResult({
          type: 'error',
          message: result.error || '连接失败',
        });
      }
    } catch (error) {
      setValidationResult({
        type: 'error',
        message: '验证过程出错',
      });
    } finally {
      setIsValidating(false);
    }
  };

  // RPC 预设相关
  const handleSelectRpcPreset = (preset: RpcPreset | null) => {
    if (preset) {
      setRpcUrl(preset.rpcUrl);
      setSelectedRpcPresetId(preset.id);
    } else {
      setSelectedRpcPresetId(undefined);
    }
  };

  const handleSaveRpcPreset = () => {
    if (!rpcUrl.trim()) {
      alert('请先输入 RPC URL');
      return;
    }
    
    const name = prompt('请输入预设名称：', '我的 RPC');
    if (name) {
      const newPreset = saveRpcPreset(name.trim(), rpcUrl, validationResult.chainId);
      setRpcPresets(loadRpcPresets());
      setSelectedRpcPresetId(newPreset.id);
    }
  };

  const handleEditRpcPreset = (preset: RpcPreset) => {
    setEditingRpcPreset(preset);
    setShowRpcManager(false);
  };

  const handleUpdateRpcPreset = () => {
    if (!editingRpcPreset) return;
    
    const name = prompt('修改预设名称：', editingRpcPreset.name);
    if (name && name.trim()) {
      updateRpcPreset(editingRpcPreset.id, { name: name.trim() });
      setRpcPresets(loadRpcPresets());
    }
    setEditingRpcPreset(null);
  };

  const handleDeleteRpcPreset = (id: string) => {
    deleteRpcPreset(id);
    setRpcPresets(loadRpcPresets());
    if (selectedRpcPresetId === id) {
      setSelectedRpcPresetId(undefined);
    }
  };

  // 合约预设相关
  const handleSelectContractPreset = (preset: ContractPreset | null) => {
    if (preset) {
      setContractAddress(preset.address);
      setSelectedContractPresetId(preset.id);
    } else {
      setSelectedContractPresetId(undefined);
    }
  };

  const handleSaveContractPreset = () => {
    if (!contractAddress.trim()) {
      alert('请先输入合约地址');
      return;
    }
    
    if (!isValidAddress(contractAddress)) {
      alert('合约地址格式不正确');
      return;
    }
    
    const name = prompt('请输入预设名称：', '我的合约');
    if (name) {
      const newPreset = saveContractPreset(name.trim(), contractAddress);
      setContractPresets(loadContractPresets());
      setSelectedContractPresetId(newPreset.id);
    }
  };

  const handleEditContractPreset = (preset: ContractPreset) => {
    setEditingContractPreset(preset);
    setShowContractManager(false);
  };

  const handleUpdateContractPreset = () => {
    if (!editingContractPreset) return;
    
    const name = prompt('修改预设名称：', editingContractPreset.name);
    if (name && name.trim()) {
      updateContractPreset(editingContractPreset.id, { name: name.trim() });
      setContractPresets(loadContractPresets());
    }
    setEditingContractPreset(null);
  };

  const handleDeleteContractPreset = (id: string) => {
    deleteContractPreset(id);
    setContractPresets(loadContractPresets());
    if (selectedContractPresetId === id) {
      setSelectedContractPresetId(undefined);
    }
  };

  // 处理编辑预设
  useEffect(() => {
    if (editingRpcPreset) {
      handleUpdateRpcPreset();
    }
  }, [editingRpcPreset]);

  useEffect(() => {
    if (editingContractPreset) {
      handleUpdateContractPreset();
    }
  }, [editingContractPreset]);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800">
          步骤 1: 配置 RPC 和合约
        </h2>
        <span className="text-xs text-gray-500">
          直接输入即可使用
        </span>
      </div>
      
      <div className="space-y-4">
        {/* RPC URL 预设选择 */}
        <PresetSelector
          label="RPC URL 预设"
          presets={rpcPresets}
          selectedId={selectedRpcPresetId}
          onSelect={handleSelectRpcPreset}
          onSave={handleSaveRpcPreset}
          onManage={() => setShowRpcManager(true)}
          placeholder="选择 RPC 网络"
        />

        {/* RPC URL 输入框 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            RPC URL
          </label>
          <input
            type="text"
            value={rpcUrl}
            onChange={(e) => {
              setRpcUrl(e.target.value);
              setSelectedRpcPresetId(undefined);
            }}
            placeholder="https://eth-mainnet.g.alchemy.com/v2/your-api-key"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 合约地址预设选择 */}
        <PresetSelector
          label="合约地址预设"
          presets={contractPresets}
          selectedId={selectedContractPresetId}
          onSelect={handleSelectContractPreset}
          onSave={handleSaveContractPreset}
          onManage={() => setShowContractManager(true)}
          placeholder="选择合约"
        />

        {/* 合约地址输入框 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            合约地址
          </label>
          <input
            type="text"
            value={contractAddress}
            onChange={(e) => {
              setContractAddress(e.target.value);
              setSelectedContractPresetId(undefined);
            }}
            placeholder="0x..."
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 区块标识输入框 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            区块标识
            <span className="ml-2 text-xs text-gray-500">
              (默认: latest)
            </span>
          </label>
          <input
            type="text"
            value={blockTag}
            onChange={(e) => setBlockTag(e.target.value)}
            placeholder="latest, earliest, pending, 或具体区块号"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">
            💡 可以输入 "latest"（最新区块）、"earliest"（最早区块）、"pending"（待处理）或具体的区块号
          </p>
        </div>

        <button
          onClick={handleValidate}
          disabled={isValidating || !rpcUrl.trim()}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isValidating ? '测试中...' : '🔧 测试 RPC 连接（可选）'}
        </button>

        {validationResult.type && (
          <div
            className={`p-4 rounded-md ${
              validationResult.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {validationResult.message}
          </div>
        )}
      </div>

      {/* RPC 预设管理弹窗 */}
      {showRpcManager && (
        <PresetManager
          title="管理 RPC 预设"
          presets={rpcPresets}
          onClose={() => setShowRpcManager(false)}
          onEdit={handleEditRpcPreset}
          onDelete={handleDeleteRpcPreset}
          renderPreview={(preset) => (
            <div className="text-sm">
              <div className="text-gray-600 break-all">{preset.rpcUrl}</div>
              {preset.chainId && (
                <div className="text-gray-500 mt-1">Chain ID: {preset.chainId}</div>
              )}
            </div>
          )}
        />
      )}

      {/* 合约预设管理弹窗 */}
      {showContractManager && (
        <PresetManager
          title="管理合约预设"
          presets={contractPresets}
          onClose={() => setShowContractManager(false)}
          onEdit={handleEditContractPreset}
          onDelete={handleDeleteContractPreset}
          renderPreview={(preset) => (
            <div className="text-sm">
              <div className="text-gray-600 break-all font-mono">{preset.address}</div>
              {preset.description && (
                <div className="text-gray-500 mt-1">{preset.description}</div>
              )}
            </div>
          )}
        />
      )}
    </div>
  );
};

export default RpcConfig;
