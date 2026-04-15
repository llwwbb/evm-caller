# 国际化 (i18n) 使用指南

## 功能概述

本项目已经集成了完整的国际化支持，可以在**中文**和**英文**之间自由切换。

## 使用方法

### 1. 切换语言

在页面右上角找到语言切换按钮：
- 显示 "EN" 时，点击切换到英文
- 显示 "中文" 时，点击切换到中文

语言设置会自动保存到浏览器的 localStorage 中，下次访问时会记住您的语言偏好。

### 2. 默认语言

系统默认使用中文。如果需要修改默认语言，可以编辑 `src/i18n/index.ts` 文件中的 `lng` 配置。

## 技术实现

### 依赖包

- `i18next` - 核心国际化框架
- `react-i18next` - React 集成

### 文件结构

```
src/
├── i18n/
│   ├── index.ts          # i18n 配置文件
│   └── locales/
│       ├── zh.json       # 中文翻译
│       └── en.json       # 英文翻译
├── components/
│   └── LanguageSwitcher.tsx  # 语言切换组件
└── main.tsx              # 导入 i18n 配置
```

### 在组件中使用

```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('header.title')}</h1>
      <p>{t('header.subtitle')}</p>
    </div>
  );
}
```

### 带参数的翻译

```typescript
// 在翻译文件中
{
  "rpcConfig": {
    "selectedAbis": "{count} 个 ABI 接口已选择"
  }
}

// 在组件中使用
t('rpcConfig.selectedAbis', { count: 3 })
// 输出: "3 个 ABI 接口已选择"
```

## 添加新的翻译

### 1. 在翻译文件中添加键值

**中文** (`src/i18n/locales/zh.json`):
```json
{
  "newSection": {
    "newKey": "新的中文文本"
  }
}
```

**英文** (`src/i18n/locales/en.json`):
```json
{
  "newSection": {
    "newKey": "New English text"
  }
}
```

### 2. 在组件中使用

```typescript
const { t } = useTranslation();
return <div>{t('newSection.newKey')}</div>;
```

## 已翻译的功能模块

✅ 页面头部（标题、标签）  
✅ 预设管理（RPC、合约、ABI）  
✅ 配置面板  
✅ 函数列表  
✅ 调用结果显示  
✅ 所有提示信息和错误消息  
✅ 弹窗和对话框

## 注意事项

1. 所有用户可见的文本都应该使用 `t()` 函数进行翻译
2. 翻译键使用点号分隔的层级结构，便于组织和维护
3. 保持中英文翻译文件的键值结构一致
4. 语言偏好存储在 localStorage 的 `language` 键中

## 测试

启动开发服务器：
```bash
npm run dev
```

访问 http://localhost:5174/ ，点击右上角的语言切换按钮测试中英文切换功能。

## 扩展其他语言

如需添加其他语言（如日语、韩语等）：

1. 在 `src/i18n/locales/` 目录下创建新的翻译文件，如 `ja.json`
2. 在 `src/i18n/index.ts` 中导入并添加到 `resources` 对象
3. 修改 `LanguageSwitcher.tsx` 组件以支持多语言切换

示例：
```typescript
// src/i18n/index.ts
import ja from './locales/ja.json';

const resources = {
  zh: { translation: zh },
  en: { translation: en },
  ja: { translation: ja },  // 新增
};
```

