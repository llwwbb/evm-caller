import { useState, useEffect } from 'react';
import RpcConfig from './components/RpcConfig';
import AbiInput from './components/AbiInput';
import FunctionList from './components/FunctionList';
import ResultDisplay from './components/ResultDisplay';
import ConfigManager from './components/ConfigManager';
import PresetSidebar from './components/PresetSidebar';
import { callViewFunction } from './utils/rpcCaller';
import { RpcConfig as RpcConfigType, ParsedFunction, CallResult } from './types';
import { initializeDefaultPresets, loadLastUsedConfig } from './utils/presetStorage';

interface CallHistory {
  id: string;
  functionName: string;
  args: any[];
  result: CallResult;
  timestamp: number;
  blockTag?: string | number; // 记录调用时使用的区块标识
}

function App() {
  const [rpcUrl, setRpcUrl] = useState('');
  const [contractAddress, setContractAddress] = useState('');
  const [blockTag, setBlockTag] = useState('latest');
  const [functions, setFunctions] = useState<ParsedFunction[]>([]);
  const [abiString, setAbiString] = useState('');
  const [callHistory, setCallHistory] = useState<CallHistory[]>([]);
  const [isCallInProgress, setIsCallInProgress] = useState(false);
  const [selectedAbi, setSelectedAbi] = useState<string>(''); // 从侧边栏选择的 ABI
  
  // 加载上次使用的配置
  const [lastUsed] = useState(() => loadLastUsedConfig());

  // 初始化默认预设
  useEffect(() => {
    initializeDefaultPresets();
  }, []);

  const handleAbiParsed = (parsedFunctions: ParsedFunction[], abi: string) => {
    setFunctions(parsedFunctions);
    setAbiString(abi);
  };

  const handleFunctionCall = async (functionName: string, args: any[], func: ParsedFunction) => {
    // 验证必填项
    if (!rpcUrl.trim()) {
      alert('请输入 RPC URL');
      return;
    }
    
    if (!contractAddress.trim()) {
      alert('请输入合约地址');
      return;
    }

    setIsCallInProgress(true);

    try {
      const config: RpcConfigType = {
        rpcUrl: rpcUrl.trim(),
        contractAddress: contractAddress.trim(),
        blockTag: blockTag.trim() || 'latest',
      };
      
      const result = await callViewFunction(
        config,
        abiString,
        functionName,
        args,
        func.outputs  // 传递输出定义，用于格式化带名称的返回值
      );

      // 添加到调用历史（最新的在前面）
      setCallHistory(prev => [
        {
          id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          functionName,
          args,
          result,
          timestamp: Date.now(),
          blockTag: config.blockTag, // 记录使用的区块标识
        },
        ...prev,
      ]);

      // 滚动到结果区域
      setTimeout(() => {
        const resultSection = document.getElementById('results-section');
        if (resultSection) {
          resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (error) {
      console.error('调用过程出错:', error);
    } finally {
      setIsCallInProgress(false);
    }
  };

  const handleClearAllResults = () => {
    if (window.confirm('确定要清空所有调用结果吗？')) {
      setCallHistory([]);
    }
  };

  const handleDeleteResult = (id: string) => {
    setCallHistory(prev => prev.filter(item => item.id !== id));
  };

  const handleImportComplete = () => {
    // 导入完成后刷新页面以加载新配置
    window.location.reload();
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 overflow-hidden">
      {/* 头部 */}
      <header className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Web3 RPC 调用工具
              </h1>
              <p className="mt-0.5 text-xs text-gray-600">
                快速调用智能合约的 view/pure 函数
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                  仅支持 View 函数
                </div>
                <div className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                  无需钱包
                </div>
              </div>
              <ConfigManager onImportComplete={handleImportComplete} />
            </div>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-1 max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-4 overflow-hidden w-full">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-full">
          {/* 最左列：预设侧边栏 */}
          <div className="flex flex-col min-h-0">
            <PresetSidebar
              onRpcSelect={setRpcUrl}
              onContractSelect={setContractAddress}
              onAbiSelect={setSelectedAbi}
              onPresetsChanged={() => {
                // 预设变化时刷新
                window.location.reload();
              }}
              currentRpcUrl={rpcUrl}
              currentContractAddress={contractAddress}
              currentAbi={selectedAbi}
            />
          </div>

          {/* 左中列：配置和 ABI 输入 */}
          <div className="flex flex-col space-y-4 overflow-y-auto min-h-0 pr-2">
            {/* 步骤 1: RPC 配置 */}
            <RpcConfig 
              onRpcUrlChange={setRpcUrl}
              onContractAddressChange={setContractAddress}
              onBlockTagChange={setBlockTag}
              initialRpcUrl={lastUsed.rpcUrl}
              initialContractAddress={lastUsed.contractAddress}
              initialBlockTag={lastUsed.blockTag}
              onPresetsSaved={() => window.location.reload()}
            />

            {/* 步骤 2: ABI 输入 */}
            <AbiInput
              onAbiParsed={handleAbiParsed}
              disabled={false}
              initialAbi={lastUsed.abi}
              externalAbi={selectedAbi}
              onPresetsSaved={() => window.location.reload()}
            />

            {/* 进度提示 */}
            {(!rpcUrl || !contractAddress) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  👆 请先完成步骤 1：配置 RPC 和合约地址
                </p>
              </div>
            )}

            {rpcUrl && contractAddress && functions.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  👆 请完成步骤 2：输入并解析 ABI
                </p>
              </div>
            )}
          </div>

          {/* 右中列：函数列表 */}
          <div className="flex flex-col space-y-4 overflow-y-auto min-h-0 pr-2">
            {functions.length > 0 && rpcUrl && contractAddress && (
              <FunctionList
                functions={functions}
                config={{ rpcUrl, contractAddress }}
                abiString={abiString}
                onFunctionCall={handleFunctionCall}
              />
            )}

            {/* 调用中提示 */}
            {isCallInProgress && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex-shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <p className="text-sm text-blue-800">正在调用合约函数...</p>
                </div>
              </div>
            )}
          </div>

          {/* 最右列：调用结果 */}
          <div className="flex flex-col overflow-y-auto min-h-0 pr-2">
            <div id="results-section">
              <ResultDisplay 
                results={callHistory}
                onClearAll={handleClearAllResults}
                onDeleteResult={handleDeleteResult}
              />
            </div>
          </div>
        </div>
      </main>

      {/* 页脚信息 */}
      <footer className="bg-white border-t border-gray-200 py-2 text-center text-xs text-gray-500 flex-shrink-0">
        <p>
          支持 JSON ABI 和 Solidity 函数签名两种格式 · 基于 ethers.js v6 · 仅支持 view/pure 函数
        </p>
      </footer>
    </div>
  );
}

export default App;

