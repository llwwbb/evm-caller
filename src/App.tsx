import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import TopNav, { TabId } from './components/layout/TopNav';
import PresetModal from './components/preset/PresetModal';
import ConfigManager from './components/ConfigManager';
import RpcConfig from './components/RpcConfig';
import FunctionList from './components/FunctionList';
import ResultDisplay from './components/ResultDisplay';
import TransactionParserPage from './components/TransactionParserPage';
import HexParserPage from './components/HexParserPage';
import EventQueryPage from './components/EventQueryPage';
import AbiEncoderPage from './components/AbiEncoderPage';
import DebugTracePage from './components/DebugTracePage';
import { callViewFunction } from './utils/rpcCaller';
import { parseAbi } from './utils/abiParser';
import { RpcConfig as RpcConfigType, ParsedFunction, CallHistory } from './types';
import {
  initializeDefaultPresets,
  loadLastUsedConfig,
  saveCallHistory,
  loadCallHistory,
  loadRpcPresets,
} from './utils/presetStorage';

function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('function-call');
  const [rpcUrl, setRpcUrl] = useState('');
  const [contractAddress, setContractAddress] = useState('');
  const [blockTag, setBlockTag] = useState('latest');
  const [functions, setFunctions] = useState<ParsedFunction[]>([]);
  const [abiString, setAbiString] = useState('');
  const [callHistory, setCallHistory] = useState<CallHistory[]>(() => loadCallHistory());
  const [isCallInProgress, setIsCallInProgress] = useState(false);
  const [selectedAbis, setSelectedAbis] = useState<string[]>([]);
  const [selectedAbiNames, setSelectedAbiNames] = useState<string[]>([]);
  const [mergedAbi, setMergedAbi] = useState<string>('');
  const [presetRefreshTrigger, setPresetRefreshTrigger] = useState(0);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [showAddressNames, setShowAddressNames] = useState(true);

  const [lastUsed] = useState(() => loadLastUsedConfig());

  useEffect(() => {
    initializeDefaultPresets();
  }, []);

  useEffect(() => {
    if (selectedAbis.length === 0) {
      setMergedAbi('');
      if (activeTab === 'function-call') {
        setFunctions([]);
        setAbiString('');
      }
      return;
    }
    try {
      const abiArrays = selectedAbis.map((abiStr) => {
        try { return JSON.parse(abiStr); } catch { return []; }
      });
      const merged = abiArrays.flat();
      const mergedStr = JSON.stringify(merged);
      setMergedAbi(mergedStr);
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
      if (activeTab === 'function-call') { setFunctions([]); setAbiString(''); }
    }
  }, [selectedAbis, activeTab]);

  useEffect(() => { saveCallHistory(callHistory); }, [callHistory]);

  const handleFunctionCall = async (functionName: string, args: any[], func: ParsedFunction) => {
    if (!rpcUrl.trim()) { alert(t('alert.enterRpcUrl')); return; }
    if (!contractAddress.trim()) { alert(t('alert.enterContractAddress')); return; }
    setIsCallInProgress(true);
    try {
      const config: RpcConfigType = {
        rpcUrl: rpcUrl.trim(),
        contractAddress: contractAddress.trim(),
        blockTag: blockTag.trim() || 'latest',
      };
      const result = await callViewFunction(
        config, abiString, functionName, args, func.outputs, func.stateMutability
      );
      const rpcPresets = loadRpcPresets();
      const currentRpcPreset = rpcPresets.find((p) => p.rpcUrl === rpcUrl.trim());
      setCallHistory((prev) => [
        {
          id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          functionName, args, result, timestamp: Date.now(),
          blockTag: config.blockTag, rpcName: currentRpcPreset?.name,
        },
        ...prev,
      ]);
    } catch (error) {
      console.error('调用过程出错:', error);
    } finally {
      setIsCallInProgress(false);
    }
  };

  const handleClearAllResults = () => {
    if (window.confirm(t('result.confirmClearAll'))) setCallHistory([]);
  };
  const handleDeleteResult = (id: string) => {
    setCallHistory((prev) => prev.filter((item) => item.id !== id));
  };

  // NOTE: state-override tab is temporarily omitted — its page component is on
  // a stash (pre-refactor WIP). Task 3.6 of the UI refactor plan will add it
  // back in the new design system.
  const tabs = [
    { id: 'function-call' as TabId, label: t('tabs.functionCall') },
    { id: 'transaction-parser' as TabId, label: t('tabs.transactionParser') },
    { id: 'debug-trace' as TabId, label: t('tabs.debugTrace') },
    { id: 'hex-parser' as TabId, label: t('tabs.hexParser') },
    { id: 'event-query' as TabId, label: t('tabs.eventQuery') },
    { id: 'abi-encoder' as TabId, label: t('tabs.abiEncoder') },
  ];

  return (
    <div className="flex h-screen flex-col bg-bg text-fg">
      <TopNav
        activeTab={activeTab}
        tabs={tabs}
        onTabChange={setActiveTab}
        onPresetsClick={() => setIsPresetModalOpen(true)}
        onConfigClick={() => setIsConfigModalOpen(true)}
        showAddressNames={showAddressNames}
        onToggleAddressNames={() => setShowAddressNames((v) => !v)}
      />

      <main className="flex-1 min-h-0 overflow-hidden">
        {/* Phase 1: keep existing tab contents verbatim — they look clashy on the
            dark shell but work; Phases 2/3 rewrite each page in the new design system. */}
        {activeTab === 'function-call' && (
          <div className="grid grid-cols-1 gap-4 h-full p-4 lg:grid-cols-12">
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
            </div>
            <div className="flex flex-col space-y-4 overflow-y-auto min-h-0 pr-2 lg:col-span-4">
              {functions.length > 0 && rpcUrl && contractAddress && (
                <FunctionList
                  functions={functions}
                  config={{ rpcUrl, contractAddress }}
                  abiString={abiString}
                  onFunctionCall={handleFunctionCall}
                />
              )}
              {isCallInProgress && (
                <div className="rounded border border-line bg-surface p-4">
                  <p className="text-sm">{t('functionList.calling')}</p>
                </div>
              )}
            </div>
            <div className="flex flex-col overflow-y-auto min-h-0 pr-2 lg:col-span-5">
              <ResultDisplay
                results={callHistory}
                onClearAll={handleClearAllResults}
                onDeleteResult={handleDeleteResult}
              />
            </div>
          </div>
        )}
        {activeTab === 'transaction-parser' && (
          <TransactionParserPage
            rpcUrl={rpcUrl}
            selectedAbis={selectedAbis}
            selectedAbiNames={selectedAbiNames}
            mergedAbi={mergedAbi}
          />
        )}
        {activeTab === 'debug-trace' && (
          <DebugTracePage
            rpcUrl={rpcUrl}
            selectedAbis={selectedAbis}
            presetRefreshTrigger={presetRefreshTrigger}
          />
        )}
        {activeTab === 'hex-parser' && <HexParserPage mergedAbi={mergedAbi} />}
        {activeTab === 'event-query' && (
          <EventQueryPage
            rpcUrl={rpcUrl}
            contractAddress={contractAddress}
            mergedAbi={mergedAbi}
            selectedAbiNames={selectedAbiNames}
            selectedAbis={selectedAbis}
          />
        )}
        {activeTab === 'abi-encoder' && <AbiEncoderPage />}
      </main>

      <PresetModal
        open={isPresetModalOpen}
        onClose={() => setIsPresetModalOpen(false)}
        currentRpcUrl={rpcUrl}
        currentContractAddress={contractAddress}
        currentAbis={selectedAbis}
        onRpcUrlChange={setRpcUrl}
        onContractAddressChange={setContractAddress}
        onAbisChange={(abis, names) => {
          setSelectedAbis(abis);
          setSelectedAbiNames(names);
        }}
        refreshToken={presetRefreshTrigger}
        onRefreshPresets={() => setPresetRefreshTrigger((v) => v + 1)}
      />

      {isConfigModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setIsConfigModalOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <ConfigManager onImportComplete={() => window.location.reload()} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
