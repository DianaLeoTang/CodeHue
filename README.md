# CodeHue

一个为 TypeScript/JavaScript/TSX/JSX/Vue 代码提供**结构化颜色装饰**和**AI 智能语义翻译**的 VSCode 扩展。

## ✨ 主要功能

### 🎨 智能函数着色
- **🌈 六大主题自动适配**：根据 VSCode 主题（亮色/暗色）自动切换最佳配色方案
  - `vibrant`（鲜艳）- 高对比度，区分度极高（默认）
  - `soft`（柔和）- 马卡龙色系，护眼舒适
  - `ocean`（海洋）- 蓝绿色系，清新自然
  - `sunset`（日落）- 暖色调，温暖活力
  - `forest`（森林）- 绿色系，沉稳专注
  - `neon`（霓虹）- 荧光色，炫酷科技感
- **React Hooks 精准着色**：四大核心 Hooks 使用不同颜色区分
  - `useState` - 状态管理（最常用）
  - `useEffect` - 副作用处理
  - `useMemo` - 记忆化计算
  - `useCallback` - 回调记忆
- **Vue 组件智能着色**：Vue 单文件组件专用马卡龙色系
  - Composition API - 薄荷绿
  - 生命周期钩子 - 淡青色系
  - 模板指令 - 樱花粉
  - 事件处理 - 浅蓝色
  - 计算属性 - 淡紫色
  - 监听器 - 粉红色
  - 响应式数据 - 桃色
  - Vant 组件库 - 专用配色
- **智能识别过滤**：自动忽略 JSX 内联函数、数组方法回调、TypeScript 类型定义
- **Region 区域着色**：`// #region` 标记的区域使用绿色

### 🤖 AI 智能翻译
- **✨ 开箱即用**：插件已内置私有云 API Key，无需任何配置，安装即可使用！
- **私有云集成**：集成顺丰私有云 AI 模型，安全可靠，响应快速
- **智能函数名翻译**：自动将英文函数名翻译成中文语义
  - `getUserInfo` → `获取用户信息`
  - `handleSubmit` → `处理提交`
  - `calculateTotal` → `计算总计`
- **优先级翻译系统**：三层优先级智能翻译
  - 最高优先级：当前文件可见区域
  - 中优先级：当前文件不可见区域
  - 低优先级：其他打开的文件
- **持久化缓存**：翻译结果自动保存到本地，重启后无需重新翻译
- **智能缓存**：已翻译的函数名会被缓存，响应即时
- **失败降级**：AI 翻译失败时自动显示原函数名，不影响使用
- **多环境支持**：支持生产环境、内网环境、测试环境切换
- **速率控制**：智能请求间隔控制，避免 API 限制

### 📝 中文语义化注释
- **Hook 类型识别**：自动识别 React Hooks 并显示中文注释
  - `useState(` → `// 状态`
  - `useEffect(` → `// 副作用`
  - `useMemo(` → `// 记忆化`
  - `useCallback(` → `// 记忆回调`
- **Vue 组件注释**：自动识别 Vue 组件并显示中文注释
  - Composition API → `// 组合式API`
  - 生命周期钩子 → `// 挂载完成`、`// 卸载完成` 等
  - 模板指令 → `// 模板指令`
  - 事件处理 → `// 事件处理`
  - 计算属性 → `// 计算属性`
  - 监听器 → `// 监听器`
  - 响应式数据 → `// 响应式数据`
  - Vant 组件 → `// 弹窗组件`、`// 输入框组件` 等
- **虚拟注释**：不修改源文件，以悬浮形式显示
- **智能过滤**：自动忽略 JSX 内联函数、数组方法回调和 TypeScript 类型定义

### 🎯 智能识别
- **React Hooks 识别**：精准识别四大核心 Hooks
  - `useState`、`useEffect`、`useMemo`、`useCallback`
  - 支持 `React.useState` 等带前缀的调用
  - 支持跨行 Hook 调用识别
