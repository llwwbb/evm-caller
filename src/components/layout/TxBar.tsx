import React from 'react';
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
  currentChainId,
  extra,
  actions,
  refreshToken,
}) => {
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
