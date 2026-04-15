import { RpcPreset, ContractPreset, ContractEntry, AbiPreset, LastUsedConfig, CallHistory, TypeDefPreset, AbiEncoderHistory, HexParserHistory, StateOverridePreset } from '../types';

// localStorage 键名常量
const STORAGE_KEYS = {
  RPC_PRESETS: 'evm-caller:rpc-presets',
  CONTRACT_PRESETS: 'evm-caller:contract-presets',
  ABI_PRESETS: 'evm-caller:abi-presets',
  LAST_RPC_URL: 'evm-caller:last-rpc-url',
  LAST_CONTRACT_ADDRESS: 'evm-caller:last-contract-address',
  LAST_ABI: 'evm-caller:last-abi',
  LAST_BLOCK_TAG: 'evm-caller:last-block-tag',
  CALL_HISTORY: 'evm-caller:call-history',
  TX_PARSER_RESULT: 'evm-caller:tx-parser-result',
  HEX_PARSER_RESULT: 'evm-caller:hex-parser-result',
  HEX_PARSER_HISTORY: 'evm-caller:hex-parser-history',
  EVENT_QUERY_RESULTS: 'evm-caller:event-query-results',
  TYPE_DEF_PRESETS: 'evm-caller:type-def-presets',
  ABI_ENCODER_HISTORY: 'evm-caller:abi-encoder-history',
  DEBUG_TRACE_RESULT: 'evm-caller:debug-trace-result',
  STATE_OVERRIDE_PRESETS: 'evm-caller:state-override-presets',
  CONTRACT_PRESET_VERSION: 'evm-caller:contract-preset-version',
};

// 生成唯一 ID
function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ==================== RPC 预设 ====================

export function loadRpcPresets(): RpcPreset[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.RPC_PRESETS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('加载 RPC 预设失败:', error);
    return [];
  }
}

export function saveRpcPreset(name: string, rpcUrl: string, chainId?: number): RpcPreset {
  const presets = loadRpcPresets();
  const newPreset: RpcPreset = {
    id: generateId(),
    name,
    rpcUrl,
    chainId,
    createdAt: Date.now(),
  };
  
  presets.unshift(newPreset); // 最新的在前面
  localStorage.setItem(STORAGE_KEYS.RPC_PRESETS, JSON.stringify(presets));
  return newPreset;
}

export function updateRpcPreset(id: string, updates: Partial<Omit<RpcPreset, 'id' | 'createdAt'>>): boolean {
  const presets = loadRpcPresets();
  const index = presets.findIndex(p => p.id === id);
  
  if (index === -1) return false;
  
  presets[index] = { ...presets[index], ...updates };
  localStorage.setItem(STORAGE_KEYS.RPC_PRESETS, JSON.stringify(presets));
  return true;
}

export function deleteRpcPreset(id: string): boolean {
  const presets = loadRpcPresets();
  const filtered = presets.filter(p => p.id !== id);
  
  if (filtered.length === presets.length) return false;
  
  localStorage.setItem(STORAGE_KEYS.RPC_PRESETS, JSON.stringify(filtered));
  return true;
}

// ==================== 合约地址预设 ====================

type LegacyContractPreset = {
  id: string;
  name: string;
  address: string;
  description?: string;
  createdAt: number;
};

function isLegacyContractPreset(v: any): v is LegacyContractPreset {
  return v && typeof v.address === 'string' && !Array.isArray(v.entries);
}

export function migrateContractPresets(): void {
  const version = localStorage.getItem(STORAGE_KEYS.CONTRACT_PRESET_VERSION);
  if (version === '2') return;

  const raw = localStorage.getItem(STORAGE_KEYS.CONTRACT_PRESETS);
  if (!raw) {
    localStorage.setItem(STORAGE_KEYS.CONTRACT_PRESET_VERSION, '2');
    return;
  }

  try {
    const records: unknown[] = JSON.parse(raw);
    if (!Array.isArray(records)) {
      localStorage.setItem(STORAGE_KEYS.CONTRACT_PRESET_VERSION, '2');
      return;
    }

    const byName = new Map<string, ContractPreset>();
    const passThrough: ContractPreset[] = [];

    for (const r of records) {
      if (isLegacyContractPreset(r)) {
        const existing = byName.get(r.name);
        if (existing) {
          existing.entries.push({ address: r.address });
        } else {
          byName.set(r.name, {
            id: r.id,
            name: r.name,
            description: r.description,
            entries: [{ address: r.address }],
            createdAt: r.createdAt,
          });
        }
      } else if (r && typeof (r as any).name === 'string' && Array.isArray((r as any).entries)) {
        passThrough.push(r as ContractPreset);
      }
    }

    const migrated = [...Array.from(byName.values()), ...passThrough];
    localStorage.setItem(STORAGE_KEYS.CONTRACT_PRESETS, JSON.stringify(migrated));
    localStorage.setItem(STORAGE_KEYS.CONTRACT_PRESET_VERSION, '2');
  } catch (error) {
    console.error('迁移 contract-presets 失败:', error);
  }
}

