import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import TopNav, { TabId } from './components/layout/TopNav';
import PresetModal from './components/preset/PresetModal';
import ConfigModal from './components/config/ConfigModal';
import FunctionCallPage from './components/functionCall/FunctionCallPage';
import TransactionParserPage from './components/TransactionParserPage';
import HexParserPage from './components/HexParserPage';
import EventQueryPage from './components/EventQueryPage';
import AbiEncoderPage from './components/AbiEncoderPage';
import DebugTracePage from './components/DebugTracePage';
import StateOverridePage from './components/stateOverride/StateOverridePage';
import SlotCalcPage from './components/slotCalc/SlotCalcPage';
import { callViewFunction } from './utils/rpcCaller';
import { parseAbi } from './utils/abiParser';
import { toDisplay } from './utils/decodedFormat';
import { fetchChainId } from './utils/fetchChainId';
import { RpcConfig as RpcConfigType, ParsedFunction, CallHistory } from './types';
import {
  initializeDefaultPresets,
  loadLastUsedConfig,
  saveCallHistory,
  loadCallHistory,
  loadRpcPresets,
  updateRpcPreset,
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
  const [currentChainId, setCurrentChainId] = useState<number | null>(null);

  useEffect(() => {
    initializeDefaultPresets();
  }, []);

  // Restore last-used config once on mount
  useEffect(() => {
    const last = loadLastUsedConfig();
    if (last.rpcUrl) setRpcUrl(last.rpcUrl);
    if (last.contractAddress) setContractAddress(last.contractAddress);
    if (last.blockTag) setBlockTag(last.blockTag);
  }, []);

  useEffect(() => {
    if (selectedAbis.length === 0) {
      setMergedAbi('');
      setFunctions([]);
      setAbiString('');
      return;
    }
    try {
      const abiArrays = selectedAbis.map((abiStr, i) => {
        try { return { abi: JSON.parse(abiStr), name: selectedAbiNames[i] ?? '' }; }
        catch { return { abi: [], name: selectedAbiNames[i] ?? '' }; }
      });
      const merged = abiArrays.flatMap((x) => x.abi);
      const mergedStr = JSON.stringify(merged);
      setMergedAbi(mergedStr);
      const parsedFunctions = abiArrays.flatMap(({ abi, name }) =>
        parseAbi(abi, true).map((fn) => ({ ...fn, abiName: name })),
      );
      setFunctions(parsedFunctions);
      setAbiString(mergedStr);
    } catch (error) {
      console.error('合并 ABI 失败:', error);
      setMergedAbi('');
      setFunctions([]);
      setAbiString('');
    }
  }, [selectedAbis, selectedAbiNames]);

  useEffect(() => { saveCallHistory(callHistory); }, [callHistory]);

  // Derive chainId from rpcUrl (backfill on first select of an RPC preset).
  useEffect(() => {
    const trimmed = rpcUrl.trim();
    if (!trimmed) { setCurrentChainId(null); return; }

    const presets = loadRpcPresets();
    const preset = presets.find((p) => p.rpcUrl === trimmed);
    if (preset?.chainId) { setCurrentChainId(preset.chainId); return; }

    if (!preset) { setCurrentChainId(null); return; }

    const controller = new AbortController();
    fetchChainId(trimmed, controller.signal)
      .then((cid) => {
        if (controller.signal.aborted) return;
        updateRpcPreset(preset.id, { chainId: cid });
        setCurrentChainId(cid);
      })
      .catch(() => { /* silent: leaves null */ });
    return () => controller.abort();
  }, [rpcUrl, presetRefreshTrigger]);

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
        config, abiString, functionName, args, func.stateMutability
      );
      const formatted = result.success
        ? { success: true, data: toDisplay(result.data, func.outputs) }
        : result;
      const rpcPresets = loadRpcPresets();
      const currentRpcPreset = rpcPresets.find((p) => p.rpcUrl === rpcUrl.trim());
      setCallHistory((prev) => [
        {
          id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          functionName, args, result: formatted, timestamp: Date.now(),
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

  const tabs = [
    { id: 'function-call' as TabId, label: t('tabs.functionCall') },
    { id: 'transaction-parser' as TabId, label: t('tabs.transactionParser') },
    { id: 'debug-trace' as TabId, label: t('tabs.debugTrace') },
    { id: 'hex-parser' as TabId, label: t('tabs.hexParser') },
    { id: 'event-query' as TabId, label: t('tabs.eventQuery') },
    { id: 'abi-encoder' as TabId, label: t('tabs.abiEncoder') },
    { id: 'state-override' as TabId, label: t('tabs.stateOverride') },
    { id: 'slot-calc' as TabId, label: t('tabs.slotCalc') },
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
          <FunctionCallPage
            rpcUrl={rpcUrl}
            contractAddress={contractAddress}
            blockTag={blockTag}
            onRpcUrlChange={setRpcUrl}
            onContractAddressChange={setContractAddress}
            onBlockTagChange={setBlockTag}
            onPresetsClick={() => setIsPresetModalOpen(true)}
            functions={functions}
            selectedAbis={selectedAbis}
            selectedAbiNames={selectedAbiNames}
            onAbisChange={(abis, names) => { setSelectedAbis(abis); setSelectedAbiNames(names); }}
            callHistory={callHistory}
            onFunctionCall={handleFunctionCall}
            onDeleteResult={handleDeleteResult}
            onClearAll={handleClearAllResults}
            isCallInProgress={isCallInProgress}
            currentChainId={currentChainId}
            presetRefreshTrigger={presetRefreshTrigger}
            showAddressNames={showAddressNames}
          />
        )}
        {activeTab === 'transaction-parser' && (
          <TransactionParserPage
            rpcUrl={rpcUrl}
            onRpcUrlChange={setRpcUrl}
            selectedAbis={selectedAbis}
            selectedAbiNames={selectedAbiNames}
            mergedAbi={mergedAbi}
            currentChainId={currentChainId}
            presetRefreshTrigger={presetRefreshTrigger}
            showAddressNames={showAddressNames}
          />
        )}
        {activeTab === 'debug-trace' && (
          <DebugTracePage
            rpcUrl={rpcUrl}
            onRpcUrlChange={setRpcUrl}
            selectedAbis={selectedAbis}
            showAddressNames={showAddressNames}
            presetRefreshTrigger={presetRefreshTrigger}
            currentChainId={currentChainId}
          />
        )}
        {activeTab === 'hex-parser' && (
          <HexParserPage
            mergedAbi={mergedAbi}
            selectedAbis={selectedAbis}
            selectedAbiNames={selectedAbiNames}
            currentChainId={currentChainId}
            presetRefreshTrigger={presetRefreshTrigger}
            showAddressNames={showAddressNames}
          />
        )}
        {activeTab === 'event-query' && (
          <EventQueryPage
            rpcUrl={rpcUrl}
            contractAddress={contractAddress}
            onContractAddressChange={setContractAddress}
            mergedAbi={mergedAbi}
            selectedAbiNames={selectedAbiNames}
            selectedAbis={selectedAbis}
            currentChainId={currentChainId}
            presetRefreshTrigger={presetRefreshTrigger}
            showAddressNames={showAddressNames}
          />
        )}
        {activeTab === 'abi-encoder' && <AbiEncoderPage />}
        {activeTab === 'state-override' && (
          <StateOverridePage
            rpcUrl={rpcUrl}
            mergedAbi={mergedAbi}
            showAddressNames={showAddressNames}
            presetRefreshTrigger={presetRefreshTrigger}
            currentChainId={currentChainId}
          />
        )}
        {activeTab === 'slot-calc' && <SlotCalcPage rpcUrl={rpcUrl} />}
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

      <ConfigModal
        open={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onImportComplete={() => window.location.reload()}
      />
    </div>
  );
}

export default App;
