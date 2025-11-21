import React, { useState } from 'react';

interface PresetManagerProps<T extends { id: string; name: string; createdAt: number }> {
  title: string;
  presets: T[];
  onClose: () => void;
  onEdit: (preset: T) => void;
  onDelete: (id: string) => void;
  renderPreview: (preset: T) => React.ReactNode;
}

function PresetManager<T extends { id: string; name: string; createdAt: number }>({
  title,
  presets,
  onClose,
  onEdit,
  onDelete,
  renderPreview,
}: PresetManagerProps<T>) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    if (deleteConfirmId === id) {
      onDelete(id);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
      // 3秒后自动取消确认
      setTimeout(() => {
        setDeleteConfirmId(prev => prev === id ? null : prev);
      }, 3000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* 列表内容 */}
        <div className="flex-1 overflow-y-auto p-6">
          {presets.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              暂无预设，请先保存一个预设
            </div>
          ) : (
            <div className="space-y-3">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800 mb-1">
                        {preset.name}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {new Date(preset.createdAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => onEdit(preset)}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(preset.id)}
                        className={`px-3 py-1 text-sm rounded transition-colors ${
                          deleteConfirmId === preset.id
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        {deleteConfirmId === preset.id ? '确认删除？' : '删除'}
                      </button>
                    </div>
                  </div>
                  
                  {/* 预览内容 */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    {renderPreview(preset)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

export default PresetManager;

