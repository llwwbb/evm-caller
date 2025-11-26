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
  onAbiSelect: (abi: string) => void;
  onPresetsChanged?: () => void; // 预设变化时的回调
  currentRpcUrl?: string;
  currentContractAddress?: string;
  currentAbi?: string;
  refreshTrigger?: number; // 用于触发刷新的计数器
}

const PresetSidebar: React.FC<PresetSidebarProps> = ({
  onRpcSelect,
  onContractSelect,
  onAbiSelect,
  onPresetsChanged,
  currentRpcUrl,
  currentContractAddress,
  currentAbi,
  refreshTrigger,
}) => {
  const [rpcPresets, setRpcPresets] = useState<RpcPreset[]>([]);
  const [contractPresets, setContractPresets] = useState<ContractPreset[]>([]);
  const [abiPresets, setAbiPresets] = useState<AbiPreset[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['rpc', 'contract', 'abi'])); // 默认全部展开
  const [editingPreset, setEditingPreset] = useState<{ type: 'rpc' | 'contract' | 'abi'; id: string } | null>(null);
  const [editName, setEditName] = useState('');

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
    return currentAbi === abi;
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

  const handleStartEdit = (type: 'rpc' | 'contract' | 'abi', id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPreset({ type, id });
    setEditName(name);
  };

  const handleSaveEdit = (type: 'rpc' | 'contract' | 'abi', id: string) => {
    if (!editName.trim()) return;
    
    if (type === 'rpc') {
      updateRpcPreset(id, { name: editName.trim() });
    } else if (type === 'contract') {
      updateContractPreset(id, { name: editName.trim() });
    } else if (type === 'abi') {
      updateAbiPreset(id, { name: editName.trim() });
    }
    
    setEditingPreset(null);
    setEditName('');
    loadPresets();
    onPresetsChanged?.();
  };

  const handleCancelEdit = () => {
    setEditingPreset(null);
    setEditName('');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
      <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex-shrink-0">
        <h2 className="text-lg font-bold">预设配置</h2>
        <p className="text-xs text-indigo-100 mt-1">点击快速切换</p>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {/* RPC 预设 */}
        <div className="flex-1 border-b border-gray-200 flex flex-col min-h-0">
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
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1 min-h-0">
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
                      <div className="px-3 py-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit('rpc', preset.id);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          className="w-full px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
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
                            onClick={(e) => handleStartEdit('rpc', preset.id, preset.name, e)}
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
        <div className="flex-1 border-b border-gray-200 flex flex-col min-h-0">
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
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1 min-h-0">
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
                      <div className="px-3 py-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit('contract', preset.id);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          className="w-full px-2 py-1 text-sm border border-green-400 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                          autoFocus
                        />
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
                            onClick={(e) => handleStartEdit('contract', preset.id, preset.name, e)}
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
        <div className="flex-1 flex flex-col min-h-0">
          <button
            onClick={() => toggleSection('abi')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <span className="font-semibold text-gray-700">ABI 接口</span>
              <span className="text-xs text-gray-500">({abiPresets.length})</span>
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
                abiPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className={`group relative rounded-lg text-sm transition-all ${
                      isAbiActive(preset.abi)
                        ? 'bg-purple-100 text-purple-800 font-medium border-2 border-purple-300'
                        : 'hover:bg-gray-100 text-gray-700 border-2 border-transparent'
                    }`}
                  >
                    {editingPreset?.type === 'abi' && editingPreset?.id === preset.id ? (
                      <div className="px-3 py-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit('abi', preset.id);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          className="w-full px-2 py-1 text-sm border border-purple-400 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                          autoFocus
                        />
                        <div className="flex gap-1 mt-2">
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
                        <button
                          onClick={() => onAbiSelect(preset.abi)}
                          className="w-full text-left px-3 py-2"
                        >
                          <div className="font-medium truncate">{preset.name}</div>
                        </button>
                        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <button
                            onClick={(e) => handleStartEdit('abi', preset.id, preset.name, e)}
                            className="p-1 bg-white rounded shadow-sm hover:bg-purple-50"
                            title="编辑"
                          >
                            <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => handleDeleteAbi(preset.id, preset.name, e)}
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
      </div>
    </div>
  );
};

export default PresetSidebar;