- **Vue 组件识别**：智能识别 Vue 单文件组件
  - Composition API：`ref`、`reactive`、`computed`、`watch` 等
  - 生命周期钩子：`onMounted`、`onUnmounted`、`onUpdated` 等
  - 模板指令：`v-if`、`v-for`、`v-model`、`v-show` 等
  - 事件处理：`@click`、`@input`、`@change` 等
  - Vant 组件库：`van-popup`、`van-field`、`van-list` 等
  - 支持多行 API 声明和长函数识别
- **智能过滤**：自动排除不需要着色的代码
  - JSX 内联函数（`onClick={() => {}}`）
  - 数组方法回调（`.map(item => {})`）
  - TypeScript 类型定义
  - 对象方法调用
- **性能优化**：智能缓存，大文件也能流畅运行
- **边界检测**：精确的函数边界识别，避免重复着色

## 🚀 快速开始

### 安装
1. 在 VSCode 扩展商店搜索 "CodeHue"
2. 点击安装
3. 打开任意 `.ts/.tsx/.js/.jsx` 文件即可看到效果

### 使用
- **自动生效**：安装后自动为函数添加颜色条和注释
- **手动刷新**：如果未显示，按 `Ctrl+Shift+P` 输入 "CodeHue: Refresh Decorations"
- **清空缓存**：按 `Ctrl+Shift+P` 输入 "CodeHue: Clear Translation Cache" 清空翻译缓存
- **Region 标记**：使用 `// #region 区域名称` 和 `// #endregion` 标记区域
- **Vue 支持**：打开 `.vue` 文件即可看到 Vue 组件着色和注释

## 📖 使用示例

### React 示例
```typescript
// #region 用户管理
function UserProfile() {
  const [user, setUser] = useState(null);  // 状态
  
  useEffect(() => {  // 副作用
    fetchUser();
  }, []);
  
  const userData = useMemo(() => {  // 记忆化
    return processUserData(user);
  }, [user]);
  
  const handleSubmit = useCallback((data) => {  // 记忆回调
    // ...
  }, []);
  
  return (
    <div onClick={() => {}}>  {/* JSX 内联函数不着色 */}
      {users.map(user => (  {/* 数组方法回调不着色 */}
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
}
// #endregion
```

### Vue 示例
```vue
<template>
  <div class="user-profile">
    <van-field v-model="username" placeholder="用户名" />  <!-- 输入框组件 -->
    <van-button @click="handleSubmit">提交</van-button>  <!-- 事件处理 -->
    <van-popup v-model:show="showDialog">  <!-- 弹窗组件 -->
      <div v-if="user">  <!-- 模板指令 -->
        {{ user.name }}
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'  // 组合式API

const username = ref('')  // 响应式数据
const showDialog = ref(false)  // 响应式数据

const user = computed(() => {  // 计算属性
  return { name: username.value }
})

watch(username, (newVal) => {  // 监听器
  console.log('用户名变化:', newVal)
})

onMounted(() => {  // 挂载完成
  console.log('组件已挂载')
})

const handleSubmit = () => {  // Vue函数
  showDialog.value = true
}
</script>
```

## ⚙️ 配置选项

在 VSCode 设置中可以配置：

### 🎨 颜色配置
- `codehue.colorScheme`: 颜色方案选择
  - `vibrant`（鲜艳）- 高对比度，区分度极高（默认）
  - `soft`（柔和）- 马卡龙色系，护眼舒适
  - `ocean`（海洋）- 蓝绿色系，清新自然
  - `sunset`（日落）- 暖色调，温暖活力
  - `forest`（森林）- 绿色系，沉稳专注
  - `neon`（霓虹）- 荧光色，炫酷科技感

### 🎯 自定义颜色配置
- `codehue.regionColor`: Region 区域的背景颜色（例如：#A7FFEB）
- `codehue.customHookColors`: React Hooks 自定义颜色配置（JSON 数组格式）

