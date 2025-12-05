import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  saveRpcPreset,
  saveContractPreset,
  saveAbiPreset,
} from '../utils/presetStorage';
import { RpcPreset, ContractPreset, AbiPreset } from '../types';

interface PresetSidebarProps {
  onRpcSelect: (rpcUrl: string) => void;
  onContractSelect: (address: string) => void;
  onAbisSelect: (abis: string[], names: string[]) => void;
  onPresetsChanged?: () => void;
  currentRpcUrl?: string;
  currentContractAddress?: string;
  currentAbis?: string[];
  refreshTrigger?: number;
}

// 弹窗类型
type ModalType = 'rpc' | 'contract' | 'abi';
type ModalMode = 'add' | 'edit' | 'view';

interface ModalState {
  isOpen: boolean;
  type: ModalType;
  mode: ModalMode;
  id?: string;
  name: string;
  value: string;
  description?: string;
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
  const { t } = useTranslation();
  const [rpcPresets, setRpcPresets] = useState<RpcPreset[]>([]);
  const [contractPresets, setContractPresets] = useState<ContractPreset[]>([]);
  const [abiPresets, setAbiPresets] = useState<AbiPreset[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['rpc', 'contract', 'abi']));
  
  // 统一的弹窗状态
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    type: 'rpc',
    mode: 'add',
    name: '',
    value: '',
    description: '',
  });

  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    loadPresets();
  }, []);

  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      loadPresets();
    }
  }, [refreshTrigger]);

  const loadPresets = () => {
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

  const isRpcActive = (rpcUrl: string) => currentRpcUrl === rpcUrl;
  const isContractActive = (address: string) => currentContractAddress?.toLowerCase() === address.toLowerCase();
  const isAbiActive = (abi: string) => currentAbis.includes(abi);

  const handleAbiToggle = (abi: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentAbis.includes(abi)) {
      const newAbis = currentAbis.filter(a => a !== abi);
      const newNames = newAbis.map(a => abiPresets.find(p => p.abi === a)?.name || '');
      onAbisSelect(newAbis, newNames);
    } else {
      const newAbis = [...currentAbis, abi];
      const newNames = newAbis.map(a => abiPresets.find(p => p.abi === a)?.name || '');
      onAbisSelect(newAbis, newNames);
    }
  };

  const handleSelectAllAbis = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentAbis.length === abiPresets.length && abiPresets.length > 0) {
      onAbisSelect([], []);
    } else {
      const allAbis = abiPresets.map(p => p.abi);
      const allNames = abiPresets.map(p => p.name);
      onAbisSelect(allAbis, allNames);
    }
  };
  
  // 翻译后的选中状态文本
  const allAbiSelected = currentAbis.length === abiPresets.length && abiPresets.length > 0;

  // 打开新增弹窗
  const openAddModal = (type: ModalType, e: React.MouseEvent) => {
    e.stopPropagation();
    setModal({
      isOpen: true,
      type,
      mode: 'add',
      name: '',
      value: '',
      description: '',
    });
  };

  // 打开编辑弹窗
  const openEditModal = (type: ModalType, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (type === 'rpc') {
      const preset = rpcPresets.find(p => p.id === id);
      if (preset) {
        setModal({
          isOpen: true,
          type,
          mode: 'edit',
          id,
          name: preset.name,
          value: preset.rpcUrl,
        });
      }
    } else if (type === 'contract') {
      const preset = contractPresets.find(p => p.id === id);
      if (preset) {
        setModal({
          isOpen: true,
          type,
          mode: 'edit',
          id,
          name: preset.name,
          value: preset.address,
          description: preset.description || '',
        });
      }
    } else if (type === 'abi') {
      const preset = abiPresets.find(p => p.id === id);
      if (preset) {
        setModal({
          isOpen: true,
          type,
          mode: 'edit',
          id,
          name: preset.name,
          value: preset.abi,
        });
      }
    }
  };

  // 打开查看弹窗（仅 ABI）
  const openViewModal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const preset = abiPresets.find(p => p.id === id);
    if (preset) {
      setModal({
        isOpen: true,
        type: 'abi',
        mode: 'view',
        id,
        name: preset.name,
        value: preset.abi,
      });
    }
  };

  // 关闭弹窗
  const closeModal = () => {
    setModal({
      isOpen: false,
      type: 'rpc',
      mode: 'add',
      name: '',
      value: '',
      description: '',
    });
  };

  // 解析 JS 对象或 JSON
  const parseJsObjectOrJson = (str: string): unknown => {
    // 先尝试标准 JSON 解析
    try {
      return JSON.parse(str);
    } catch {
      // 如果 JSON 解析失败，尝试作为 JS 对象解析
      try {
        // 使用 Function 构造函数安全地解析 JS 对象语法
        // eslint-disable-next-line no-new-func
        const result = new Function('return (' + str + ')')();
        return result;
      } catch {
        throw new Error('Invalid format');
      }
    }
  };

  // 格式化 JSON
  const handleFormatJson = () => {
    if (modal.type !== 'abi') return;
    
    try {
      const parsed = parseJsObjectOrJson(modal.value);
      const formatted = JSON.stringify(parsed, null, 2);
      setModal({ ...modal, value: formatted });
    } catch {
      alert(t('presetSidebar.invalidAbi'));
    }
  };

  // 拖拽处理函数
  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (modal.mode === 'view') return;

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    
    // 读取文件内容
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        // 尝试解析和格式化 JSON 或 JS 对象
        try {
          const parsed = parseJsObjectOrJson(content);
          const formatted = JSON.stringify(parsed, null, 2);
          setModal({ ...modal, value: formatted });
        } catch {
          // 如果无法解析，直接使用原始内容
          setModal({ ...modal, value: content });
        }
      }
    };
    reader.onerror = () => {
      alert(t('presetSidebar.dropFileHere'));
    };
    reader.readAsText(file);
  };

  // 保存弹窗数据
  const handleModalSave = () => {
    if (!modal.name.trim() || !modal.value.trim()) {
      alert(t('presetSidebar.fillComplete'));
      return;
    }

    // ABI 格式验证
    if (modal.type === 'abi') {
      try {
        JSON.parse(modal.value);
      } catch {
        alert(t('presetSidebar.invalidAbi'));
        return;
      }
    }

    try {
      if (modal.mode === 'add') {
        // 新增
        if (modal.type === 'rpc') {
          saveRpcPreset(modal.name.trim(), modal.value.trim());
        } else if (modal.type === 'contract') {
          saveContractPreset(modal.name.trim(), modal.value.trim(), modal.description?.trim());
        } else if (modal.type === 'abi') {
          saveAbiPreset(modal.name.trim(), modal.value.trim());
        }
      } else {
        // 编辑
        if (modal.id) {
          if (modal.type === 'rpc') {
            updateRpcPreset(modal.id, { name: modal.name.trim(), rpcUrl: modal.value.trim() });
          } else if (modal.type === 'contract') {
            updateContractPreset(modal.id, { 
              name: modal.name.trim(), 
              address: modal.value.trim(),
              description: modal.description?.trim() || undefined
            });
          } else if (modal.type === 'abi') {
            updateAbiPreset(modal.id, { name: modal.name.trim(), abi: modal.value.trim() });
          }
        }
      }
      
      loadPresets();
      onPresetsChanged?.();
      closeModal();
    } catch (error) {
      console.error(t('presetSidebar.saveError'), error);
      alert(t('modal.saveFailed'));
    }
  };

  // 删除预设
  const handleDelete = (type: ModalType, id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(t('preset.confirmDelete', { name }))) {
      if (type === 'rpc') {
        // 如果删除的 RPC 正是当前选中的，清空选中状态
        const preset = rpcPresets.find(p => p.id === id);
        if (preset && currentRpcUrl === preset.rpcUrl) {
          onRpcSelect('');
        }
        deleteRpcPreset(id);
      } else if (type === 'contract') {
        // 如果删除的合约正是当前选中的，清空选中状态
        const preset = contractPresets.find(p => p.id === id);
        if (preset && currentContractAddress?.toLowerCase() === preset.address.toLowerCase()) {
          onContractSelect('');
        }
        deleteContractPreset(id);
      } else if (type === 'abi') {
        // 如果删除的 ABI 在选中列表中，需要从选中列表移除
        const preset = abiPresets.find(p => p.id === id);
        if (preset && currentAbis.includes(preset.abi)) {
          const newAbis = currentAbis.filter(a => a !== preset.abi);
          const newNames = newAbis.map(a => {
            const p = abiPresets.find(ap => ap.abi === a);
            return p?.name || '';
          });
          onAbisSelect(newAbis, newNames);
        }
        deleteAbiPreset(id);
      }
      loadPresets();
      onPresetsChanged?.();
    }
  };

  // 获取弹窗标题
  const getModalTitle = () => {
    const typeMap = { rpc: 'RPC', contract: t('preset.contract'), abi: 'ABI' };
    const modeMap = { add: t('presetSidebar.addDialogTitle'), edit: t('presetSidebar.editDialogTitle'), view: t('presetSidebar.viewDialogTitle') };
    return `${modeMap[modal.mode]} ${typeMap[modal.type]}`;
  };

  // 获取弹窗样式类名
  const getModalStyles = () => {
    const styleMap = {
      rpc: {
        headerBg: 'bg-blue-50',
        headerText: 'text-blue-900',
        buttonBg: 'bg-blue-600 hover:bg-blue-700',
        inputRing: 'focus:ring-blue-500',
      },
      contract: {
        headerBg: 'bg-green-50',
        headerText: 'text-green-900',
        buttonBg: 'bg-green-600 hover:bg-green-700',
        inputRing: 'focus:ring-green-500',
      },
      abi: {
        headerBg: 'bg-purple-50',
        headerText: 'text-purple-900',
        buttonBg: 'bg-purple-600 hover:bg-purple-700',
        inputRing: 'focus:ring-purple-500',
      },
    };
    return styleMap[modal.type];
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
      <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex-shrink-0">
        <h2 className="text-lg font-bold">{t('preset.title')}</h2>
        <p className="text-xs text-indigo-100 mt-1">{t('preset.subtitle')}</p>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {/* RPC 预设 */}
        <div className="border-b border-gray-200 flex flex-col">
          <div className="flex items-center">
            <button
              onClick={() => toggleSection('rpc')}
              className="flex-1 px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
                <span className="font-semibold text-gray-700">{t('preset.rpc')}</span>
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
            <button
              onClick={(e) => openAddModal('rpc', e)}
              className="px-3 py-3 hover:bg-blue-50 transition-colors flex-shrink-0"
              title={t('preset.addRpc')}
            >
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          
          {expandedSections.has('rpc') && (
            <div className="overflow-y-auto px-2 pb-2 space-y-1 max-h-64">
              {rpcPresets.length === 0 ? (
                <p className="text-xs text-gray-500 px-2 py-2">{t('preset.noPresets')}</p>
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
                    <button
                      onClick={() => onRpcSelect(preset.rpcUrl)}
                      className="w-full text-left px-3 py-2"
                    >
                      <div className="font-medium truncate">{preset.name}</div>
                    </button>
                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button
                        onClick={(e) => openEditModal('rpc', preset.id, e)}
                        className="p-1 bg-white rounded shadow-sm hover:bg-blue-50"
                        title={t('preset.edit')}
                      >
                        <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => handleDelete('rpc', preset.id, preset.name, e)}
                        className="p-1 bg-white rounded shadow-sm hover:bg-red-50"
                        title={t('preset.delete')}
                      >
                        <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* 合约地址预设 */}
        <div className="border-b border-gray-200 flex flex-col">
          <div className="flex items-center">
            <button
              onClick={() => toggleSection('contract')}
              className="flex-1 px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="font-semibold text-gray-700">{t('preset.contract')}</span>
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
            <button
              onClick={(e) => openAddModal('contract', e)}
              className="px-3 py-3 hover:bg-green-50 transition-colors flex-shrink-0"
              title={t('preset.addContract')}
            >
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          
          {expandedSections.has('contract') && (
            <div className="overflow-y-auto px-2 pb-2 space-y-1 max-h-64">
              {contractPresets.length === 0 ? (
                <p className="text-xs text-gray-500 px-2 py-2">{t('presetSidebar.noPresets')}</p>
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
                        onClick={(e) => openEditModal('contract', preset.id, e)}
                        className="p-1 bg-white rounded shadow-sm hover:bg-green-50"
                        title={t('presetSidebar.edit')}
                      >
                        <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => handleDelete('contract', preset.id, preset.name, e)}
                        className="p-1 bg-white rounded shadow-sm hover:bg-red-50"
                        title={t('presetSidebar.delete')}
                      >
                        <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ABI 预设 */}
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center">
            <button
              onClick={() => toggleSection('abi')}
              className="flex-1 px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2 flex-1">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span className="font-semibold text-gray-700">{t('preset.abi')}</span>
                <span className="text-xs text-gray-500">({currentAbis.length}/{abiPresets.length})</span>
                {abiPresets.length > 0 && (
                  <button
                    onClick={handleSelectAllAbis}
                    className="ml-auto text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {allAbiSelected ? t('preset.deselectAll') : t('preset.selectAll')}
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
            <button
              onClick={(e) => openAddModal('abi', e)}
              className="px-3 py-3 hover:bg-purple-50 transition-colors flex-shrink-0"
              title={t('preset.addAbi')}
            >
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          
          {expandedSections.has('abi') && (
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1 min-h-0">
              {abiPresets.length === 0 ? (
                <p className="text-xs text-gray-500 px-2 py-2">{t('presetSidebar.noPresets')}</p>
              ) : (
                abiPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className={`group relative rounded-lg text-sm transition-all cursor-pointer ${
                      isAbiActive(preset.abi)
                        ? 'bg-purple-100 text-purple-800 font-medium border-2 border-purple-300'
                        : 'hover:bg-gray-100 text-gray-700 border-2 border-transparent'
                    }`}
                  >
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
                        onClick={(e) => openViewModal(preset.id, e)}
                        className="p-1 bg-white rounded shadow-sm hover:bg-blue-50"
                        title={t('preset.view')}
                      >
                        <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => handleDelete('abi', preset.id, preset.name, e)}
                        className="p-1 bg-white rounded shadow-sm hover:bg-red-50"
                        title={t('presetSidebar.delete')}
                      >
                        <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* 统一弹窗 */}
      {modal.isOpen && (() => {
        const styles = getModalStyles();
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
              <div className={`flex items-center justify-between p-4 border-b border-gray-200 ${styles.headerBg}`}>
                <h3 className={`text-lg font-semibold ${styles.headerText}`}>
                  {getModalTitle()}
                </h3>
                <button
                  onClick={closeModal}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  {/* 名称 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('presetSidebar.name')}
                    </label>
                    <input
                      type="text"
                      value={modal.name}
                      onChange={(e) => setModal({ ...modal, name: e.target.value })}
                      placeholder={t('presetSidebar.namePlaceholder')}
                      disabled={modal.mode === 'view'}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 ${styles.inputRing} focus:border-transparent ${
                        modal.mode === 'view' ? 'bg-gray-50 cursor-not-allowed' : ''
                      }`}
                    />
                  </div>

                  {/* 值（RPC URL / 合约地址 / ABI） */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        {modal.type === 'rpc' ? t('presetSidebar.rpcUrl') : modal.type === 'contract' ? t('presetSidebar.contractAddress') : t('presetSidebar.abi')}
                      </label>
                      {modal.type === 'abi' && modal.mode !== 'view' && (
                        <button
                          onClick={handleFormatJson}
                          className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
                        >
                          ✨ {t('presetSidebar.format')}
                        </button>
                      )}
                    </div>
                    {modal.type === 'abi' ? (
                      <div className="relative">
                        <textarea
                          value={modal.value}
                          onChange={(e) => setModal({ ...modal, value: e.target.value })}
                          placeholder={modal.mode !== 'view' ? t('presetSidebar.dragDropHint') : 'ABI JSON'}
                          disabled={modal.mode === 'view'}
                          rows={15}
                          onDragOver={handleDragOver}
                          onDragEnter={handleDragEnter}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          className={`w-full px-3 py-2 border rounded-lg font-mono text-xs focus:ring-2 ${styles.inputRing} focus:border-transparent transition-all ${
                            modal.mode === 'view' 
                              ? 'bg-gray-50 cursor-not-allowed border-gray-300' 
                              : isDragging 
                                ? 'border-purple-500 border-2 bg-purple-50 border-dashed' 
                                : 'border-gray-300'
                          }`}
                        />
                        {isDragging && modal.mode !== 'view' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-purple-100 bg-opacity-90 rounded-lg pointer-events-none">
                            <div className="text-center">
                              <svg className="w-12 h-12 mx-auto text-purple-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                              <p className="text-purple-700 font-medium">{t('presetSidebar.dropFileHere')}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={modal.value}
                        onChange={(e) => setModal({ ...modal, value: e.target.value })}
                        placeholder={modal.type === 'rpc' ? 'https://...' : '0x...'}
                        disabled={modal.mode === 'view'}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg font-mono focus:ring-2 ${styles.inputRing} focus:border-transparent ${
                          modal.mode === 'view' ? 'bg-gray-50 cursor-not-allowed' : ''
                        }`}
                      />
                    )}
                  </div>

                  {/* 描述（仅合约） */}
                  {modal.type === 'contract' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('presetSidebar.description')}
                      </label>
                      <input
                        type="text"
                        value={modal.description || ''}
                        onChange={(e) => setModal({ ...modal, description: e.target.value })}
                        placeholder={t('presetSidebar.descriptionPlaceholder')}
                        disabled={modal.mode === 'view'}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 ${styles.inputRing} focus:border-transparent ${
                          modal.mode === 'view' ? 'bg-gray-50 cursor-not-allowed' : ''
                        }`}
                      />
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2 p-4 border-t border-gray-200">
                {modal.mode === 'view' ? (
                  <>
                    <button
                      onClick={() => setModal({ ...modal, mode: 'edit' })}
                      className={`flex-1 px-4 py-2 text-white rounded-lg ${styles.buttonBg}`}
                    >
                      {t('presetSidebar.edit')}
                    </button>
                    <button
                      onClick={closeModal}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                    >
                      {t('presetSidebar.close')}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleModalSave}
                      className={`flex-1 px-4 py-2 text-white rounded-lg ${styles.buttonBg}`}
                    >
                      {t('presetSidebar.save')}
                    </button>
                    <button
                      onClick={closeModal}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                    >
                      {t('presetSidebar.cancel')}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default PresetSidebar;
