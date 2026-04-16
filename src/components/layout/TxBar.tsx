import React from 'react';
import { useTranslation } from 'react-i18next';
import RpcPicker from '../common/RpcPicker';
import ContractPicker from '../common/ContractPicker';
import { RpcPreset, ContractPreset, ContractEntry } from '../../types';

export interface TxBarExtra {
  kicker: string;
  value: React.ReactNode;
}

interface TxBarProps {
  rpcUrl: string;
  onRpcChange: (rpcUrl: string, preset?: RpcPreset) => void;
  contractAddress?: string;
  onContractChange?: (
    addr: string,
    preset?: ContractPreset,
    entry?: ContractEntry,
  ) => void;
  txHash?: string;
  onTxHashChange?: (hash: string) => void;
  onTxHashSubmit?: () => void;
  isFetching?: boolean;
  currentChainId: number | null;
  extra?: TxBarExtra[];
  actions?: React.ReactNode;
  refreshToken?: number;
}

const TxBar: React.FC<TxBarProps> = ({
  rpcUrl,
  onRpcChange,
  contractAddress,
  onContractChange,
  txHash,
  onTxHashChange,
  onTxHashSubmit,
  isFetching,
  currentChainId,
  extra,
  actions,
  refreshToken,
}) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 border-b border-line bg-bg px-5 py-2.5 font-mono text-[11px]">
      <span className="text-[10px] uppercase tracking-[0.2em] text-fg-mute">rpc</span>
      <RpcPicker
        value={rpcUrl}
        onChange={onRpcChange}
        width="240px"
        refreshToken={refreshToken}
      />
      {onContractChange && (
        <>
          <span className="text-line">/</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-fg-mute">contract</span>
          <ContractPicker
            value={contractAddress ?? ''}
            onChange={onContractChange}
            currentChainId={currentChainId}
            width="360px"
            refreshToken={refreshToken}
          />
        </>
      )}
      {onTxHashChange && (
        <>
          <span className="text-line">/</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-fg-mute">tx</span>
          <input
            value={txHash ?? ''}
            onChange={(e) => onTxHashChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && onTxHashSubmit) onTxHashSubmit(); }}
            placeholder="0x..."
            className="w-[400px] rounded-sm border border-line bg-bg px-2 py-1 font-mono text-[11px] text-fg placeholder:text-fg-mute focus:border-mint focus:outline-none"
          />
          {onTxHashSubmit && (
            <button
              onClick={onTxHashSubmit}
              disabled={isFetching}
              className="rounded-sm border border-line bg-surface px-3 py-1 font-mono text-[10px] font-semibold text-fg hover:bg-surface-2 hover:text-fg disabled:opacity-50"
            >
              {isFetching ? t('common.fetching') : t('common.fetch')}
            </button>
          )}
        </>
      )}
      {extra?.map((it, idx) => (
        <React.Fragment key={`${it.kicker}-${idx}`}>
          <span className="text-line">/</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-fg-mute">{it.kicker}</span>
          <span className="text-fg">{it.value}</span>
        </React.Fragment>
      ))}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
};

export default TxBar;