#### 自定义 Hooks 颜色示例：
```json
"codehue.customHookColors": [
  {
    "tag": "useState",
    "color": "#FF8A65"
  },
  {
    "tag": "useEffect", 
    "color": "#A7FFEB"
  },
  {
    "tag": "useMemo",
    "color": "#FFEB3B"
  },
  {
    "tag": "useCallback",
    "color": "#A5F3A5"
  },
  {
    "tag": "useRef",
    "color": "#FF6B6B"
  },
  {
    "tag": "useContext",
    "color": "#4ECDC4"
  },
  {
    "tag": "useReducer",
    "color": "#45B7D1"
  },
  {
    "tag": "useLayoutEffect",
    "color": "#96CEB4"
  },
  {
    "tag": "useImperativeHandle",
    "color": "#FFEAA7"
  },
  {
    "tag": "useDebugValue",
    "color": "#DDA0DD"
  },
  {
    "tag": "useDeferredValue",
    "color": "#98D8C8"
  },
  {
    "tag": "useTransition",
    "color": "#F7DC6F"
  },
  {
    "tag": "useId",
    "color": "#BB8FCE"
  },
  {
    "tag": "useSyncExternalStore",
    "color": "#85C1E9"
  },
  {
    "tag": "useInsertionEffect",
    "color": "#F8C471"
  }
]
```

### 🎯 支持的 React Hooks

CodeHue 现在支持以下 React Hooks 的颜色自定义：

#### 基础 Hooks
- `useState` - 状态管理
- `useEffect` - 副作用处理
- `useContext` - 上下文消费

#### 额外 Hooks
- `useReducer` - 状态管理
- `useCallback` - 记忆回调
- `useMemo` - 记忆化计算
- `useRef` - 引用管理
- `useImperativeHandle` - 命令式句柄
- `useLayoutEffect` - 布局副作用
- `useDebugValue` - 调试值

#### 并发特性 Hooks
- `useDeferredValue` - 延迟值
- `useTransition` - 过渡状态
- `useId` - 唯一标识
- `useSyncExternalStore` - 外部同步
- `useInsertionEffect` - 插入副作用

### ⚙️ 功能配置
- `codehue.enableSemanticComments`: 启用中文语义注释（默认：true）

### 🤖 AI 翻译配置
- `codehue.enableAITranslation`: 启用 AI 智能翻译（默认：true）
- `codehue.aiApiKey`: AI 模型 API Key（请填入您自己的 API Key）
- `codehue.aiModelBaseUrl`: AI 模型的基础 URL（可填入域名，如 `https://api.deepseek.com`，也支持带版本的 `https://api.deepseek.com/v1` 或直接填写完整的 `.../chat/completions` 接口地址）
- `codehue.aiModelName`: AI 模型名称（请根据您的 API 提供商填入正确的模型名称）
  - `aiplat/qwen2.5-72b-instruct`（推荐，翻译质量最高）
  - `aiplat/qwen2.5-vl-72b`（视觉语言模型）
  - `Qwen3-4B`（轻量模型，响应快）

### 📝 注释配置
- `codehue.enableSemanticComments`: 是否显示语义化注释（默认：true）

### 颜色方案说明
> **💡 智能主题适配**：扩展会自动检测当前 VSCode 主题类型（亮色/暗色），并为每种方案应用最佳配色

#### 🎨 六大精选主题

1. **vibrant（鲜艳）** - 默认推荐
   - 🎯 特点：高对比度，区分度极高
   - 💡 适合：需要快速区分代码结构的场景
   - 📊 亮色主题：深色调，对比度强
   - 🌙 暗色主题：明亮色调，清晰易读

2. **soft（柔和）** - 护眼首选
   - 🎯 特点：马卡龙色系，柔和舒适
   - 💡 适合：长时间编码，减轻视觉疲劳
   - 📊 亮色主题：中等饱和度，视觉舒适
   - 🌙 暗色主题：淡雅色调，温柔护眼

3. **ocean（海洋）** - 清新自然
   - 🎯 特点：蓝绿色系，清凉宁静
   - 💡 适合：喜欢冷色调的开发者
   - 📊 亮色主题：深海蓝绿，沉稳专业
   - 🌙 暗色主题：亮青色系，清新明快

4. **sunset（日落）** - 温暖活力
   - 🎯 特点：暖色系，充满活力
   - 💡 适合：喜欢暖色调的开发者
   - 📊 亮色主题：深橙红色，热情奔放
   - 🌙 暗色主题：亮橙色系，温暖舒适

5. **forest（森林）** - 沉稳专注
   - 🎯 特点：绿色系，自然沉静
   - 💡 适合：需要专注力的深度思考场景
   - 📊 亮色主题：深绿色调，稳重专业
   - 🌙 暗色主题：亮绿色系，生机盎然

