import React, { useState } from 'react';
import { ParsedFunction, RpcConfig } from '../types';
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
  const [expandedFunction, setExpandedFunction] = useState<string | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, Record<number, string>>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (functionName: string, paramIndex: number, value: string) => {
    setInputValues(prev => ({
      ...prev,
      [functionName]: {
        ...prev[functionName],
        [paramIndex]: value,
      },
    }));
    
    // 清除该函数的错误
    if (errors[functionName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[functionName];
        return newErrors;
      });
    }
  };

  const handleCall = (func: ParsedFunction) => {
    try {
      const args: any[] = [];
      
      // 解析所有参数
      for (let i = 0; i < func.inputs.length; i++) {
        const input = func.inputs[i];
        const value = inputValues[func.name]?.[i] || '';
        
        const parsedValue = parseParamValue(value, input.type);
        args.push(parsedValue);
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

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        步骤 3: 调用函数
      </h2>

      <div className="space-y-3">
        {functions.map((func) => (
          <div
            key={func.name}
            className="border border-gray-200 rounded-lg overflow-hidden"
          >
            {/* 函数头部 */}
            <div
              onClick={() => toggleFunction(func.name)}
              className="bg-gray-50 px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800">
                    {func.name}
                    <span className="ml-2 text-xs text-gray-500">
                      ({func.stateMutability})
                    </span>
                  </h3>
                  
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
                  <p className="text-sm text-gray-500 mb-4">此函数无需参数</p>
                ) : (
                  <div className="space-y-3 mb-4">
                    {func.inputs.map((input, index) => (
                      <div key={index}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {input.name || `参数 ${index + 1}`}
                          <span className="ml-2 text-xs text-gray-500 font-mono">
                            ({input.type})
                          </span>
                        </label>
                        <input
                          type="text"
                          value={inputValues[func.name]?.[index] || ''}
                          onChange={(e) => handleInputChange(func.name, index, e.target.value)}
                          placeholder={getPlaceholder(input.type)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => handleCall(func)}
                  className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition-colors"
                >
                  调用函数
                </button>

                {errors[func.name] && (
                  <div className="mt-3 p-3 rounded-md bg-red-50 text-red-800 text-sm border border-red-200">
                    {errors[func.name]}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// 根据参数类型提供占位符提示
function getPlaceholder(type: string): string {
  if (type === 'address') return '0x...';
  if (type.startsWith('uint') || type.startsWith('int')) return '数字';
  if (type === 'bool') return 'true 或 false';
  if (type === 'string') return '文本';
  if (type.startsWith('bytes')) return '0x...';
  if (type.endsWith('[]')) return '["item1", "item2"]';
  return '输入值';
}

export default FunctionList;