export function loadContractPresets(): ContractPreset[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CONTRACT_PRESETS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('加载合约预设失败:', error);
    return [];
  }
}

export function saveContractPreset(name: string, entries: ContractEntry[], description?: string): ContractPreset {
  const presets = loadContractPresets();
  const newPreset: ContractPreset = {
    id: generateId(),
    name,
    description,
    entries: entries.length > 0 ? entries : [{ address: '' }],
    createdAt: Date.now(),
  };

  presets.unshift(newPreset);
  localStorage.setItem(STORAGE_KEYS.CONTRACT_PRESETS, JSON.stringify(presets));
  return newPreset;
}

export function updateContractPreset(
  id: string,
  updates: Partial<Pick<ContractPreset, 'name' | 'description' | 'entries'>>,
): boolean {
  const presets = loadContractPresets();
  const index = presets.findIndex(p => p.id === id);

  if (index === -1) return false;

  presets[index] = { ...presets[index], ...updates };
  localStorage.setItem(STORAGE_KEYS.CONTRACT_PRESETS, JSON.stringify(presets));
  return true;
}

export function deleteContractPreset(id: string): boolean {
  const presets = loadContractPresets();
  const filtered = presets.filter(p => p.id !== id);

  if (filtered.length === presets.length) return false;

  localStorage.setItem(STORAGE_KEYS.CONTRACT_PRESETS, JSON.stringify(filtered));
  return true;
}

export function findContractByAddress(
  address: string,
  chainId?: number,
): { preset: ContractPreset; entry: ContractEntry } | null {
  const lowered = address.toLowerCase();
  const presets = loadContractPresets();
  for (const preset of presets) {
    for (const entry of preset.entries) {
      if (entry.address.toLowerCase() !== lowered) continue;
      if (chainId != null && entry.chainId === chainId) return { preset, entry };
    }
  }
  for (const preset of presets) {
    for (const entry of preset.entries) {
      if (entry.address.toLowerCase() === lowered) return { preset, entry };
    }
  }
  return null;
}

// ==================== ABI 预设 ====================

export function loadAbiPresets(): AbiPreset[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ABI_PRESETS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('加载 ABI 预设失败:', error);
    return [];
  }
}

export function saveAbiPreset(name: string, abi: string): AbiPreset {
  const presets = loadAbiPresets();
  const newPreset: AbiPreset = {
    id: generateId(),
    name,
    abi,
    createdAt: Date.now(),
  };
  
  presets.unshift(newPreset);
  localStorage.setItem(STORAGE_KEYS.ABI_PRESETS, JSON.stringify(presets));
  return newPreset;
}

export function updateAbiPreset(id: string, updates: Partial<Omit<AbiPreset, 'id' | 'createdAt'>>): boolean {
  const presets = loadAbiPresets();
  const index = presets.findIndex(p => p.id === id);
  
  if (index === -1) return false;
  
  presets[index] = { ...presets[index], ...updates };
  localStorage.setItem(STORAGE_KEYS.ABI_PRESETS, JSON.stringify(presets));
  return true;
}

export function deleteAbiPreset(id: string): boolean {
  const presets = loadAbiPresets();
  const filtered = presets.filter(p => p.id !== id);
  
  if (filtered.length === presets.length) return false;
  
  localStorage.setItem(STORAGE_KEYS.ABI_PRESETS, JSON.stringify(filtered));
  return true;
}

// ==================== 最后使用的配置 ====================

export function saveLastRpcUrl(rpcUrl: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_RPC_URL, rpcUrl);
  } catch (error) {
    console.error('保存最后使用的 RPC URL 失败:', error);
  }
}

export function loadLastRpcUrl(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.LAST_RPC_URL);
  } catch (error) {
    console.error('加载最后使用的 RPC URL 失败:', error);
    return null;
  }
}

