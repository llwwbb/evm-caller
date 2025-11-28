import { useState, useEffect } from 'react';
import RpcConfig from './components/RpcConfig';
import AbiInput from './components/AbiInput';
import FunctionList from './components/FunctionList';
import ResultDisplay from './components/ResultDisplay';
import ConfigManager from './components/ConfigManager';
import PresetSidebar from './components/PresetSidebar';
import TransactionParserPage from './components/TransactionParserPage';
import HexParserPage from './components/HexParserPage';
import EventQueryPage from './components/EventQueryPage';
import { callViewFunction } from './utils/rpcCaller';
import { parseAbi } from './utils/abiParser';
import { RpcConfig as RpcConfigType, ParsedFunction, CallHistory } from './types';
import { 
  initializeDefaultPresets, 
  loadLastUsedConfig, 
  saveCallHistory, 
  loadCallHistory
} from './utils/presetStorage';

type TabType = 'function-call' | 'transaction-parser' | 'hex-parser' | 'event-query';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('function-call');
  const [rpcUrl, setRpcUrl] = useState('');
  const [contractAddress, setContractAddress] = useState('');
  const [blockTag, setBlockTag] = useState('latest');
  const [functions, setFunctions] = useState<ParsedFunction[]>([]);
  const [abiString, setAbiString] = useState('');
  const [callHistory, setCallHistory] = useState<CallHistory[]>(() => loadCallHistory()); // 初始化时从 localStorage 加载
  const [isCallInProgress, setIsCallInProgress] = useState(false);
  const [selectedAbis, setSelectedAbis] = useState<string[]>([]); // 多选的 ABI
  const [selectedAbiNames, setSelectedAbiNames] = useState<string[]>([]); // 多选的 ABI 名称
  const [mergedAbi, setMergedAbi] = useState<string>(''); // 合并后的 ABI
  const [presetRefreshTrigger, setPresetRefreshTrigger] = useState(0); // 用于触发侧边栏刷新
  
  // 加载上次使用的配置
  const [lastUsed] = useState(() => loadLastUsedConfig());

  // 初始化默认预设
  useEffect(() => {
    initializeDefaultPresets();
  }, []);

  // 合并多个 ABI
  useEffect(() => {
    if (selectedAbis.length === 0) {
      setMergedAbi('');
      // 清空函数列表，避免显示旧的数据
      if (activeTab === 'function-call') {
        setFunctions([]);
        setAbiString('');
      }
      return;
    }

    try {
      const abiArrays = selectedAbis.map(abiStr => {
        try {
          return JSON.parse(abiStr);
        } catch {
          return [];
        }
      });

      // 合并所有 ABI 数组
      const merged = abiArrays.flat();
      const mergedStr = JSON.stringify(merged);
      setMergedAbi(mergedStr);
      
      // 在函数调用页面，如果有合并的 ABI，自动解析
      if (activeTab === 'function-call' && mergedStr) {
        try {
          const parsedFunctions = parseAbi(merged, true);
          setFunctions(parsedFunctions);
          setAbiString(mergedStr);
        } catch (error) {
          console.error('解析合并 ABI 失败:', error);
          setFunctions([]);
          setAbiString('');
        }
      }
    } catch (error) {
      console.error('合并 ABI 失败:', error);
      setMergedAbi('');
      if (activeTab === 'function-call') {
        setFunctions([]);
        setAbiString('');
      }
    }
  }, [selectedAbis, activeTab]);

  // 监听调用历史变化，自动保存到 localStorage
  useEffect(() => {
    saveCallHistory(callHistory);
  }, [callHistory]);

  const handleAbiParsed = (parsedFunctions: ParsedFunction[], abi: string) => {
    // 只有在没有选择多个 ABI 时，才使用手动输入的 ABI
    if (selectedAbis.length === 0) {
      setFunctions(parsedFunctions);
      setAbiString(abi);
    }
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
        func.outputs,  // 传递输出定义，用于格式化带名称的返回值
        func.stateMutability  // 传递函数状态可变性，用于判断是否需要模拟调用
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

  const tabs = [
    { id: 'function-call' as TabType, name: '函数调用', icon: '🔧' },
    { id: 'transaction-parser' as TabType, name: '交易解析', icon: '📝' },
    { id: 'hex-parser' as TabType, name: 'Hex 解析', icon: '🔍' },
    { id: 'event-query' as TabType, name: 'Event 查询', icon: '📊' },
  ];

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
                快速调用智能合约的只读函数 + 模拟执行状态修改函数 + Parser 解析工具
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                  👁️ View/Pure
                </div>
                <div className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">
                  ⚠️ 模拟调用
                </div>
                <div className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                  无需钱包
                </div>
              </div>
              <ConfigManager onImportComplete={handleImportComplete} />
            </div>
          </div>
        </div>

        {/* 标签栏 */}
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 border-b border-gray-200">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-blue-700 border-b-2 border-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-1 max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-4 overflow-hidden w-full">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-full">
          {/* 最左列：预设侧边栏（所有标签共享） */}
          <div className="flex flex-col min-h-0">
            <PresetSidebar 
              onRpcSelect={setRpcUrl}
              onContractSelect={setContractAddress}
              onAbisSelect={(abis, names) => {
                setSelectedAbis(abis);
                setSelectedAbiNames(names);
              }}
              onPresetsChanged={() => {
                // 预设变化时触发刷新
                setPresetRefreshTrigger(prev => prev + 1);
              }}
              currentRpcUrl={rpcUrl}
              currentContractAddress={contractAddress}
              currentAbis={selectedAbis}
              refreshTrigger={presetRefreshTrigger}
            />
          </div>

          {/* 右侧内容区域（根据标签显示不同内容） */}
          {activeTab === 'function-call' && (
            <>
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
                  externalRpcUrl={rpcUrl}
                  externalContractAddress={contractAddress}
                  onPresetsSaved={() => setPresetRefreshTrigger(prev => prev + 1)}
                />

            {/* 步骤 2: ABI 输入 */}
            {selectedAbis.length > 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  ② ABI 已选择
                </h2>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    ✅ 已从侧边栏选择 {selectedAbis.length} 个 ABI
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    已解析 {functions.length} 个函数
                  </p>
                </div>
              </div>
            ) : (
              <AbiInput
                onAbiParsed={handleAbiParsed}
                disabled={false}
                initialAbi={lastUsed.abi}
                externalAbi=""
                onPresetsSaved={() => setPresetRefreshTrigger(prev => prev + 1)}
              />
            )}

            {/* 进度提示 */}
            {(!rpcUrl || !contractAddress) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  👆 请先完成步骤 1：配置 RPC 和合约地址
                </p>
              </div>
            )}

            {rpcUrl && contractAddress && functions.length === 0 && selectedAbis.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  👈 请在左侧选择至少一个 ABI，或在下方输入 ABI
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
            </>
          )}

          {activeTab === 'transaction-parser' && (
            <div className="lg:col-span-3 min-h-0">
              <TransactionParserPage rpcUrl={rpcUrl} selectedAbis={selectedAbis} selectedAbiNames={selectedAbiNames} mergedAbi={mergedAbi} />
            </div>
          )}

          {activeTab === 'hex-parser' && (
            <div className="lg:col-span-3 min-h-0">
              <HexParserPage mergedAbi={mergedAbi} />
            </div>
          )}

          {activeTab === 'event-query' && (
            <div className="lg:col-span-3 min-h-0">
              <EventQueryPage rpcUrl={rpcUrl} contractAddress={contractAddress} mergedAbi={mergedAbi} selectedAbiNames={selectedAbiNames} selectedAbis={selectedAbis} />
            </div>
          )}
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

