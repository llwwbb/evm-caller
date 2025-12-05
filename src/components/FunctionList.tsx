import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ParsedFunction, ParsedParam, RpcConfig } from '../types';
import { parseParamValue } from '../utils/rpcCaller';

interface FunctionListProps {
  functions: ParsedFunction[];
  config: RpcConfig; // eslint-disable-line @typescript-eslint/no-unused-vars
  abiString: string; // eslint-disable-line @typescript-eslint/no-unused-vars
  onFunctionCall: (functionName: string, args: any[], func: ParsedFunction) => void;
}

const FunctionList: React.FC<FunctionListProps> = ({
  functions,
  config: _config,
  abiString: _abiString,
  onFunctionCall,
}) => {
  const { t } = useTranslation();
  const [expandedFunction, setExpandedFunction] = useState<string | null>(null);
  // 改用嵌套路径的方式存储值，例如 "functionName.0.field1"
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 对函数进行排序：view/pure 在前，payable/nonpayable 在后，同类型内按名称排序
  const sortedFunctions = [...functions].sort((a, b) => {
    // 定义优先级：view/pure = 1, 其他 = 2
    const getPriority = (func: ParsedFunction) => {
      return func.stateMutability === 'view' || func.stateMutability === 'pure' ? 1 : 2;
    };

    const priorityA = getPriority(a);
    const priorityB = getPriority(b);

    // 先按优先级排序
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // 优先级相同时，按名称排序
    return a.name.localeCompare(b.name);
  });

  // 获取函数类型的样式和标签
  const getFunctionTypeBadge = (stateMutability: string) => {
    switch (stateMutability) {
      case 'view':
        return <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">👁️ VIEW</span>;
      case 'pure':
        return <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium">🔒 PURE</span>;
      case 'payable':
        return <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs font-medium">{t('functionList.payable')}</span>;
      case 'nonpayable':
        return <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs font-medium">{t('functionList.simulation')}</span>;
      default:
        return <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded text-xs font-medium">{stateMutability}</span>;
    }
  };

  const handleInputChange = (path: string, value: string) => {
    setInputValues(prev => ({
      ...prev,
      [path]: value,
    }));
    
    // 清除该函数的错误
    const functionName = path.split('.')[0];
    if (errors[functionName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[functionName];
        return newErrors;
      });
    }
  };

  // 递归解析参数值，包括 tuple
  const parseParamRecursive = (param: ParsedParam, basePath: string): any => {
    const value = inputValues[basePath] || '';
    
    // 如果是 tuple 类型，递归解析每个 component
    if (param.type.startsWith('tuple') && param.components) {
      const tupleValues: any[] = [];
      for (let i = 0; i < param.components.length; i++) {
        const component = param.components[i];
        const componentPath = `${basePath}.${i}`;
        tupleValues.push(parseParamRecursive(component, componentPath));
      }
      return tupleValues;
    }
    
    // 普通类型，直接解析
    return parseParamValue(value, param.type);
  };

  const handleCall = (func: ParsedFunction) => {
    try {
      const args: any[] = [];
      
      // 解析所有参数
      for (let i = 0; i < func.inputs.length; i++) {
        const input = func.inputs[i];
        const basePath = `${func.name}.${i}`;
        args.push(parseParamRecursive(input, basePath));
      }

      onFunctionCall(func.name, args, func);
    } catch (error) {
      if (error instanceof Error) {
        setErrors(prev => ({
          ...prev,
          [func.name]: error.message,
        }));
      }
    }
  };

  const toggleFunction = (functionName: string) => {
    setExpandedFunction(prev => prev === functionName ? null : functionName);
  };

  // 递归渲染参数输入框，支持 tuple 展开
  const renderParamInput = (param: ParsedParam, basePath: string, depth: number = 0): React.ReactElement => {
    // 如果是 tuple 类型，展开显示所有 components
    if (param.type.startsWith('tuple') && param.components) {
      return (
        <div key={basePath} className={`${depth > 0 ? 'ml-4 pl-4 border-l-2 border-gray-200' : ''}`}>
          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-700">
              {param.name || t('functionList.paramName')}
              <span className="ml-2 text-xs text-gray-500 font-mono">
                ({param.type})
              </span>
            </label>
            {param.internalType && (
              <p className="text-xs text-gray-500 mt-0.5">{param.internalType}</p>
            )}
          </div>
          <div className="space-y-3 mt-2">
            {param.components.map((component, idx) => 
              renderParamInput(component, `${basePath}.${idx}`, depth + 1)
            )}
          </div>
        </div>
      );
    }

    // 普通类型，渲染单个输入框
    return (
      <div key={basePath} className={depth > 0 ? 'mb-2' : ''}>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {param.name || t('functionList.fieldName')}
          <span className="ml-2 text-xs text-gray-500 font-mono">
            ({param.type})
          </span>
        </label>
        <input
          type="text"
          value={inputValues[basePath] || ''}
          onChange={(e) => handleInputChange(basePath, e.target.value)}
          placeholder={getPlaceholder(param.type)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        {t('functionList.title')}
      </h2>

      <div className="space-y-3">
        {sortedFunctions.map((func, index) => {
          // 检查是否需要在这里插入分隔线
          const isFirstSimulateCall = index > 0 && 
            (sortedFunctions[index - 1].stateMutability === 'view' || sortedFunctions[index - 1].stateMutability === 'pure') &&
            (func.stateMutability !== 'view' && func.stateMutability !== 'pure');

          return (
            <React.Fragment key={func.name}>
              {isFirstSimulateCall && (
                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 border-t border-gray-300"></div>
                  <span className="text-xs text-gray-500 font-medium">{t('functionList.writeFunctions')}</span>
                  <div className="flex-1 border-t border-gray-300"></div>
                </div>
              )}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
            {/* 函数头部 */}
            <div
              onClick={() => toggleFunction(func.name)}
              className="bg-gray-50 px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-800">
                      {func.name}
                    </h3>
                    {getFunctionTypeBadge(func.stateMutability)}
                  </div>
                  
                  <p className="text-sm text-gray-600 mt-1 font-mono">
                    {func.inputs.length > 0
                      ? `(${func.inputs.map(i => `${i.type} ${i.name || ''}`).join(', ')})`
                      : '()'}
                    {func.outputs.length > 0 && (
                      <span className="text-gray-500">
                        {' → '}
                        {func.outputs.map(o => o.type).join(', ')}
                      </span>
                    )}
                  </p>
                </div>
                
                <svg
                  className={`w-5 h-5 text-gray-500 transform transition-transform ${
                    expandedFunction === func.name ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* 函数参数输入 */}
            {expandedFunction === func.name && (
              <div className="p-4 bg-white">
                {func.inputs.length === 0 ? (
                  <p className="text-sm text-gray-500 mb-4">{t('functionList.noFunctions')}</p>
                ) : (
                  <div className="space-y-4 mb-4">
                    {func.inputs.map((input, index) => 
                      renderParamInput(input, `${func.name}.${index}`, 0)
                    )}
                  </div>
                )}

                <button
                  onClick={() => handleCall(func)}
                  className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition-colors"
                >
                  {t('functionList.call')}
                </button>

                {errors[func.name] && (
                  <div className="mt-3 p-3 rounded-md bg-red-50 text-red-800 text-sm border border-red-200">
                    {errors[func.name]}
                  </div>
                )}
              </div>
            )}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

// 根据参数类型提供占位符提示
function getPlaceholder(type: string): string {
  // Import useTranslation here is not possible in regular function
  // We'll use simple strings as placeholders are UI hints, not critical translations
  if (type === 'address') return '0x...';
  if (type.startsWith('uint') || type.startsWith('int')) return 'Number';
  if (type === 'bool') return 'true or false';
  if (type === 'string') return 'Text';
  if (type.startsWith('bytes')) return '0x...';
  if (type.startsWith('tuple')) return 'Expand fields';
  if (type.endsWith('[]')) return '["item1", "item2"]';
  return 'Input value';
}

export default FunctionList;

