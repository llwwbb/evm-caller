import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ethers } from 'ethers';
import {
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
  selectedAbiNames?: string[]; // 选中的 ABI 名称列表
  functionsCount?: number; // 解析出的函数数量
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
  selectedAbiNames = [],
  functionsCount = 0,
}) => {
  const { t } = useTranslation();
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
      setValidationMessage(`❌ ${t('alert.enterRpcUrl')}`);
      return;
    }

    setIsValidating(true);
    setValidationMessage(`🔄 ${t('functionList.calling')}...`);

    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl.trim());
      const network = await provider.getNetwork();
      const blockNumber = await provider.getBlockNumber();
      
      setValidationMessage(
        `✅ ${t('result.copySuccess')}! Chain ID: ${network.chainId}, Block: ${blockNumber}`
      );
    } catch (error) {
      console.error('RPC 连接测试失败:', error);
      setValidationMessage(`❌ ${t('result.copyFailed')}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsValidating(false);
    }
  };


  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          {t('rpcConfig.title')}
        </h2>
      </div>

      <div className="space-y-4">
        {/* RPC URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('rpcConfig.rpcUrl')}
          </label>
          <input
            type="text"
            value={rpcUrl}
            readOnly
            placeholder={t('rpcConfig.rpcUrlPlaceholder')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-gray-500">
            👈 {t('rpcConfig.selectFromLeft')}
          </p>
        </div>

        {/* 合约地址 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('rpcConfig.contractAddress')}
          </label>
          <input
            type="text"
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value)}
            placeholder={t('rpcConfig.contractAddressPlaceholder')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
          />
        </div>

        {/* 区块标识 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('rpcConfig.blockTag')}
          </label>
          <input
            type="text"
            value={blockTag}
            onChange={(e) => setBlockTag(e.target.value)}
            placeholder={t('rpcConfig.blockTagPlaceholder')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
          <p className="mt-1 text-xs text-gray-500">
            {t('rpcConfig.blockTagPlaceholder')}
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
              {t('functionList.calling')}...
            </>
          ) : (
            `🔌 ${t('rpcConfig.title')}`
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

        {/* ABI 选择状态 */}
        <div className="pt-4 border-t border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('preset.abi')}
          </label>
          {selectedAbiNames.length === 0 ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                👈 {t('functionList.selectAbi')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium text-purple-800">
                    {t('rpcConfig.selectedAbis', { count: selectedAbiNames.length })}
                  </span>
                </div>
                <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded">
                  {t('rpcConfig.functionsCount', { count: functionsCount })}
                </span>
              </div>
              
              {/* ABI 列表 */}
              <div className="space-y-1">
                {selectedAbiNames.map((name, index) => (
                  <div key={index} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded text-sm">
                    <svg className="w-4 h-4 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    <span className="text-gray-700 truncate">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RpcConfig;