export function saveLastContractAddress(address: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_CONTRACT_ADDRESS, address);
  } catch (error) {
    console.error('保存最后使用的合约地址失败:', error);
  }
}

export function loadLastContractAddress(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.LAST_CONTRACT_ADDRESS);
  } catch (error) {
    console.error('加载最后使用的合约地址失败:', error);
    return null;
  }
}

export function saveLastAbi(abi: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_ABI, abi);
  } catch (error) {
    console.error('保存最后使用的 ABI 失败:', error);
  }
}

export function loadLastAbi(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.LAST_ABI);
  } catch (error) {
    console.error('加载最后使用的 ABI 失败:', error);
    return null;
  }
}

export function saveLastBlockTag(blockTag: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_BLOCK_TAG, blockTag);
  } catch (error) {
    console.error('保存最后使用的区块标识失败:', error);
  }
}

export function loadLastBlockTag(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.LAST_BLOCK_TAG);
  } catch (error) {
    console.error('加载最后使用的区块标识失败:', error);
    return null;
  }
}

export function loadLastUsedConfig(): LastUsedConfig {
  return {
    rpcUrl: loadLastRpcUrl() || undefined,
    contractAddress: loadLastContractAddress() || undefined,
    abi: loadLastAbi() || undefined,
    blockTag: loadLastBlockTag() || undefined,
  };
}

// ==================== 初始化默认预设 ====================

