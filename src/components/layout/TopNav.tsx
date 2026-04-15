import React from 'react';
import { useTranslation } from 'react-i18next';

export type TabId =
  | 'function-call'
  | 'transaction-parser'
  | 'debug-trace'
  | 'hex-parser'
  | 'event-query'
  | 'abi-encoder'
  | 'state-override'
  | 'slot-calc';

interface Tab {
  id: TabId;
  label: string;
}

interface TopNavProps {
  activeTab: TabId;
  tabs: Tab[];
  onTabChange: (id: TabId) => void;
  onPresetsClick: () => void;
  onConfigClick: () => void;
  showAddressNames: boolean;
  onToggleAddressNames: () => void;
}

const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  tabs,
  onTabChange,
  onPresetsClick,
  onConfigClick,
  showAddressNames,
  onToggleAddressNames,
}) => {
  const { t, i18n } = useTranslation();

  const cycleLang = () => {
    const next = i18n.language === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(next);
    localStorage.setItem('language', next);
  };

  return (
    <nav className="flex items-center gap-6 border-b border-line bg-bg px-5 py-2.5 font-mono text-[11px]">
      <span className="font-bold tracking-wider text-white">
        evm-caller
        <span className="mx-2 text-mint">·</span>
        <span className="text-fg-dim">
          {tabs.find((tab) => tab.id === activeTab)?.label}
        </span>
      </span>

      <div className="flex flex-1 gap-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={
              'rounded-sm px-2.5 py-1.5 transition-colors ' +
              (activeTab === tab.id
                ? 'bg-mint font-semibold text-bg'
                : 'text-fg-dim hover:bg-surface-2')
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onToggleAddressNames}
          title={t('topnav.toggleAddressNames')}
          className={
            'rounded-sm border px-2 py-1 transition-colors ' +
            (showAddressNames
              ? 'border-mint/60 bg-mint/10 text-mint hover:bg-mint/15'
              : 'border-line bg-surface text-fg-dim hover:bg-surface-2 hover:text-fg')
          }
        >
          @names
        </button>
        <button
          onClick={onPresetsClick}
          className="rounded-sm border border-line bg-surface px-2 py-1 text-fg-dim transition-colors hover:bg-surface-2 hover:text-fg"
        >
          {t('topnav.presets')}
        </button>
        <button
          onClick={cycleLang}
          className="rounded-sm border border-line bg-surface px-2 py-1 text-fg-dim transition-colors hover:bg-surface-2 hover:text-fg"
        >
          {i18n.language === 'zh' ? 'EN' : 'ZH'}
        </button>
        <button
          onClick={onConfigClick}
          className="rounded-sm border border-line bg-surface px-2 py-1 text-fg-dim transition-colors hover:bg-surface-2 hover:text-fg"
        >
          {t('topnav.config')}
        </button>
      </div>
    </nav>
  );
};

export default TopNav;