6. **neon（霓虹）** - 炫酷科技
   - 🎯 特点：荧光色，赛博朋克
   - 💡 适合：喜欢炫酷风格的开发者
   - 📊 亮色主题：高饱和荧光色，视觉冲击
   - 🌙 暗色主题：超亮荧光色，炫酷夺目

## 🎨 颜色方案详解

### 📊 主题适配对比

扩展会根据当前主题自动选择最佳配色，以下是 **vibrant 方案** 的配色对比：

#### 亮色主题配色（深色调）
| Hook/类型 | 颜色 | 说明 |
|----------|------|------|
| `useState` | 🟠 亮橙红 `#FF8A65` | 状态管理（最常用） |
| `useEffect` | 🔵 亮蓝 `#42A5F5` | 副作用处理 |
| `useMemo` | 🟣 亮紫 `#AB47BC` | 记忆化计算 |
| `useCallback` | 🟢 亮青绿 `#26A69A` | 回调记忆 |
| Region | 🟢 亮绿 `#66BB6A` | 区域标识 |

#### 暗色主题配色（明亮色调）
| Hook/类型 | 颜色 | 说明 |
|----------|------|------|
| `useState` | 🟡 超亮黄 `#FFF176` | 状态管理（最常用） |
| `useEffect` | 🔴 超亮红 `#FF8A80` | 副作用处理 |
| `useMemo` | 🔵 超亮蓝 `#64B5F6` | 记忆化计算 |
| `useCallback` | 🔵 超亮青 `#4DD0E1` | 回调记忆 |
| Region | 🟢 超亮绿 `#A5D6A7` | 区域标识 |

### 🔧 支持的 React Hooks
**四大核心 Hooks**（重点支持）：
- `useState` - 状态管理
- `useEffect` - 副作用处理  
- `useMemo` - 记忆化计算
- `useCallback` - 回调记忆

> **💡 智能着色策略**：专注于四大最常用的 Hooks，使用差异明显的颜色进行区分，确保视觉层次清晰。其他 Hooks 暂不进行着色，避免视觉干扰。

## 🔧 技术特性

- **零配置**：安装即用，无需额外设置
- **🎨 智能主题适配**：自动检测 VSCode 主题类型（亮色/暗色），动态切换最佳配色方案
- **高性能**：智能缓存，支持大文件（10000+ 行），防抖优化，避免频繁重绘
- **实时更新**：代码变化时自动更新装饰，文档版本缓存避免重复处理
- **主题切换响应**：切换主题时立即更新颜色，无需手动刷新
- **多语言支持**：TypeScript, JavaScript, TSX, JSX, Vue, Python, Java, C++, C#, Go, Rust, PHP, Ruby, Swift, Kotlin, Dart, Scala, Perl, R, Lua
- **Vue 单文件组件支持**：完整的 Vue SFC 解析和着色
- **智能识别**：精准识别四大核心 React Hooks，智能过滤不需要着色的代码
- **优先级翻译系统**：三层优先级智能翻译，可见区域优先，提升用户体验
- **持久化缓存**：翻译结果自动保存到本地，重启后无需重新翻译
- **速率控制**：智能请求间隔控制，避免 API 限制和 429 错误
- **失败降级**：AI 翻译失败时自动显示原函数名，不影响基本功能
- **环境变量支持**：开发环境使用 .env 文件，生产环境使用构建脚本注入

## 🤖 AI 智能翻译详解

CodeHue 集成了顺丰私有云 AI 模型，可智能翻译函数名为中文语义。

✨ **开箱即用**：插件已内置私有云 API Key，无需任何配置，安装即可使用！

### 快速开始

1. **安装插件**：在 VSCode 扩展商店搜索 "CodeHue"
2. **开始使用**：打开任意代码文件即可看到中文翻译
3. **完成**：就是这么简单！

### 支持的模型

- `aiplat/qwen2.5-72b-instruct` - Qwen2.5 72B 指令模型（推荐，翻译质量最高）
- `aiplat/qwen2.5-vl-72b` - Qwen2.5 VL 72B 视觉语言模型
- `Qwen3-4B` - Qwen3 4B 轻量模型（响应快）

