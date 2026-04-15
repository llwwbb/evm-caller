import React from 'react';
import { ParsedCallTrace } from '../../types';
import CallTreeRow from './CallTreeRow';
import { AddressNameMap } from '../../utils/addressDisplay';

interface CallTreeProps {
  root: ParsedCallTrace;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  pinnedPaths: Set<string>;
  addressNameMap: AddressNameMap;
  showAddressNames: boolean;
  onRowClick: (path: string, modifier: boolean) => void;
  onToggleExpand: (path: string) => void;
}

interface FlatRow {
  trace: ParsedCallTrace;
  depth: number;
  path: string;
  hasChildren: boolean;
  parentGas: number;
}

function gasNum(gas: string | undefined): number {
  if (!gas) return 0;
  const n = typeof gas === 'string' ? parseInt(gas, 16) : Number(gas);
  return isNaN(n) ? 0 : n;
}

function flatten(
  node: ParsedCallTrace,
  depth: number,
  path: string,
  parentGas: number,
  expanded: Set<string>,
  out: FlatRow[]
) {
  const hasChildren = !!(node.calls && node.calls.length > 0);
  out.push({ trace: node, depth, path, hasChildren, parentGas });
  if (hasChildren && expanded.has(path)) {
    const myGas = gasNum(node.gasUsed);
    for (let i = 0; i < node.calls!.length; i++) {
      flatten(node.calls![i], depth + 1, `${path}-${i}`, myGas || 1, expanded, out);
    }
  }
}

const CallTree: React.FC<CallTreeProps> = ({
  root,
  expandedPaths,
  selectedPath,
  pinnedPaths,
  addressNameMap,
  showAddressNames,
  onRowClick,
  onToggleExpand,
}) => {
  const rows: FlatRow[] = [];
  flatten(root, 0, '0', gasNum(root.gasUsed) || 1, expandedPaths, rows);

  return (
    <div className="overflow-y-auto">
      {rows.map((r) => {
        const pct = r.parentGas > 0 ? (gasNum(r.trace.gasUsed) / r.parentGas) * 100 : 0;
        return (
          <CallTreeRow
            key={r.path}
            trace={r.trace}
            depth={r.depth}
            path={r.path}
            hasChildren={r.hasChildren}
            expanded={expandedPaths.has(r.path)}
            isSelected={selectedPath === r.path}
            isPinned={pinnedPaths.has(r.path)}
            gasPercentOfParent={pct}
            addressNameMap={addressNameMap}
            showAddressNames={showAddressNames}
            onClick={onRowClick}
            onToggleExpand={onToggleExpand}
          />
        );
      })}
    </div>
  );
};

export default CallTree;