export function initializeDefaultPresets(): void {
  migrateContractPresets();

  const hasRpcPresets = loadRpcPresets().length > 0;
  const hasAbiPresets = loadAbiPresets().length > 0;
  const hasContractPresets = loadContractPresets().length > 0;

  if (!hasRpcPresets) {
    saveRpcPreset('Ethereum 主网', 'https://eth.llamarpc.com', 1);
    saveRpcPreset('BSC 主网', 'https://bsc-dataseed.binance.org', 56);
    saveRpcPreset('Polygon 主网', 'https://polygon-rpc.com', 137);
  }

  if (!hasAbiPresets) {
    const erc20Abi = JSON.stringify([
      {
        "name": "name",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"type": "string", "name": ""}]
      },
      {
        "name": "symbol",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"type": "string", "name": ""}]
      },
      {
        "name": "decimals",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"type": "uint8", "name": ""}]
      },
      {
        "name": "totalSupply",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"type": "uint256", "name": ""}]
      },
      {
        "name": "balanceOf",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"type": "address", "name": "account"}],
        "outputs": [{"type": "uint256", "name": ""}]
      }
    ], null, 2);

    saveAbiPreset('ERC20 标准接口', erc20Abi);
  }

  if (!hasContractPresets) {
    saveContractPreset('USDC', [
      { chainId: 1, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
      { chainId: 137, address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' },
      { chainId: 42161, address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
    ], 'USD Coin');
  }
}

// ==================== 导入/导出配置 ====================

export interface ExportedConfig {
  version: string;
  exportedAt: number;
  rpcPresets: RpcPreset[];
  contractPresets: ContractPreset[];
  abiPresets: AbiPreset[];
}

/**
 * 导出所有预设配置为 JSON 对象
 */
export function exportAllPresets(): ExportedConfig {
  return {
    version: '1.0.0',
    exportedAt: Date.now(),
    rpcPresets: loadRpcPresets(),
    contractPresets: loadContractPresets(),
    abiPresets: loadAbiPresets(),
  };
}

/**
 * 导出所有预设配置并下载为 JSON 文件
 */
export function downloadPresetsAsJson(): void {
  const config = exportAllPresets();
  const json = JSON.stringify(config, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `evm-caller-config-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 从 JSON 对象导入预设配置
 * @param config - 导入的配置对象
 * @param mode - 导入模式：'merge' 合并（保留现有）, 'replace' 替换（清空现有）
 */
export function importPresets(config: ExportedConfig, mode: 'merge' | 'replace' = 'merge'): {
  success: boolean;
  message: string;
  imported: {
    rpc: number;
    contract: number;
    abi: number;
  };
} {
  try {
    // 验证配置格式
    if (!config || typeof config !== 'object') {
      return {
        success: false,
        message: '配置格式无效',
        imported: { rpc: 0, contract: 0, abi: 0 },
      };
    }

    const { rpcPresets = [], contractPresets = [], abiPresets = [] } = config;

    // 根据模式处理数据
    if (mode === 'replace') {
      // 替换模式：清空现有数据
      localStorage.setItem(STORAGE_KEYS.RPC_PRESETS, JSON.stringify(rpcPresets));
      localStorage.setItem(STORAGE_KEYS.CONTRACT_PRESETS, JSON.stringify(contractPresets));
      localStorage.setItem(STORAGE_KEYS.ABI_PRESETS, JSON.stringify(abiPresets));
    } else {
      // 合并模式：保留现有数据，添加新数据（避免重复）
      const existingRpc = loadRpcPresets();
      const existingContract = loadContractPresets();
      const existingAbi = loadAbiPresets();

      // 合并 RPC 预设（根据 rpcUrl 去重）
      const existingRpcUrls = new Set(existingRpc.map(p => p.rpcUrl));
      const newRpcPresets = rpcPresets.filter(p => !existingRpcUrls.has(p.rpcUrl));
      const mergedRpc = [...existingRpc, ...newRpcPresets];
      localStorage.setItem(STORAGE_KEYS.RPC_PRESETS, JSON.stringify(mergedRpc));

      // 合并合约预设（按 name 去重；新条目完全替换同名旧条目）
      const existingNames = new Set(existingContract.map(p => p.name));
      const newContractPresets = contractPresets.filter((p) => !existingNames.has(p.name));
      const mergedContract = [...existingContract, ...newContractPresets];
      localStorage.setItem(STORAGE_KEYS.CONTRACT_PRESETS, JSON.stringify(mergedContract));

      // 合并 ABI 预设（根据名称去重）
      const existingAbiNames = new Set(existingAbi.map(p => p.name));
      const newAbiPresets = abiPresets.filter(p => !existingAbiNames.has(p.name));
      const mergedAbi = [...existingAbi, ...newAbiPresets];
      localStorage.setItem(STORAGE_KEYS.ABI_PRESETS, JSON.stringify(mergedAbi));
    }

    return {
      success: true,
      message: `成功导入配置 (${mode === 'replace' ? '替换' : '合并'}模式)`,
      imported: {
        rpc: rpcPresets.length,
        contract: contractPresets.length,
        abi: abiPresets.length,
      },
    };
  } catch (error) {
    console.error('导入配置失败:', error);
    return {
      success: false,
      message: `导入失败: ${error instanceof Error ? error.message : '未知错误'}`,
      imported: { rpc: 0, contract: 0, abi: 0 },
    };
  }
}

/**
 * 从文件导入预设配置
 * @param file - JSON 文件
 * @param mode - 导入模式
 */
export async function importPresetsFromFile(
  file: File,
  mode: 'merge' | 'replace' = 'merge'
): Promise<{
  success: boolean;
  message: string;
  imported: { rpc: number; contract: number; abi: number };
}> {
  try {
    const text = await file.text();
    const config: ExportedConfig = JSON.parse(text);
    return importPresets(config, mode);
  } catch (error) {
    console.error('读取文件失败:', error);
    return {
      success: false,
      message: `文件读取失败: ${error instanceof Error ? error.message : '未知错误'}`,
      imported: { rpc: 0, contract: 0, abi: 0 },
    };
  }
}

// ==================== 调用历史 ====================

/**
 * 保存调用历史
 * @param history - 调用历史数组
 */
export function saveCallHistory(history: CallHistory[]): void {
  try {
    // 序列化时处理 BigInt
    const json = JSON.stringify(history, (_key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    });
    localStorage.setItem(STORAGE_KEYS.CALL_HISTORY, json);
  } catch (error) {
    console.error('保存调用历史失败:', error);
  }
}

/**
 * 加载调用历史
 * @returns 调用历史数组
 */
export function loadCallHistory(): CallHistory[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CALL_HISTORY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('加载调用历史失败:', error);
    return [];
  }
}

/**
 * 清空调用历史
 */
export function clearCallHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.CALL_HISTORY);
  } catch (error) {
    console.error('清空调用历史失败:', error);
  }
}

// ==================== Parser 结果持久化 ====================

/**
 * 保存交易解析结果
 */
export function saveTxParserResult(result: any): void {
  try {
    const json = JSON.stringify(result, (_key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    });
    localStorage.setItem(STORAGE_KEYS.TX_PARSER_RESULT, json);
  } catch (error) {
    console.error('保存交易解析结果失败:', error);
  }
}

/**
 * 加载交易解析结果
 */
export function loadTxParserResult(): any | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TX_PARSER_RESULT);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('加载交易解析结果失败:', error);
    return null;
  }
}

/**
 * 保存 Hex 解析结果
 */
export function saveHexParserResult(result: any): void {
  try {
    const json = JSON.stringify(result, (_key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    });
    localStorage.setItem(STORAGE_KEYS.HEX_PARSER_RESULT, json);
  } catch (error) {
    console.error('保存 Hex 解析结果失败:', error);
  }
}

/**
 * 加载 Hex 解析结果
 */
export function loadHexParserResult(): any | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.HEX_PARSER_RESULT);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('加载 Hex 解析结果失败:', error);
    return null;
  }
}

/**
 * 保存 Event 查询结果
 */
export function saveEventQueryResults(results: any[]): void {
  try {
    const json = JSON.stringify(results, (_key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    });
    localStorage.setItem(STORAGE_KEYS.EVENT_QUERY_RESULTS, json);
  } catch (error) {
    console.error('保存 Event 查询结果失败:', error);
  }
}

/**
 * 加载 Event 查询结果
 */
export function loadEventQueryResults(): any[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.EVENT_QUERY_RESULTS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('加载 Event 查询结果失败:', error);
    return [];
  }
}

// ==================== 类型定义预设 ====================

/**
 * 加载类型定义预设
 */
export function loadTypeDefPresets(): TypeDefPreset[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TYPE_DEF_PRESETS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('加载类型定义预设失败:', error);
    return [];
  }
}

/**
 * 保存类型定义预设
 */
export function saveTypeDefPreset(name: string, types: string[]): TypeDefPreset {
  const presets = loadTypeDefPresets();
  const newPreset: TypeDefPreset = {
    id: generateId(),
    name,
    types,
    createdAt: Date.now(),
  };
  
  presets.unshift(newPreset);
  localStorage.setItem(STORAGE_KEYS.TYPE_DEF_PRESETS, JSON.stringify(presets));
  return newPreset;
}

/**
 * 更新类型定义预设
 */
export function updateTypeDefPreset(id: string, updates: Partial<Omit<TypeDefPreset, 'id' | 'createdAt'>>): boolean {
  const presets = loadTypeDefPresets();
  const index = presets.findIndex(p => p.id === id);
  
  if (index === -1) return false;
  
  presets[index] = { ...presets[index], ...updates };
  localStorage.setItem(STORAGE_KEYS.TYPE_DEF_PRESETS, JSON.stringify(presets));
  return true;
}

/**
 * 删除类型定义预设
 */
export function deleteTypeDefPreset(id: string): boolean {
  const presets = loadTypeDefPresets();
  const filtered = presets.filter(p => p.id !== id);
  
  if (filtered.length === presets.length) return false;
  
  localStorage.setItem(STORAGE_KEYS.TYPE_DEF_PRESETS, JSON.stringify(filtered));
  return true;
}

// ==================== ABI 编码器历史记录 ====================

const MAX_ENCODER_HISTORY = 50; // 最多保留 50 条历史记录

/**
 * 加载 ABI 编码器历史记录
 */
export function loadAbiEncoderHistory(): AbiEncoderHistory[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ABI_ENCODER_HISTORY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('加载 ABI 编码器历史记录失败:', error);
    return [];
  }
}

/**
 * 保存 ABI 编码器历史记录（添加一条）
 */
export function addAbiEncoderHistory(history: Omit<AbiEncoderHistory, 'id' | 'timestamp'>): AbiEncoderHistory {
  const histories = loadAbiEncoderHistory();
  const newHistory: AbiEncoderHistory = {
    ...history,
    id: generateId(),
    timestamp: Date.now(),
  };
  
  histories.unshift(newHistory);
  
  // 限制历史记录数量
  const trimmed = histories.slice(0, MAX_ENCODER_HISTORY);
  
  localStorage.setItem(STORAGE_KEYS.ABI_ENCODER_HISTORY, JSON.stringify(trimmed));
  return newHistory;
}

/**
 * 删除单条 ABI 编码器历史记录
 */
export function deleteAbiEncoderHistory(id: string): boolean {
  const histories = loadAbiEncoderHistory();
  const filtered = histories.filter(h => h.id !== id);
  
  if (filtered.length === histories.length) return false;
  
  localStorage.setItem(STORAGE_KEYS.ABI_ENCODER_HISTORY, JSON.stringify(filtered));
  return true;
}

/**
 * 清空 ABI 编码器历史记录
 */
export function clearAbiEncoderHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.ABI_ENCODER_HISTORY);
  } catch (error) {
    console.error('清空 ABI 编码器历史记录失败:', error);
  }
}

// ==================== Debug Trace 结果持久化 ====================

export interface DebugTraceState {
  txHash: string;
  rawTrace: any; // CallTrace
  parsedTrace: any; // ParsedCallTrace
  expandedNodes: string[]; // Set 转换为数组
  showAddressNames?: boolean; // deprecated: now a global preference in App.tsx
  // Pin-stack state (new):
  selectedPath?: string | null;
  pinnedPaths?: string[];
  collapsedPaths?: string[];
}

/**
 * 保存 Debug Trace 结果
 */
export function saveDebugTraceResult(state: DebugTraceState): void {
  try {
    const json = JSON.stringify(state, (_key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    });
    localStorage.setItem(STORAGE_KEYS.DEBUG_TRACE_RESULT, json);
  } catch (error) {
    console.error('保存 Debug Trace 结果失败:', error);
  }
}

/**
 * 加载 Debug Trace 结果
 */
export function loadDebugTraceResult(): DebugTraceState | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.DEBUG_TRACE_RESULT);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('加载 Debug Trace 结果失败:', error);
    return null;
  }
}

/**
 * 清空 Debug Trace 结果
 */
export function clearDebugTraceResult(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.DEBUG_TRACE_RESULT);
  } catch (error) {
    console.error('清空 Debug Trace 结果失败:', error);
  }
}

// ==================== Hex 解析器历史记录 ====================

const MAX_HEX_PARSER_HISTORY = 50; // 最多保留 50 条历史记录

/**
 * 加载 Hex 解析器历史记录
 */
export function loadHexParserHistory(): HexParserHistory[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.HEX_PARSER_HISTORY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('加载 Hex 解析器历史记录失败:', error);
    return [];
  }
}

/**
 * 保存 Hex 解析器历史记录（添加一条）
 */
export function addHexParserHistory(history: Omit<HexParserHistory, 'id' | 'timestamp'>): HexParserHistory {
  const histories = loadHexParserHistory();
  const newHistory: HexParserHistory = {
    ...history,
    id: generateId(),
    timestamp: Date.now(),
  };
  
  histories.unshift(newHistory);
  
  // 限制历史记录数量
  const trimmed = histories.slice(0, MAX_HEX_PARSER_HISTORY);
  
  localStorage.setItem(STORAGE_KEYS.HEX_PARSER_HISTORY, JSON.stringify(trimmed));
  return newHistory;
}

/**
 * 删除单条 Hex 解析器历史记录
 */
export function deleteHexParserHistory(id: string): boolean {
  const histories = loadHexParserHistory();
  const filtered = histories.filter(h => h.id !== id);
  
  if (filtered.length === histories.length) return false;
  
  localStorage.setItem(STORAGE_KEYS.HEX_PARSER_HISTORY, JSON.stringify(filtered));
  return true;
}

/**
 * 清空 Hex 解析器历史记录
 */
export function clearHexParserHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.HEX_PARSER_HISTORY);
  } catch (error) {
    console.error('清空 Hex 解析器历史记录失败:', error);
  }
}


// ==================== 状态覆盖预设 ====================

export function loadStateOverridePresets(): StateOverridePreset[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.STATE_OVERRIDE_PRESETS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('加载状态覆盖预设失败:', error);
    return [];
  }
}

export function saveStateOverridePreset(
  name: string,
  accounts: StateOverridePreset['accounts'],
  description?: string
): StateOverridePreset {
  const presets = loadStateOverridePresets();
  const newPreset: StateOverridePreset = {
    id: generateId(),
    name,
    description,
    accounts,
    createdAt: Date.now(),
  };
  presets.unshift(newPreset);
  localStorage.setItem(STORAGE_KEYS.STATE_OVERRIDE_PRESETS, JSON.stringify(presets));
  return newPreset;
}

export function deleteStateOverridePreset(id: string): boolean {
  const presets = loadStateOverridePresets();
  const filtered = presets.filter((p) => p.id !== id);
  if (filtered.length === presets.length) return false;
  localStorage.setItem(STORAGE_KEYS.STATE_OVERRIDE_PRESETS, JSON.stringify(filtered));
  return true;
}
