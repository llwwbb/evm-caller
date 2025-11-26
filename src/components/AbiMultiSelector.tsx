import React, { useState, useEffect } from 'react';
import { loadAbiPresets } from '../utils/presetStorage';
import { AbiPreset } from '../types';

interface AbiMultiSelectorProps {
  selectedAbis: string[]; // 已选择的 ABI 字符串数组
  onSelectionChange: (abis: string[]) => void;
}

const AbiMultiSelector: React.FC<AbiMultiSelectorProps> = ({
  selectedAbis,
  onSelectionChange,
}) => {
  const [abiPresets, setAbiPresets] = useState<AbiPreset[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = () => {
    const presets = loadAbiPresets().sort((a, b) => a.name.localeCompare(b.name));
    setAbiPresets(presets);
  };

  const handleToggle = (abi: string) => {
    if (selectedAbis.includes(abi)) {
      // 取消选择
      onSelectionChange(selectedAbis.filter(a => a !== abi));
    } else {
      // 添加选择
      onSelectionChange([...selectedAbis, abi]);
    }
  };

  const handleSelectAll = () => {
    if (selectedAbis.length === abiPresets.length) {
      // 全部取消
      onSelectionChange([]);
    } else {
      // 全部选择
      onSelectionChange(abiPresets.map(p => p.abi));
    }
  };

  const isSelected = (abi: string) => selectedAbis.includes(abi);
  const allSelected = selectedAbis.length === abiPresets.length && abiPresets.length > 0;

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800">
          选择 ABI
          <span className="ml-2 text-sm text-gray-500">
            ({selectedAbis.length} / {abiPresets.length})
          </span>
        </h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {isExpanded ? '收起' : '展开'}
        </button>
      </div>

      {selectedAbis.length === 0 && (
        <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            请至少选择一个 ABI 用于解析
          </p>
        </div>
      )}

      {abiPresets.length === 0 ? (
        <div className="text-sm text-gray-500 text-center py-4">
          暂无 ABI 预设，请先在侧边栏添加
        </div>
      ) : (
        <>
          <div className="flex items-center mb-2">
            <input
              type="checkbox"
              id="select-all"
              checked={allSelected}
              onChange={handleSelectAll}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <label
              htmlFor="select-all"
              className="ml-2 text-sm font-medium text-gray-700 cursor-pointer"
            >
              全选/取消全选
            </label>
          </div>

          <div
            className={`space-y-2 overflow-y-auto ${
              isExpanded ? 'max-h-96' : 'max-h-32'
            }`}
          >
            {abiPresets.map((preset) => (
              <div
                key={preset.id}
                className={`flex items-start p-2 rounded border-2 transition-colors cursor-pointer ${
                  isSelected(preset.abi)
                    ? 'bg-purple-50 border-purple-300'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
                onClick={() => handleToggle(preset.abi)}
              >
                <input
                  type="checkbox"
                  checked={isSelected(preset.abi)}
                  onChange={() => handleToggle(preset.abi)}
                  className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="ml-3 flex-1">
                  <label className="text-sm font-medium text-gray-800 cursor-pointer">
                    {preset.name}
                  </label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    添加于 {new Date(preset.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default AbiMultiSelector;

