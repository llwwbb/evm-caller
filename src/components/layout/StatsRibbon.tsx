import React from 'react';

export interface StatCell {
  label: string;
  value: React.ReactNode;
  variant?: 'default' | 'ok' | 'warn';
}

interface StatsRibbonProps {
  stats: StatCell[];
}

const StatsRibbon: React.FC<StatsRibbonProps> = ({ stats }) => {
  return (
    <div className="flex border-b border-line bg-bg">
      {stats.map((s, idx) => {
        const colorClass =
          s.variant === 'warn'
            ? 'text-call-red'
            : s.variant === 'ok'
            ? 'text-mint'
            : 'text-fg';
        return (
          <div
            key={idx}
            className="flex-1 border-r border-line px-5 py-2.5 last:border-r-0"
          >
            <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.22em] text-fg-mute">
              {s.label}
            </div>
            <div className={`font-mono text-[18px] font-semibold ${colorClass}`}>
              {s.value}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StatsRibbon;