### 工作原理

- **私有云集成**：使用顺丰私有云 AI 模型，安全可靠，无需担心数据泄露
- **自动翻译**：插件内置 API Key，启用后自动调用私有云 AI 模型翻译
- **三层优先级翻译系统**：
  - 最高优先级：当前文件可见区域（立即翻译）
  - 中优先级：当前文件不可见区域（后台翻译）
  - 低优先级：其他打开的文件（最后翻译）
- **持久化缓存**：翻译结果自动保存到本地磁盘，重启后无需重新翻译
- **智能缓存**：已翻译的函数名会被缓存，无需重复调用 API，响应即时
- **速率控制**：智能请求间隔控制（3秒间隔），避免 API 限制
- **失败降级**：AI 翻译失败时自动显示原函数名，不影响使用
- **一键禁用**：可通过 `codehue.enableAITranslation` 快速禁用 AI 翻译

### 高级配置

如需使用自定义 API Key 或模型：

```json
{
  "codehue.enableAITranslation": true,
  "codehue.aiApiKey": "your-api-key",
  "codehue.aiModelBaseUrl": "https://api.example.com/v1",
  "codehue.aiModelName": "aiplat/qwen2.5-72b-instruct"
}
```

## 🚧 计划功能

- [x] ~~自定义颜色方案~~ ✅ 已实现六大主题
- [x] ~~AI 驱动的函数名翻译~~ ✅ 已实现智能翻译
- [x] ~~支持更多编程语言~~ ✅ 已支持多种编程语言
- [x] ~~私有云 AI 集成~~ ✅ 已集成顺丰私有云 AI 模型
- [x] ~~持久化缓存~~ ✅ 已实现翻译结果本地保存
- [x] ~~优先级翻译系统~~ ✅ 已实现三层优先级翻译
- [x] ~~React Hooks 精准识别~~ ✅ 已实现四大核心 Hooks 着色
- [x] ~~智能过滤系统~~ ✅ 已实现 JSX、数组方法等过滤
- [x] ~~Vue 组件支持~~ ✅ 已实现 Vue SFC 完整着色和注释
- [x] ~~Vant 组件库支持~~ ✅ 已实现 Vant 组件识别和着色
- [ ] 集成 JSDoc 注释
- [ ] 函数复杂度可视化
- [ ] 自定义颜色配置
- [ ] 批量翻译功能
- [ ] 代码结构分析
- [ ] 智能代码建议

## 📄 许可证

Apache License 2.0

---

**版本**: 4.0.0  
**兼容性**: VSCode ^1.85.0  
**支持语言**: TypeScript, JavaScript, TSX, JSX, Vue
## 💡 使用技巧

1. **🌈 主题切换**：按 `Cmd+K Cmd+T`（Mac）或 `Ctrl+K Ctrl+T`（Windows/Linux）切换主题，颜色会自动适配
   - 亮色主题：深色调配色，对比度高
   - 暗色主题：明亮色调配色，清晰易读
2. **Region 标记**：使用 `// #region` 标记代码块，获得统一的绿色着色
3. **React Hooks 识别**：四大核心 Hooks 会自动着色和注释
   - `useState` - 状态管理（橙色/黄色）
   - `useEffect` - 副作用处理（蓝色/红色）
   - `useMemo` - 记忆化计算（紫色/蓝色）
   - `useCallback` - 回调记忆（青色/青色）
4. **智能过滤**：JSX 内联函数、数组方法回调等会自动过滤，不会着色
5. **Vue 组件着色**：Vue 单文件组件使用专用马卡龙色系，支持 Composition API、生命周期、指令等
6. **Vant 组件支持**：自动识别 Vant 组件库组件，提供专用配色和注释
7. **性能优化**：对于超大文件（>10000行），插件会自动跳过处理
8. **配色调整**：在设置中切换六大主题方案，每种方案都有亮色/暗色版本
9. **AI 翻译**：可见区域的函数名会优先翻译，提升用户体验

## 🐛 问题反馈

如果遇到问题或有建议，请在 [GitHub Issues](https://github.com/DianaLeoTang/CodeHue) 中反馈。