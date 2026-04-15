import React from 'react';

export interface TxBarItem {
  kicker: string;
  value: React.ReactNode;
}

interface TxBarProps {
  items: TxBarItem[];
  actions?: React.ReactNode;
}

const TxBar: React.FC<TxBarProps> = ({ items, actions }) => {
  return (
    <div className="flex items-center gap-3.5 border-b border-line bg-bg px-5 py-2.5 font-mono text-[11px]">
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <span className="text-line">/</span>}
          <span className="text-[10px] uppercase tracking-[0.2em] text-fg-mute">
            {item.kicker}
          </span>
          <span className="text-fg">{item.value}</span>
        </React.Fragment>
      ))}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
};

export default TxBar;
