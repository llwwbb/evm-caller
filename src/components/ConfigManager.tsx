import React, { useState, useRef } from 'react';
import { downloadPresetsAsJson, importPresetsFromFile } from '../utils/presetStorage';

interface ConfigManagerProps {
  onImportComplete?: () => void;
}

const ConfigManager: React.FC<ConfigManagerProps> = ({ onImportComplete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    imported: { rpc: number; contract: number; abi: number };
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    try {
      downloadPresetsAsJson();
      alert('✅ 配置已导出成功！');
    } catch (error) {
      console.error('导出失败:', error);
      alert('❌ 导出失败，请查看控制台');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await importPresetsFromFile(file, importMode);
      setImportResult(result);

      if (result.success) {
        // 触发父组件刷新
        onImportComplete?.();
        
        // 3秒后关闭弹窗
        setTimeout(() => {
          setIsOpen(false);
          setImportResult(null);
        }, 3000);
      }
    } catch (error) {
      console.error('导入失败:', error);
      setImportResult({
        success: false,
        message: '导入失败，请检查文件格式',
        imported: { rpc: 0, contract: 0, abi: 0 },
      });
    }

    // 清空 input，允许重复选择同一文件
    e.target.value = '';
  };

  return (
    <>
      {/* 触发按钮 */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
        title="导入/导出配置"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
        配置管理
      </button>

      {/* 弹窗 */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">配置管理</h2>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setImportResult(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* 导出区域 */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  导出配置
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  将所有 RPC、合约地址和 ABI 预设导出为 JSON 文件
                </p>
                <button
                  onClick={handleExport}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  导出配置文件
                </button>
              </div>

              {/* 导入区域 */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  导入配置
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  从 JSON 文件导入配置
                </p>

                {/* 导入模式选择 */}
                <div className="mb-3 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="merge"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="w-4 h-4 text-green-600"
                    />
                    <span className="text-sm text-gray-700">
                      <span className="font-medium">合并模式</span> - 保留现有配置，添加新配置（去重）
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="w-4 h-4 text-green-600"
                    />
                    <span className="text-sm text-gray-700">
                      <span className="font-medium">替换模式</span> - 清空现有配置，完全替换
                    </span>
                  </label>
                </div>

                <button
                  onClick={handleImportClick}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  选择文件导入
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* 导入结果提示 */}
              {importResult && (
                <div
                  className={`p-4 rounded-lg ${
                    importResult.success
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {importResult.success ? (
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    <div className="flex-1">
                      <p className={`font-medium ${importResult.success ? 'text-green-800' : 'text-red-800'}`}>
                        {importResult.message}
                      </p>
                      {importResult.success && (
                        <p className="text-sm text-gray-600 mt-1">
                          RPC: {importResult.imported.rpc} 个 | 
                          合约: {importResult.imported.contract} 个 | 
                          ABI: {importResult.imported.abi} 个
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ConfigManager;

