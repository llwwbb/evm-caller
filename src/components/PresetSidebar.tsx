import React, { useState, useEffect } from 'react';
import { 
  loadRpcPresets, 
  loadContractPresets, 
  loadAbiPresets,
  updateRpcPreset,
  updateContractPreset,
  updateAbiPreset,
  deleteRpcPreset,
  deleteContractPreset,
  deleteAbiPreset,
} from '../utils/presetStorage';
import { RpcPreset, ContractPreset, AbiPreset } from '../types';

interface PresetSidebarProps {
  onRpcSelect: (rpcUrl: string) => void;
  onContractSelect: (address: string) => void;
  onAbisSelect: (abis: string[], names: string[]) => void; // 多选 ABI 和名称
  onPresetsChanged?: () => void; // 预设变化时的回调
  currentRpcUrl?: string;
  currentContractAddress?: string;
  currentAbis?: string[]; // 当前选中的多个 ABI
  refreshTrigger?: number; // 用于触发刷新的计数器
}

const PresetSidebar: React.FC<PresetSidebarProps> = ({
  onRpcSelect,
  onContractSelect,
  onAbisSelect,
  onPresetsChanged,
  currentRpcUrl,
  currentContractAddress,
  currentAbis = [],
  refreshTrigger,
}) => {
  const [rpcPresets, setRpcPresets] = useState<RpcPreset[]>([]);
  const [contractPresets, setContractPresets] = useState<ContractPreset[]>([]);
  const [abiPresets, setAbiPresets] = useState<AbiPreset[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['rpc', 'contract', 'abi'])); // 默认全部展开
  const [editingPreset, setEditingPreset] = useState<{ type: 'rpc' | 'contract' | 'abi'; id: string } | null>(null);
  const [editName, setEditName] = useState('');
  const [editValue, setEditValue] = useState(''); // 用于编辑 RPC URL 或 ABI 内容
  const [editDescription, setEditDescription] = useState(''); // 用于编辑合约描述
  const [viewingAbi, setViewingAbi] = useState<{ id: string; name: string; abi: string } | null>(null);

  useEffect(() => {
    loadPresets();
  }, []);

  // 监听刷新触发器
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      loadPresets();
    }
  }, [refreshTrigger]);

  const loadPresets = () => {
    // 按名称排序
    const rpcs = loadRpcPresets().sort((a, b) => a.name.localeCompare(b.name));
    const contracts = loadContractPresets().sort((a, b) => a.name.localeCompare(b.name));
    const abis = loadAbiPresets().sort((a, b) => a.name.localeCompare(b.name));
    
    setRpcPresets(rpcs);
    setContractPresets(contracts);
    setAbiPresets(abis);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const isRpcActive = (rpcUrl: string) => {
    return currentRpcUrl === rpcUrl;
  };

  const isContractActive = (address: string) => {
    return currentContractAddress?.toLowerCase() === address.toLowerCase();
  };

  const isAbiActive = (abi: string) => {
    return currentAbis.includes(abi);
  };

  const handleAbiToggle = (abi: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (currentAbis.includes(abi)) {
      // 取消选择
      const newAbis = currentAbis.filter(a => a !== abi);
      const newNames = newAbis.map(a => {
        const preset = abiPresets.find(p => p.abi === a);
        return preset?.name || `ABI ${newAbis.indexOf(a) + 1}`;
      });
      onAbisSelect(newAbis, newNames);
    } else {
      // 添加选择
      const newAbis = [...currentAbis, abi];
      const newNames = newAbis.map(a => {
        const preset = abiPresets.find(p => p.abi === a);
        return preset?.name || `ABI ${newAbis.indexOf(a) + 1}`;
      });
      onAbisSelect(newAbis, newNames);
    }
  };

  const handleSelectAllAbis = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (currentAbis.length === abiPresets.length && abiPresets.length > 0) {
      // 全部取消
      onAbisSelect([], []);
    } else {
      // 全部选择
      const allAbis = abiPresets.map(p => p.abi);
      const allNames = abiPresets.map(p => p.name);
      onAbisSelect(allAbis, allNames);
    }
  };

  const handleDeleteRpc = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`确定要删除 RPC 预设 "${name}" 吗？`)) {
      deleteRpcPreset(id);
      loadPresets();
      onPresetsChanged?.();
    }
  };

  const handleDeleteContract = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`确定要删除合约预设 "${name}" 吗？`)) {
      deleteContractPreset(id);
      loadPresets();
      onPresetsChanged?.();
    }
  };

  const handleDeleteAbi = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`确定要删除 ABI 预设 "${name}" 吗？`)) {
      deleteAbiPreset(id);
      loadPresets();
      onPresetsChanged?.();
    }
  };

  const handleStartEdit = (type: 'rpc' | 'contract' | 'abi', id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (type === 'rpc') {
      const preset = rpcPresets.find(p => p.id === id);
      if (preset) {
        setEditName(preset.name);
        setEditValue(preset.rpcUrl);
      }
    } else if (type === 'contract') {
      const preset = contractPresets.find(p => p.id === id);
      if (preset) {
        setEditName(preset.name);
        setEditValue(preset.address);
        setEditDescription(preset.description || '');
      }
    } else if (type === 'abi') {
      const preset = abiPresets.find(p => p.id === id);
      if (preset) {
        setEditName(preset.name);
        setEditValue(preset.abi);
      }
    }
    
    setEditingPreset({ type, id });
  };

  const handleSaveEdit = (type: 'rpc' | 'contract' | 'abi', id: string) => {
    if (!editName.trim()) return;
    
    if (type === 'rpc') {
      if (!editValue.trim()) return;
      updateRpcPreset(id, { name: editName.trim(), rpcUrl: editValue.trim() });
    } else if (type === 'contract') {
      if (!editValue.trim()) return;
      updateContractPreset(id, { 
        name: editName.trim(), 
        address: editValue.trim(),
        description: editDescription.trim() || undefined
      });
    } else if (type === 'abi') {
      if (!editValue.trim()) return;
      updateAbiPreset(id, { name: editName.trim(), abi: editValue.trim() });
    }
    
    setEditingPreset(null);
    setEditName('');
    setEditValue('');
    setEditDescription('');
    loadPresets();
    onPresetsChanged?.();
  };

  const handleCancelEdit = () => {
    setEditingPreset(null);
    setEditName('');
    setEditValue('');
    setEditDescription('');
  };

  const handleViewAbi = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const preset = abiPresets.find(p => p.id === id);
    if (preset) {
      setViewingAbi(preset);
    }
  };

  const handleCloseAbiView = () => {
    setViewingAbi(null);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
      <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex-shrink-0">
        <h2 className="text-lg font-bold">预设配置</h2>
        <p className="text-xs text-indigo-100 mt-1">点击快速切换</p>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {/* RPC 预设 */}
        <div className="border-b border-gray-200 flex flex-col">
          <button
            onClick={() => toggleSection('rpc')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
              <span className="font-semibold text-gray-700">RPC 节点</span>
              <span className="text-xs text-gray-500">({rpcPresets.length})</span>
            </div>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.has('rpc') ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {expandedSections.has('rpc') && (
            <div className="overflow-y-auto px-2 pb-2 space-y-1 max-h-64">
              {rpcPresets.length === 0 ? (
                <p className="text-xs text-gray-500 px-2 py-2">暂无预设</p>
              ) : (
                rpcPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className={`group relative rounded-lg text-sm transition-all ${
                      isRpcActive(preset.rpcUrl)
                        ? 'bg-blue-100 text-blue-800 font-medium border-2 border-blue-300'
                        : 'hover:bg-gray-100 text-gray-700 border-2 border-transparent'
                    }`}
                  >
                    {editingPreset?.type === 'rpc' && editingPreset?.id === preset.id ? (
                      <div className="px-3 py-2 space-y-2">
                        <div>
                          <label className="text-xs text-gray-600">名称</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="预设名称"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">RPC URL</label>
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                            placeholder="https://..."
                          />
                        </div>
                        <div className="flex gap-1 mt-2">
                          <button
                            onClick={() => handleSaveEdit('rpc', preset.id)}
                            className="flex-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                          >
                            保存
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="flex-1 px-2 py-1 bg-gray-400 text-white rounded text-xs hover:bg-gray-500"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => onRpcSelect(preset.rpcUrl)}
                          className="w-full text-left px-3 py-2"
                        >
                          <div className="font-medium truncate">{preset.name}</div>
                          {preset.chainId && (
                            <div className="text-xs text-gray-500 mt-0.5">Chain ID: {preset.chainId}</div>
                          )}
                        </button>
                        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <button
                            onClick={(e) => handleStartEdit('rpc', preset.id, e)}
                            className="p-1 bg-white rounded shadow-sm hover:bg-blue-50"
                            title="编辑"
                          >
                            <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => handleDeleteRpc(preset.id, preset.name, e)}
                            className="p-1 bg-white rounded shadow-sm hover:bg-red-50"
                            title="删除"
                          >
                            <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* 合约地址预设 */}
        <div className="border-b border-gray-200 flex flex-col">
          <button
            onClick={() => toggleSection('contract')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="font-semibold text-gray-700">合约地址</span>
              <span className="text-xs text-gray-500">({contractPresets.length})</span>
            </div>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.has('contract') ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {expandedSections.has('contract') && (
            <div className="overflow-y-auto px-2 pb-2 space-y-1 max-h-64">
              {contractPresets.length === 0 ? (
                <p className="text-xs text-gray-500 px-2 py-2">暂无预设</p>
              ) : (
                contractPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className={`group relative rounded-lg text-sm transition-all ${
                      isContractActive(preset.address)
                        ? 'bg-green-100 text-green-800 font-medium border-2 border-green-300'
                        : 'hover:bg-gray-100 text-gray-700 border-2 border-transparent'
                    }`}
                  >
                    {editingPreset?.type === 'contract' && editingPreset?.id === preset.id ? (
                      <div className="px-3 py-2 space-y-2">
                        <div>
                          <label className="text-xs text-gray-600">名称</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-green-400 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                            placeholder="预设名称"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">合约地址</label>
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-green-400 rounded focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
                            placeholder="0x..."
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">描述（可选）</label>
                          <input
                            type="text"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-green-400 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                            placeholder="合约描述"
                          />
                        </div>
                        <div className="flex gap-1 mt-2">
                          <button
                            onClick={() => handleSaveEdit('contract', preset.id)}
                            className="flex-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                          >
                            保存
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="flex-1 px-2 py-1 bg-gray-400 text-white rounded text-xs hover:bg-gray-500"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => onContractSelect(preset.address)}
                          className="w-full text-left px-3 py-2"
                        >
                          <div className="font-medium truncate">{preset.name}</div>
                          {preset.description && (
                            <div className="text-xs text-gray-500 mt-0.5 truncate">{preset.description}</div>
                          )}
                        </button>
                        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <button
                            onClick={(e) => handleStartEdit('contract', preset.id, e)}
                            className="p-1 bg-white rounded shadow-sm hover:bg-green-50"
                            title="编辑"
                          >
                            <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => handleDeleteContract(preset.id, preset.name, e)}
                            className="p-1 bg-white rounded shadow-sm hover:bg-red-50"
                            title="删除"
                          >
                            <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ABI 预设 */}
        <div className="flex flex-col flex-1 min-h-0">
          <button
            onClick={() => toggleSection('abi')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            <div className="flex items-center gap-2 flex-1">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <span className="font-semibold text-gray-700">ABI 接口</span>
              <span className="text-xs text-gray-500">({currentAbis.length}/{abiPresets.length})</span>
              {abiPresets.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectAllAbis(e);
                  }}
                  className="ml-auto text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  {currentAbis.length === abiPresets.length && abiPresets.length > 0 ? '取消全选' : '全选'}
                </button>
              )}
            </div>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.has('abi') ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {expandedSections.has('abi') && (
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1 min-h-0">
              {abiPresets.length === 0 ? (
                <p className="text-xs text-gray-500 px-2 py-2">暂无预设</p>
              ) : (
                <>
                  {abiPresets.map((preset) => {
                  return (<div
                    key={preset.id}
                    className={`group relative rounded-lg text-sm transition-all cursor-pointer ${
                      isAbiActive(preset.abi)
                        ? 'bg-purple-100 text-purple-800 font-medium border-2 border-purple-300'
                        : 'hover:bg-gray-100 text-gray-700 border-2 border-transparent'
                    }`}
                  >
                    {editingPreset?.type === 'abi' && editingPreset?.id === preset.id ? (
                      <div className="px-3 py-2 space-y-2">
                        <div>
                          <label className="text-xs text-gray-600">名称</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-purple-400 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="预设名称"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">ABI 内容</label>
                          <textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-purple-400 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                            placeholder="ABI JSON..."
                            rows={8}
                          />
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleSaveEdit('abi', preset.id)}
                            className="flex-1 px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700"
                          >
                            保存
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="flex-1 px-2 py-1 bg-gray-400 text-white rounded text-xs hover:bg-gray-500"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div 
                          className="flex items-center px-3 py-2 w-full"
                          onClick={(e) => handleAbiToggle(preset.abi, e)}
                        >
                          <div className="flex-1">
                            <div className="font-medium truncate">{preset.name}</div>
                          </div>
                          {isAbiActive(preset.abi) && (
                            <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <button
                            onClick={(e) => handleViewAbi(preset.id, e)}
                            className="p-1 bg-white rounded shadow-sm hover:bg-blue-50"
                            title="查看内容"
                          >
                            <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit('abi', preset.id, e);
                            }}
                            className="p-1 bg-white rounded shadow-sm hover:bg-purple-50"
                            title="编辑"
                          >
                            <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAbi(preset.id, preset.name, e);
                            }}
                            className="p-1 bg-white rounded shadow-sm hover:bg-red-50"
                            title="删除"
                          >
                            <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </>
                    )}
                  </div>);
                  })}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ABI 查看弹窗 */}
      {viewingAbi && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">
                {viewingAbi.name}
              </h3>
              <button
                onClick={handleCloseAbiView}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <pre className="text-xs font-mono bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto">
                {viewingAbi.abi}
              </pre>
            </div>
            <div className="flex gap-2 p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  handleCloseAbiView();
                  handleStartEdit('abi', viewingAbi.id, { stopPropagation: () => {} } as any);
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
              >
                编辑
              </button>
              <button
                onClick={handleCloseAbiView}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PresetSidebar;

