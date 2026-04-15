export async function fetchChainId(
  rpcUrl: string,
  signal?: AbortSignal,
): Promise<number> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_chainId',
      params: [],
    }),
    signal,
  });
  if (!res.ok) {
    throw new Error(`eth_chainId HTTP ${res.status}`);
  }
  const json = await res.json();
  if (json.error) {
    throw new Error(json.error.message ?? 'eth_chainId failed');
  }
  return parseInt(json.result, 16);
}
