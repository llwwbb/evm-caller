import React from 'react';

interface PresetSelectorProps<T extends { id: string; name: string }> {
  label: string;
  presets: T[];
  selectedId?: string;
  onSelect: (preset: T | null) => void;
  onSave: () => void;
  onManage: () => void;
  placeholder?: string;
}

function PresetSelector<T extends { id: string; name: string }>({
  label,
  presets,
  selectedId,
  onSelect,
  onSave,
  onManage,
  placeholder = '选择预设',
}: PresetSelectorProps<T>) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '') {
      onSelect(null);
    } else {
      const preset = presets.find(p => p.id === value);
      if (preset) {
        onSelect(preset);
      }
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="flex items-center space-x-2">
        <select
          value={selectedId || ''}
          onChange={handleChange}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        >
          <option value="">{placeholder}</option>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
        
        <button
          onClick={onSave}
          title="保存为预设"
          className="px-3 py-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors text-sm font-medium"
        >
          💾 保存
        </button>
        
        <button
          onClick={onManage}
          title="管理预设"
          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
        >
          ⚙️ 管理
        </button>
      </div>
    </div>
  );
}

export default PresetSelector;

