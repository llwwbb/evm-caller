import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import {
  saveRpcPreset,
  saveContractPreset,
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
  externalRpcUrl?: string; // 新增：从侧边栏选择时传入
  externalContractAddress?: string; // 新增：从侧边栏选择时传入
  onPresetsSaved?: () => void;
}

const RpcConfig: React.FC<RpcConfigProps> = ({ 
  onRpcUrlChange,
  onContractAddressChange,
  onBlockTagChange,
  initialRpcUrl = '',
  initialContractAddress = '',
  initialBlockTag = 'latest',
  externalRpcUrl, // 新增
  externalContractAddress, // 新增
  onPresetsSaved,
}) => {
  const [rpcUrl, setRpcUrl] = useState(initialRpcUrl);
  const [contractAddress, setContractAddress] = useState(initialContractAddress);
  const [blockTag, setBlockTag] = useState(initialBlockTag);
  const [isValidating, setIsValidating] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');

  // 监听外部 RPC URL 变化（从侧边栏选择时）
  useEffect(() => {
    if (externalRpcUrl && externalRpcUrl !== rpcUrl) {
      setRpcUrl(externalRpcUrl);
    }
  }, [externalRpcUrl]);

  // 监听外部合约地址变化（从侧边栏选择时）
  useEffect(() => {
    if (externalContractAddress && externalContractAddress !== contractAddress) {
      setContractAddress(externalContractAddress);
    }
  }, [externalContractAddress]);

  // 自动保存到 localStorage 并通知父组件
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
    }, 500);

    return () => clearTimeout(timer);
  }, [rpcUrl, contractAddress, blockTag, onRpcUrlChange, onContractAddressChange, onBlockTagChange]);

  const handleTestConnection = async () => {
    if (!rpcUrl.trim()) {
      setValidationMessage('❌ 请输入 RPC URL');
      return;
    }

    setIsValidating(true);
    setValidationMessage('🔄 正在测试连接...');

    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl.trim());
      const network = await provider.getNetwork();
      const blockNumber = await provider.getBlockNumber();
      
      setValidationMessage(
        `✅ 连接成功！Chain ID: ${network.chainId}, 最新区块: ${blockNumber}`
      );
    } catch (error) {
      console.error('RPC 连接测试失败:', error);
      setValidationMessage(`❌ 连接失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsValidating(false);
    }
  };

  const handleSaveRpc = () => {
    if (!rpcUrl.trim()) {
      alert('请输入 RPC URL');
      return;
    }

    const name = prompt('请为这个 RPC 预设命名：');
    if (!name?.trim()) return;

    try {
      saveRpcPreset(name.trim(), rpcUrl.trim());
      alert('✅ RPC 预设已保存');
      onPresetsSaved?.();
    } catch (error) {
      console.error('保存 RPC 预设失败:', error);
      alert('❌ 保存失败');
    }
  };

  const handleSaveContract = () => {
    if (!contractAddress.trim()) {
      alert('请输入合约地址');
      return;
    }

    const name = prompt('请为这个合约预设命名：');
    if (!name?.trim()) return;

    const description = prompt('（可选）添加描述：');

    try {
      saveContractPreset(name.trim(), contractAddress.trim(), description?.trim());
      alert('✅ 合约预设已保存');
      onPresetsSaved?.();
    } catch (error) {
      console.error('保存合约预设失败:', error);
      alert('❌ 保存失败');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          ① RPC 配置
        </h2>
      </div>

      <div className="space-y-4">
        {/* RPC URL */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              RPC URL
            </label>
            <button
              onClick={handleSaveRpc}
              disabled={!rpcUrl.trim()}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              💾 保存为预设
            </button>
          </div>
          <input
            type="text"
            value={rpcUrl}
            onChange={(e) => setRpcUrl(e.target.value)}
            placeholder="https://eth.llamarpc.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        {/* 合约地址 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              合约地址
            </label>
            <button
              onClick={handleSaveContract}
              disabled={!contractAddress.trim()}
              className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              💾 保存为预设
            </button>
          </div>
          <input
            type="text"
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value)}
            placeholder="0x..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
          />
        </div>

        {/* 区块标识 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            区块标识 (Block Tag)
          </label>
          <input
            type="text"
            value={blockTag}
            onChange={(e) => setBlockTag(e.target.value)}
            placeholder="latest"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
          <p className="mt-1 text-xs text-gray-500">
            可选值: latest (最新), earliest (最早), pending (待确认), 或具体区块号
          </p>
        </div>

        {/* 测试连接按钮 */}
        <button
          onClick={handleTestConnection}
          disabled={isValidating || !rpcUrl.trim()}
          className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {isValidating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
              测试中...
            </>
          ) : (
            '🔌 测试 RPC 连接（可选）'
          )}
        </button>

        {/* 验证消息 */}
        {validationMessage && (
          <div className={`p-3 rounded-lg text-sm ${
            validationMessage.startsWith('✅') 
              ? 'bg-green-50 text-green-800 border border-green-200'
              : validationMessage.startsWith('❌')
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}>
            {validationMessage}
          </div>
        )}
      </div>
    </div>
  );
};

export default RpcConfig;
