import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import RpcConfig from './components/RpcConfig';
import FunctionList from './components/FunctionList';
import ResultDisplay from './components/ResultDisplay';
import ConfigManager from './components/ConfigManager';
import PresetSidebar from './components/PresetSidebar';
import TransactionParserPage from './components/TransactionParserPage';
import HexParserPage from './components/HexParserPage';
import EventQueryPage from './components/EventQueryPage';
import AbiEncoderPage from './components/AbiEncoderPage';
import LanguageSwitcher from './components/LanguageSwitcher';
import { callViewFunction } from './utils/rpcCaller';
import { parseAbi } from './utils/abiParser';
import { RpcConfig as RpcConfigType, ParsedFunction, CallHistory } from './types';
import { 
  initializeDefaultPresets, 
  loadLastUsedConfig, 
  saveCallHistory, 
  loadCallHistory,
  loadRpcPresets
} from './utils/presetStorage';

type TabType = 'function-call' | 'transaction-parser' | 'hex-parser' | 'event-query' | 'abi-encoder';

function App() {
  const { t } = useTranslation();
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
  const drawerWidth = 320;
  const [isPresetPinned, setIsPresetPinned] = useState(false);
  const [isPresetHoverOpen, setIsPresetHoverOpen] = useState(false);
  const presetDrawerOpen = isPresetPinned || isPresetHoverOpen;
  
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

  const handleDrawerMouseEnter = () => setIsPresetHoverOpen(true);
  const handleDrawerMouseLeave = () => {
    if (!isPresetPinned) {
      setIsPresetHoverOpen(false);
    }
  };

  const handleFunctionCall = async (functionName: string, args: any[], func: ParsedFunction) => {
    // 验证必填项
    if (!rpcUrl.trim()) {
      alert(t('alert.enterRpcUrl'));
      return;
    }
    
    if (!contractAddress.trim()) {
      alert(t('alert.enterContractAddress'));
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

      // 查找当前 RPC URL 对应的预设名称
      const rpcPresets = loadRpcPresets();
      const currentRpcPreset = rpcPresets.find(p => p.rpcUrl === rpcUrl.trim());
      const rpcName = currentRpcPreset?.name;

      // 添加到调用历史（最新的在前面）
      setCallHistory(prev => [
        {
          id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          functionName,
          args,
          result,
          timestamp: Date.now(),
          blockTag: config.blockTag, // 记录使用的区块标识
          rpcName, // 记录使用的 RPC 名称
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
    if (window.confirm(t('result.confirmClearAll'))) {
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
    { id: 'function-call' as TabType, name: t('tabs.functionCall'), icon: '🔧' },
    { id: 'transaction-parser' as TabType, name: t('tabs.transactionParser'), icon: '📝' },
    { id: 'hex-parser' as TabType, name: t('tabs.hexParser'), icon: '🔍' },
    { id: 'event-query' as TabType, name: t('tabs.eventQuery'), icon: '📊' },
    { id: 'abi-encoder' as TabType, name: t('tabs.abiEncoder'), icon: '⚙️' },
  ];

  return (
    <div
      className="h-screen flex flex-col bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 overflow-hidden"
    >
      {/* 全局预设抽屉 */}
      <div
        className="fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out"
        style={{ width: drawerWidth, transform: presetDrawerOpen ? 'translateX(0)' : `translateX(${12 - drawerWidth}px)` }}
        onMouseEnter={handleDrawerMouseEnter}
        onMouseLeave={handleDrawerMouseLeave}
      >
        {/* 抽屉内容区 - 添加 overflow-hidden 并在展开时允许滚动 */}
        <div className={`h-full bg-white/95 backdrop-blur-sm shadow-2xl border-r border-gray-200 rounded-r-2xl transition-all duration-300 ${presetDrawerOpen ? 'overflow-visible' : 'overflow-hidden'}`}>
          <PresetSidebar 
            onRpcSelect={setRpcUrl}
            onContractSelect={setContractAddress}
            onAbisSelect={(abis, names) => {
              setSelectedAbis(abis);
              setSelectedAbiNames(names);
            }}
            onPresetsChanged={() => {
              setPresetRefreshTrigger(prev => prev + 1);
            }}
            currentRpcUrl={rpcUrl}
            currentContractAddress={contractAddress}
            currentAbis={selectedAbis}
            refreshTrigger={presetRefreshTrigger}
            isPinned={isPresetPinned}
            onTogglePin={() => {
              setIsPresetPinned(prev => !prev);
              setIsPresetHoverOpen(true);
            }}
            isOpen={presetDrawerOpen}
          />
        </div>
        
        {/* 抽屉把手/按钮 */}
        <button
          className={`absolute top-1/2 -translate-y-1/2 bg-white border border-gray-200 shadow-lg flex items-center justify-center transition-all duration-300 cursor-pointer hover:bg-gray-50 z-50
            ${presetDrawerOpen ? 'right-[-12px] w-6 h-12 rounded-r-lg opacity-100' : 'right-[-24px] w-8 h-16 rounded-r-xl opacity-80 hover:opacity-100'}
          `}
          onMouseEnter={handleDrawerMouseEnter}
          onClick={() => setIsPresetPinned(prev => !prev)}
          title={isPresetPinned ? t('presetSidebar.unpin') : t('presetSidebar.pin')}
        >
          <div className="flex flex-col items-center gap-1 text-gray-400">
            {presetDrawerOpen ? (
              <>
                {isPresetPinned ? <span className="text-[10px]">🔒</span> : <span className="text-[10px]">📌</span>}
              </>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            )}
          </div>
        </button>
      </div>

      {/* 头部 */}
      <header 
        className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0 transition-all duration-300 ease-in-out"
        style={{ paddingLeft: isPresetPinned ? drawerWidth : 0 }}
      >
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {t('header.title')}
              </h1>
              <p className="mt-0.5 text-xs text-gray-600">
                {t('header.subtitle')}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                  👁️ {t('header.badges.viewPure')}
                </div>
                <div className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">
                  ⚠️ {t('header.badges.simulation')}
                </div>
                <div className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                  {t('header.badges.noWallet')}
                </div>
              </div>
              <LanguageSwitcher />
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
      <main 
        className="flex-1 overflow-hidden w-full transition-all duration-300 ease-in-out"
        style={{ paddingLeft: isPresetPinned ? drawerWidth : 0 }}
      >
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-4 h-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
            {/* 内容区域（根据标签显示不同内容） */}
            {activeTab === 'function-call' && (
              <>
                {/* 左列：配置信息 */}
                <div className="flex flex-col space-y-4 overflow-y-auto min-h-0 pr-2 lg:col-span-3">
                  <RpcConfig 
                    onRpcUrlChange={setRpcUrl}
                    onContractAddressChange={setContractAddress}
                    onBlockTagChange={setBlockTag}
                    initialRpcUrl={lastUsed.rpcUrl}
                    initialContractAddress={lastUsed.contractAddress}
                    initialBlockTag={lastUsed.blockTag}
                    externalRpcUrl={rpcUrl}
                    externalContractAddress={contractAddress}
                    selectedAbiNames={selectedAbiNames}
                    functionsCount={functions.length}
                  />

                  {/* 进度提示 */}
                  {(!rpcUrl || !contractAddress) && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800">
                        👆 {t('rpcConfig.selectFromLeft')}
                      </p>
                    </div>
                  )}
                </div>

                {/* 中列：函数列表 */}
                <div className="flex flex-col space-y-4 overflow-y-auto min-h-0 pr-2 lg:col-span-4">
                  {functions.length > 0 && rpcUrl && contractAddress ? (
                    <FunctionList
                      functions={functions}
                      config={{ rpcUrl, contractAddress }}
                      abiString={abiString}
                      onFunctionCall={handleFunctionCall}
                    />
                  ) : rpcUrl && contractAddress && selectedAbis.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-md p-6">
                      <h2 className="text-2xl font-bold mb-4 text-gray-800">{t('functionList.title')}</h2>
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p className="text-sm text-yellow-800">
                          👈 {t('functionList.selectAbi')}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {/* 调用中提示 */}
                  {isCallInProgress && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex-shrink-0">
                      <div className="flex items-center space-x-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        <p className="text-sm text-blue-800">{t('functionList.calling')}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 右列：调用结果 */}
                <div className="flex flex-col overflow-y-auto min-h-0 pr-2 lg:col-span-5">
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
              <div className="lg:col-span-12 min-h-0">
                <TransactionParserPage rpcUrl={rpcUrl} selectedAbis={selectedAbis} selectedAbiNames={selectedAbiNames} mergedAbi={mergedAbi} />
              </div>
            )}

            {activeTab === 'hex-parser' && (
              <div className="lg:col-span-12 min-h-0">
                <HexParserPage mergedAbi={mergedAbi} />
              </div>
            )}

            {activeTab === 'event-query' && (
              <div className="lg:col-span-12 min-h-0">
                <EventQueryPage rpcUrl={rpcUrl} contractAddress={contractAddress} mergedAbi={mergedAbi} selectedAbiNames={selectedAbiNames} selectedAbis={selectedAbis} />
              </div>
            )}

            {activeTab === 'abi-encoder' && (
              <div className="lg:col-span-12 min-h-0">
                <AbiEncoderPage />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 页脚信息 */}
      <footer 
        className="bg-white border-t border-gray-200 py-2 text-center text-xs text-gray-500 flex-shrink-0 transition-all duration-300 ease-in-out"
        style={{ paddingLeft: isPresetPinned ? drawerWidth : 0 }}
      >
        <p>
          {t('footer.text')}
        </p>
      </footer>
    </div>
  );
}

export default App;
