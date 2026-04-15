import { Interface, JsonRpcProvider, toBeHex } from 'ethers';
import { StateOverride } from '../types';
import { formatStateOverrideParams } from './stateOverride';

/**
 * EIP-1167 minimal proxy bytecode pointing to the canonical Multicall3
 * address (0xcA11bde05977b3631167028862bE2a173976CA11). When we install this
 * as the `code` of an EOA via stateOverride, aggregate3() runs in the EOA's
 * execution context, so each sub-call's msg.sender is the EOA itself —
 * exactly what "approve + swap as this address" needs.
 */
const MULTICALL3_PROXY_CODE =
  '0x363d3d373d3d3d363d73cA11bde05977b3631167028862bE2a173976CA115af43d82803e903d91602b57fd5bf3';

const MULTICALL3_ABI = [
  {
    name: 'aggregate3',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'allowFailure', type: 'bool' },
          { name: 'callData', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      {
        name: 'returnData',
        type: 'tuple[]',
        components: [
          { name: 'success', type: 'bool' },
          { name: 'returnData', type: 'bytes' },
        ],
      },
    ],
  },
];

export interface BatchCall {
  contractAddress: string;
  functionName: string;
  args: any[];
  allowFailure?: boolean;
}

export interface BatchCallResult {
  success: boolean;
  data?: any;
  error?: string;
  returnData?: string;
  call: BatchCall;
}

export interface BatchExecutionResult {
  success: boolean;
  /** Per-call decoded results. Present on both eth_call and debug_traceCall paths. */
  results?: BatchCallResult[];
  /** Raw trace tree from debug_traceCall (when method === 'debug_traceCall'). */
  trace?: any;
  error?: string;
}

function formatResult(result: any): any {
  if (typeof result === 'bigint') return result.toString();
  if (Array.isArray(result)) return result.map(formatResult);
  if (result && typeof result === 'object') {
    if (typeof result.toObject === 'function') {
      try {
        const obj = result.toObject();
        const out: any = {};
        for (const k in obj) out[k] = formatResult(obj[k]);
        return out;
      } catch {
        // fall through
      }
    }
    const out: any = {};
    for (const k in result) {
      if (!isNaN(Number(k))) continue;
      out[k] = formatResult(result[k]);
    }
    return out;
  }
  return result;
}

/**
 * Execute N calls in a single RPC request.
 * - N = 1: direct eth_call / debug_traceCall to the single target (no proxy).
 * - N > 1: injects an EIP-1167 delegatecall proxy at `fromAddress` pointing
 *   to the canonical Multicall3, then invokes aggregate3. Preserves msg.sender.
 *
 * The ABI parameter is the merged ABI JSON string used for encoding inputs
 * and decoding outputs across all calls.
 */
export async function executeBatch(
  provider: JsonRpcProvider,
  abi: string,
  calls: BatchCall[],
  fromAddress: string,
  blockTag: string | number,
  stateOverride: Record<string, StateOverride>,
  method: 'eth_call' | 'debug_traceCall'
): Promise<BatchExecutionResult> {
  if (calls.length === 0) {
    return { success: false, error: 'no calls provided' };
  }
  if (!fromAddress) {
    return { success: false, error: 'fromAddress is required' };
  }

  let abiFragments: any;
  try {
    abiFragments = JSON.parse(abi);
  } catch {
    return { success: false, error: 'invalid ABI JSON' };
  }
  const callIface = new Interface(abiFragments);

  // Merge user state overrides with the (conditional) proxy code injection
  const overrides: Record<string, any> = {
    ...formatStateOverrideParams(stateOverride),
  };
  if (calls.length > 1) {
    overrides[fromAddress] = {
      ...(overrides[fromAddress] ?? {}),
      code: MULTICALL3_PROXY_CODE,
    };
  }

  // Build the transaction (either single-call or aggregate3)
  let txTo: string;
  let txData: string;

  if (calls.length === 1) {
    const c = calls[0];
    txTo = c.contractAddress;
    txData = callIface.encodeFunctionData(c.functionName, c.args);
  } else {
    const multicallIface = new Interface(MULTICALL3_ABI);
    const aggregateCalls = calls.map((c) => ({
      target: c.contractAddress,
      allowFailure: c.allowFailure ?? false,
      callData: callIface.encodeFunctionData(c.functionName, c.args),
    }));
    txTo = fromAddress;
    txData = multicallIface.encodeFunctionData('aggregate3', [aggregateCalls]);
  }

  const tx = {
    from: fromAddress,
    to: txTo,
    data: txData,
  };
  const blockTagHex = typeof blockTag === 'number' ? toBeHex(blockTag) : blockTag;

  if (method === 'eth_call') {
    try {
      const raw: string = await provider.send('eth_call', [tx, blockTagHex, overrides]);
      if (calls.length === 1) {
        const c = calls[0];
        let data: any;
        try {
          const decoded = callIface.decodeFunctionResult(c.functionName, raw);
          data = formatResult(decoded);
        } catch {
          data = raw;
        }
        return {
          success: true,
          results: [{ success: true, data, returnData: raw, call: c }],
        };
      }
      // Decode aggregate3 results
      const multicallIface = new Interface(MULTICALL3_ABI);
      const [aggResult] = multicallIface.decodeFunctionResult('aggregate3', raw);
      const results: BatchCallResult[] = [];
      for (let i = 0; i < calls.length; i++) {
        const r = aggResult[i];
        const call = calls[i];
        if (r.success) {
          let data: any;
          try {
            const decoded = callIface.decodeFunctionResult(call.functionName, r.returnData);
            data = formatResult(decoded);
          } catch {
            data = r.returnData;
          }
          results.push({ success: true, data, returnData: r.returnData, call });
        } else {
          results.push({ success: false, error: 'sub-call reverted', returnData: r.returnData, call });
        }
      }
      return { success: true, results };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // debug_traceCall
  try {
    const traceConfig: any = {
      tracer: 'callTracer',
      tracerConfig: { onlyTopCall: false },
      stateOverrides: overrides,
    };
    const trace = await provider.send('debug_traceCall', [tx, blockTagHex, traceConfig]);
    return { success: !trace.error, trace, error: trace.error };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
