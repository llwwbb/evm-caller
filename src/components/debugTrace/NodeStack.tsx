import React from 'react';
import { useTranslation } from 'react-i18next';
import { ParsedCallTrace } from '../../types';
import NodeCard from './NodeCard';
import { AddressNameMap, formatAddress } from '../../utils/addressDisplay';

interface NodeStackProps {
  cards: string[];
  selectedPath: string | null;
  pinnedPaths: Set<string>;
  collapsedPaths: Set<string>;
  getNodeByPath: (path: string) => ParsedCallTrace | null;
  addressNameMap: AddressNameMap;
  showAddressNames: boolean;
  onTogglePin: (path: string) => void;
  onClose: (path: string) => void;
  onToggleCollapse: (path: string) => void;
  onCloseAll: () => void;
}

function buildCrumb(
  path: string,
  nameMap: AddressNameMap,
  showNames: boolean,
  getByPath: (p: string) => ParsedCallTrace | null
): string {
  const parts = path.split('-');
  const segments: string[] = [];
  for (let i = 1; i <= parts.length; i++) {
    const subPath = parts.slice(0, i).join('-');
    const node = getByPath(subPath);
    if (!node) break;
    const to = node.to ? formatAddress(node.to, nameMap, showNames) : '(create)';
    const fn = node.decodedInput?.functionName;
    segments.push(fn ? `${to}.${fn}` : to);
  }
  return segments.join(' · ');
}

const NodeStack: React.FC<NodeStackProps> = ({
  cards,
  selectedPath,
  pinnedPaths,
  collapsedPaths,
  getNodeByPath,
  addressNameMap,
  showAddressNames,
  onTogglePin,
  onClose,
  onToggleCollapse,
  onCloseAll,
}) => {
  const { t } = useTranslation();
  const pinCount = pinnedPaths.size;

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-2.5 font-mono text-[10px]">
        <span className="uppercase tracking-[0.22em] text-fg-mute">focused +</span>
        <span className="text-fg">pinned</span>
        <span className="text-mint">{cards.length}</span>
        {pinCount >= 5 && (
          <span className="text-[9px] text-fg-mute">
            {t('debugTrace.pinnedHint', { count: pinCount })}
          </span>
        )}
        {cards.length > 0 && (
          <button
            onClick={onCloseAll}
            className="ml-auto rounded-sm px-2 py-0.5 text-[10px] text-fg-mute hover:bg-surface-2"
          >
            {t('debugTrace.closeAll')}
          </button>
        )}
      </div>

      <div className="flex flex-1 min-h-0 flex-col gap-px overflow-y-auto bg-line">
        {cards.length === 0 ? (
          <div className="flex h-full items-center justify-center bg-bg p-8 text-center">
            <p className="font-ui text-[12px] text-fg-mute">
              {t('debugTrace.clickNodeToViewDetail')}
            </p>
          </div>
        ) : (
          cards.map((path) => {
            const trace = getNodeByPath(path);
            if (!trace) return null;
            const crumb = buildCrumb(path, addressNameMap, showAddressNames, getNodeByPath);
            return (
              <NodeCard
                key={path}
                trace={trace}
                path={path}
                crumb={crumb}
                isFocused={selectedPath === path}
                isPinned={pinnedPaths.has(path)}
                isCollapsed={collapsedPaths.has(path)}
                addressNameMap={addressNameMap}
                showAddressNames={showAddressNames}
                onTogglePin={onTogglePin}
                onClose={onClose}
                onToggleCollapse={onToggleCollapse}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

export default NodeStack;
