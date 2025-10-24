import * as vscode from 'vscode';
import axios, { AxiosRequestConfig } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';

// ============ 私有云 AI API 集成 ============

/**
 * 从 .env 文件读取 API Key
 */
function getBuiltinApiKey(): string {
  const COMPILED_KEY = '__BUILTIN_API_KEY_PLACEHOLDER__';
  
  if (COMPILED_KEY !== '__BUILTIN_API_KEY_PLACEHOLDER__') {
    return COMPILED_KEY;
  }
  
  try {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/BUILTIN_API_KEY\s*=\s*(.+)/);
      if (match) {
        return match[1].trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch (error) {
    console.warn('无法读取 .env 文件');
  }
  
  return '';
}

/**
 * 获取 API Key
 */
function getApiKey(): string {
  const config = vscode.workspace.getConfiguration('codehue');
  const fromConfig = (config.get<string>('aiApiKey', '') || '').trim();
  if (fromConfig) return fromConfig;
  
  const fromEnv = (process.env.CODEHUE_API_KEY || '').trim();
  if (fromEnv) return fromEnv;
  
  return getBuiltinApiKey();
}

// 翻译缓存
const translationCache = new Map<string, string>();

// 持久化缓存
let globalStorageUri: vscode.Uri | undefined;

/**
 * 初始化缓存系统
 */
export function initializeCache(context: vscode.ExtensionContext): void {
  globalStorageUri = context.globalStorageUri;
  loadCacheFromDisk();
}

/**
 * 从磁盘加载缓存
 */
async function loadCacheFromDisk(): Promise<void> {
  if (!globalStorageUri) return;
  
  try {
    const cacheFile = vscode.Uri.joinPath(globalStorageUri, 'translation-cache.json');
    const data = await vscode.workspace.fs.readFile(cacheFile);
    const cache = JSON.parse(data.toString());
    
    Object.entries(cache).forEach(([key, value]) => {
      translationCache.set(key, value as string);
    });
    
  } catch (error) {
    // 缓存文件不存在，忽略
  }
}

/**
 * 保存缓存到磁盘
 */
async function saveCacheToDisk(): Promise<void> {
  if (!globalStorageUri) return;
  
  try {
    await vscode.workspace.fs.createDirectory(globalStorageUri);
    const cacheFile = vscode.Uri.joinPath(globalStorageUri, 'translation-cache.json');
    const cache = Object.fromEntries(translationCache);
    await vscode.workspace.fs.writeFile(cacheFile, Buffer.from(JSON.stringify(cache)));
  } catch (error) {
    console.error('保存缓存失败:', error);
  }
}

// 翻译优先级枚举
export enum TranslationPriority {
  VISIBLE_CURRENT_FILE = 0,      // 最高优先级：当前文件可见区域
  INVISIBLE_CURRENT_FILE = 1,    // 中优先级：当前文件不可见区域
  OTHER_OPEN_FILES = 2            // 低优先级：其他打开的文件
}

// 批量翻译队列
interface TranslationTask {
  functionName: string;
  resolve: (value: string) => void;
  reject: (reason: any) => void;
  priority: TranslationPriority;
  documentUri?: string; // 用于追踪来自哪个文件
  timestamp: number;
}

let translationQueue: TranslationTask[] = [];
let processingBatch = false;

// 严格的并发和速率控制
const MAX_CONCURRENT_REQUESTS = 1;
let activeRequests = 0;
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 3000; // 3秒间隔
const BATCH_SIZE = 10;
const MAX_RETRIES = 2;
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 3;

// 全局暂停开关
let translationPaused = false;
let pauseUntil = 0;

/**
 * AI 提供商配置接口
 */
interface AIProviderConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
  headers?: Record<string, string>;
  requestBody?: Record<string, any>;
}

/**
 * 获取 AI 提供商配置
 */
function getAIProviderConfig(): AIProviderConfig {
  const config = vscode.workspace.getConfiguration('codehue');
  
  // 获取用户配置
  let baseUrl = (config.get<string>('aiModelBaseUrl') || '').trim();
  let model = (config.get<string>('aiModelName') || '').trim();
  const apiKey = getApiKey();
  
  // 如果用户没有配置，使用内置默认配置
  if (!baseUrl) {
    baseUrl = 'http://llm-model-hub-apis.sf-express.com/v1/chat/completions';
  }
  
  if (!model) {
    model = 'aiplat/qwen2.5-72b-instruct';
  }
  
  if (!apiKey) {
    throw new Error('请配置 AI API Key');
  }
  
  // 根据不同的提供商调整请求格式
  const normalizedUrl = baseUrl.replace(/\/+$/, '');
  
  // 检测提供商类型并调整配置
  let headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  let requestBody: Record<string, any> = {
    model,
    messages: [
      {
        role: 'system',
        content: '你是一个专业的代码翻译助手。请将英文函数名翻译成简洁的中文语义描述。要求：1) 保持简洁（2-6个字）2) 体现函数的核心功能 3) 使用专业术语'
      },
      {
        role: 'user',
        content: '' // 将在调用时填充
      }
    ],
    temperature: 0.3,
    max_tokens: 300,
    stream: false
  };
  
  // 根据URL特征判断提供商类型
  if (normalizedUrl.includes('openai.com')) {
    // OpenAI 格式
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (normalizedUrl.includes('anthropic.com')) {
    // Claude 格式
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
    requestBody = {
      model,
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: '' // 将在调用时填充
        }
      ]
    };
  } else if (normalizedUrl.includes('dashscope.aliyuncs.com')) {
    // 通义千问格式
    headers['Authorization'] = `Bearer ${apiKey}`;
    requestBody = {
      model,
      input: {
        messages: [
          {
            role: 'system',
            content: '你是一个专业的代码翻译助手。请将英文函数名翻译成简洁的中文语义描述。要求：1) 保持简洁（2-6个字）2) 体现函数的核心功能 3) 使用专业术语'
          },
          {
            role: 'user',
            content: '' // 将在调用时填充
          }
        ]
      },
      parameters: {
        temperature: 0.3,
        max_tokens: 300
      }
    };
  } else if (normalizedUrl.includes('deepseek.com')) {
    // DeepSeek 格式
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (normalizedUrl.includes('moonshot.cn')) {
    // Kimi 格式
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (normalizedUrl.includes('generativelanguage.googleapis.com')) {
    // Gemini 格式
    headers['x-goog-api-key'] = apiKey;
    requestBody = {
      contents: [
        {
          parts: [
            {
              text: '' // 将在调用时填充
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 300
      }
    };
  } else {
    // 默认格式（兼容大多数 OpenAI 兼容的 API）
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  
  return {
    baseUrl: normalizedUrl,
    model,
    apiKey,
    headers,
    requestBody
  };
}

/**
 * 批量翻译函数
 */
async function translateBatch(functionNames: string[], retryCount: number = 0): Promise<Map<string, string>> {
  const aiConfig = getAIProviderConfig();

  // 检查是否暂停
  if (translationPaused) {
    const now = Date.now();
    if (now < pauseUntil) {
      const remainingSeconds = Math.ceil((pauseUntil - now) / 1000);
      throw new Error(`翻译服务暂停中，还需等待 ${remainingSeconds} 秒`);
    } else {
      translationPaused = false;
      consecutiveErrors = 0;
    }
  }

  // 严格的请求间隔控制
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  lastRequestTime = Date.now();

  const functionList = functionNames.map((name, idx) => `${idx + 1}. ${name}`).join('\n');
  const userContent = `请将以下函数名翻译成中文，按序号返回，格式为"序号. 中文翻译"：\n\n${functionList}\n\n只返回翻译结果，每行一个，不要任何解释。`;
  
  try {
    const axiosConfig: AxiosRequestConfig = {
      headers: aiConfig.headers,
      timeout: 60000
    };

    const isProxyEnabled = Boolean(
      process.env.HTTP_PROXY ||
      process.env.HTTPS_PROXY ||
      process.env.http_proxy ||
      process.env.https_proxy
    );

    if (!isProxyEnabled) {
      axiosConfig.httpAgent = new http.Agent({
        keepAlive: false,
        keepAliveMsecs: 30000,
        maxSockets: 5
      });
      axiosConfig.httpsAgent = new https.Agent({
        keepAlive: false,
        keepAliveMsecs: 30000,
        maxSockets: 5
      });
    }

    // 根据不同的提供商构建请求体
    let requestBody: any;
    
    if (aiConfig.baseUrl.includes('anthropic.com')) {
      // Claude 格式
      requestBody = {
        ...aiConfig.requestBody,
        messages: [
          {
            role: 'user',
            content: userContent
          }
        ]
      };
    } else if (aiConfig.baseUrl.includes('dashscope.aliyuncs.com')) {
      // 通义千问格式
      requestBody = {
        ...aiConfig.requestBody,
        input: {
          ...(aiConfig.requestBody?.input || {}),
          messages: [
            {
              role: 'system',
              content: '你是一个专业的代码翻译助手。请将英文函数名翻译成简洁的中文语义描述。要求：1) 保持简洁（2-6个字）2) 体现函数的核心功能 3) 使用专业术语'
            },
            {
              role: 'user',
              content: userContent
            }
          ]
        }
      };
    } else if (aiConfig.baseUrl.includes('generativelanguage.googleapis.com')) {
      // Gemini 格式
      requestBody = {
        ...aiConfig.requestBody,
        contents: [
          {
            parts: [
              {
                text: userContent
              }
            ]
          }
        ]
      };
    } else {
      // 默认 OpenAI 兼容格式
      requestBody = {
        ...aiConfig.requestBody,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的代码翻译助手。请将英文函数名翻译成简洁的中文语义描述。要求：1) 保持简洁（2-6个字）2) 体现函数的核心功能 3) 使用专业术语'
          },
          {
            role: 'user',
            content: userContent
          }
        ]
      };
    }

    const response = await axios.post(
      aiConfig.baseUrl,
      requestBody,
      axiosConfig
    );

    // 根据不同的提供商解析响应
    let content = '';
    
    if (aiConfig.baseUrl.includes('anthropic.com')) {
      // Claude 响应格式
      content = response.data.content?.[0]?.text?.trim() || '';
    } else if (aiConfig.baseUrl.includes('dashscope.aliyuncs.com')) {
      // 通义千问响应格式
      content = response.data.output?.text?.trim() || '';
    } else if (aiConfig.baseUrl.includes('generativelanguage.googleapis.com')) {
      // Gemini 响应格式
      content = response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    } else {
      // 默认 OpenAI 兼容格式
      content = response.data.choices?.[0]?.message?.content?.trim() || '';
    }
    
    const lines = content.split('\n').filter((l: string) => l.trim());
    
    const results = new Map<string, string>();
    
    lines.forEach((line: string, idx: number) => {
      if (idx < functionNames.length) {
        const match = line.match(/^\d+\.\s*(.+)$/);
        const translation = match ? match[1].trim() : line.trim();
        
        const cleaned = translation
          .replace(/^["'「『]|["'」』]$/g, '')
          .replace(/^翻译结果[：:]\s*/i, '')
          .replace(/^中文[：:]\s*/i, '')
          .trim();
        
        results.set(functionNames[idx], cleaned || functionNames[idx]);
      }
    });
    
    functionNames.forEach(name => {
      if (!results.has(name)) {
        results.set(name, name);
      }
    });
    
    consecutiveErrors = 0;
    
    return results;
  } catch (error: any) {
    consecutiveErrors++;
    
    if (error.response?.status === 429) {
      const waitTime = 60000;
      console.warn(`⚠ 触发速率限制（429），暂停翻译 ${waitTime / 1000} 秒`);
      
      translationPaused = true;
      pauseUntil = Date.now() + waitTime;
      
      if (retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
        translationPaused = false;
        return translateBatch(functionNames, retryCount + 1);
      }
    }
    
    if (error.code === 'ECONNRESET' || error.message?.includes('socket hang up')) {
      if (retryCount < MAX_RETRIES) {
        const waitTime = 10000 * Math.pow(3, retryCount);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return translateBatch(functionNames, retryCount + 1);
      }
    }
    
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      translationPaused = true;
      pauseUntil = Date.now() + 60000;
      console.error(`✗ 连续失败 ${consecutiveErrors} 次，翻译服务暂停1分钟`);
    }
    
    console.error(`✗ 批量翻译失败（重试 ${retryCount}/${MAX_RETRIES}）: ${error.message}`);
    throw error;
  }
}

/**
 * 处理翻译队列 - 按优先级分层处理
 */
async function processBatchQueue(): Promise<void> {
  if (processingBatch || translationQueue.length === 0) {
    return;
  }

  processingBatch = true;

  try {
    while (translationQueue.length > 0) {
      // 检查是否暂停
      if (translationPaused && Date.now() < pauseUntil) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      // 等待并发槽位
      while (activeRequests >= MAX_CONCURRENT_REQUESTS) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // 清理过期任务（超过60秒的任务）
      const now = Date.now();
      translationQueue = translationQueue.filter(task => now - task.timestamp < 60000);

      if (translationQueue.length === 0) {
        break;
      }

      // 按优先级排序（0 > 1 > 2）
      translationQueue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return a.timestamp - b.timestamp;
      });

      // 获取当前最高优先级
      const highestPriority = translationQueue[0].priority;
      
      // 只处理最高优先级的任务
      const samePriorityTasks = translationQueue.filter(task => task.priority === highestPriority);
      const batchSize = Math.min(BATCH_SIZE, samePriorityTasks.length);
      const batch = translationQueue.splice(0, batchSize);
      
      const functionNames = batch.map(task => task.functionName);
      
      
      activeRequests++;

      try {
        const results = await translateBatch(functionNames);
        
        batch.forEach(task => {
          const translation = results.get(task.functionName) || task.functionName;
          translationCache.set(task.functionName, translation);
          task.resolve(translation);
        });

        // 定期保存缓存
        if (translationCache.size % 20 === 0) {
          saveCacheToDisk();
        }
        
        // 优先级0（可见区域）完成后立即触发刷新
        if (highestPriority === TranslationPriority.VISIBLE_CURRENT_FILE && onTranslationComplete) {
          onTranslationComplete();
        }
        
      } catch (error) {
        batch.forEach(task => {
          translationCache.set(task.functionName, task.functionName);
          task.resolve(task.functionName);
        });
      } finally {
        activeRequests--;
      }

      // 批次间延迟
      if (translationQueue.length > 0) {
        // 如果下一批是低优先级，增加延迟
        const nextPriority = translationQueue[0]?.priority;
        if (nextPriority > highestPriority) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
  } finally {
    processingBatch = false;
    await saveCacheToDisk();
  }
}

/**
 * 队列化翻译请求
 */
async function translateWithAI(
  functionName: string, 
  priority: TranslationPriority = TranslationPriority.OTHER_OPEN_FILES,
  documentUri?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    // 检查队列中是否已有相同请求
    const existing = translationQueue.find(task => task.functionName === functionName);
    if (existing) {
      // 如果新请求优先级更高，更新优先级
      if (priority < existing.priority) {
        existing.priority = priority;
        existing.timestamp = Date.now(); // 更新时间戳
      }
      return; // 已在队列中
    }

    translationQueue.push({
      functionName,
      resolve,
      reject,
      priority,
      documentUri,
      timestamp: Date.now()
    });

    // 限制队列长度
    if (translationQueue.length > 200) {
      console.warn('⚠ 翻译队列过长，清理低优先级任务');
      translationQueue = translationQueue
        .sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority;
          return a.timestamp - b.timestamp;
        })
        .slice(0, 100);
    }

    processBatchQueue();
  });
}

/**
 * 异步翻译函数
 */
export async function translateFunctionNameToChinese(
  functionName: string, 
  priority: TranslationPriority = TranslationPriority.OTHER_OPEN_FILES,
  documentUri?: string
): Promise<string> {
  if (!functionName || functionName === 'anonymous') {
    return '匿名函数';
  }

  const cached = translationCache.get(functionName);
  if (cached) {
    return cached;
  }

  const config = vscode.workspace.getConfiguration('codehue');
  const enableAI = config.get<boolean>('enableAITranslation', true);

  if (!enableAI) {
    return functionName;
  }

  try {
    const translation = await translateWithAI(functionName, priority, documentUri);
    return translation;
  } catch (error) {
    return functionName;
  }
}

// 回调函数
let onTranslationComplete: (() => void) | undefined;

export function setTranslationCompleteCallback(callback: () => void): void {
  onTranslationComplete = callback;
}

/**
 * 同步翻译函数 - 支持优先级参数
 */
export function translateFunctionNameToChineseSync(
  functionName: string, 
  priority: TranslationPriority = TranslationPriority.OTHER_OPEN_FILES,
  documentUri?: string
): string {
  if (!functionName || functionName === 'anonymous') {
    return '匿名函数';
  }

  const cached = translationCache.get(functionName);
  if (cached) {
    return cached;
  }

  const config = vscode.workspace.getConfiguration('codehue');
  const enableAI = config.get<boolean>('enableAITranslation', true);

  if (enableAI && !translationPaused) {
    translateFunctionNameToChinese(functionName, priority, documentUri).then(result => {
      if (priority === TranslationPriority.VISIBLE_CURRENT_FILE && onTranslationComplete) {
        onTranslationComplete();
      }
    }).catch(() => {});
  }

  return functionName;
}

/**
 * 提取函数标签 - 支持优先级参数
 */
export function extractFunctionLabel(
  doc: vscode.TextDocument, 
  startLine: number, 
  priority: TranslationPriority = TranslationPriority.OTHER_OPEN_FILES
): string {
  const l1 = doc.lineAt(startLine).text.trim();
  const l2 = startLine + 1 < doc.lineCount ? doc.lineAt(startLine + 1).text.trim() : '';
  const s = `${l1} ${l2}`;

  let functionName = '';

  // Hook 变量赋值
  let hookVarMatch = s.match(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:React\.)?(use[A-Z]\w*)\s*\(/);
  if (hookVarMatch) {
    functionName = hookVarMatch[1];
  }
  
  if (!functionName && startLine > 0) {
    const prevLine = doc.lineAt(startLine - 1).text.trim();
    const prevHookMatch = prevLine.match(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:React\.)?(use[A-Z]\w*)\s*\(/);
    if (prevHookMatch) {
      functionName = prevHookMatch[1];
    }
  }
  
  if (functionName) {
    return translateFunctionNameToChineseSync(
      functionName, 
      priority !== undefined ? priority : TranslationPriority.INVISIBLE_CURRENT_FILE,
      doc.uri.toString()
    );
  }

  // 直接 Hook 调用
  const directHookMatch = s.match(/(?:^|\s)(?:React\.)?(useEffect|useState|useMemo|useCallback|useRef|useReducer|useLayoutEffect|useContext|useImperativeHandle|useDebugValue|useDeferredValue|useTransition|useId|useSyncExternalStore|useInsertionEffect)\s*\(/);
  if (directHookMatch) {
    // 额外检查：确保不是对象方法调用
    const beforeHook = s.substring(0, s.indexOf(directHookMatch[1]));
    if (beforeHook.includes('.')) {
      // 跳过对象方法调用
    } else {
      const HOOK_LABELS: Record<string, string> = {
        useEffect: '副作用处理',
        useState: '状态管理',
        useMemo: '记忆化计算',
        useCallback: '回调记忆',
        useRef: '引用持久化',
        useReducer: '状态归约',
        useLayoutEffect: '布局副作用',
        useContext: '上下文读取',
        useImperativeHandle: '暴露实例方法',
        useDebugValue: '调试标记',
        useDeferredValue: '延迟值',
        useTransition: '并发过渡',
        useId: '稳定ID',
        useSyncExternalStore: '外部存储同步',
        useInsertionEffect: '样式插入副作用',
      };
      return HOOK_LABELS[directHookMatch[1]] || 'Hook 调用';
    }
  }

  // 其他函数匹配
  if (!functionName) {
    let m = s.match(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/);
    if (m) functionName = m[1];
  }

  if (!functionName) {
    let m = s.match(/\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s+)?(?:<[^>]*>\s*)?\([^)]*\)\s*(?::\s*[^=>]+)?\s*=>/);
    if (m) functionName = m[1];
  }

  if (!functionName) {
    let m = s.match(/\b([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s+)?(?:<[^>]*>\s*)?\([^)]*\)\s*(?::\s*[^=>]+)?\s*=>/);
    if (m) functionName = m[1];
  }

  if (!functionName) {
    let m = s.match(/[=:\)]\s*=>/);
    if (m) functionName = 'anonymous';
  }

  if (!functionName) {
    let m = s.match(/^(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/);
    if (m) functionName = m[1];
  }

  if (!functionName) {
    let m = s.match(/[:,]\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/);
    if (m) functionName = m[1];
  }

  if (!functionName && startLine > 0) {
    const prevLine = doc.lineAt(startLine - 1).text.trim();
    const combined = `${prevLine} ${l1}`;
    let m = combined.match(/\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s+)?(?:<[^>]*>\s*)?\([^)]*\)\s*(?::\s*[^=>]+)?\s*=>/);
    if (m) functionName = m[1];
  }

  if (!functionName) {
    return '匿名函数';
  }

  return translateFunctionNameToChineseSync(
    functionName, 
    priority !== undefined ? priority : TranslationPriority.INVISIBLE_CURRENT_FILE,
    doc.uri.toString()
  );
}

/**
 * 清空缓存
 */
export function clearTranslationCache(): void {
  translationCache.clear();
  translationQueue = [];
  saveCacheToDisk();
}

/**
 * 获取队列统计信息（用于调试）
 */
export function getQueueStats(): { total: number; byPriority: Record<number, number> } {
  const stats = {
    total: translationQueue.length,
    byPriority: {
      [TranslationPriority.VISIBLE_CURRENT_FILE]: 0,
      [TranslationPriority.INVISIBLE_CURRENT_FILE]: 0,
      [TranslationPriority.OTHER_OPEN_FILES]: 0
    }
  };
  
  translationQueue.forEach(task => {
    stats.byPriority[task.priority]++;
  });
  
  return stats;
}
/**
 * 根据文档和行号自动判断优先级
 */
export function extractFunctionLabelAuto(
  doc: vscode.TextDocument, 
  startLine: number
): string {
  // 获取当前活动编辑器
  const activeEditor = vscode.window.activeTextEditor;
  
  let priority = TranslationPriority.OTHER_OPEN_FILES;
  
  if (activeEditor) {
    // 判断是否是当前文件
    if (activeEditor.document.uri.toString() === doc.uri.toString()) {
      // 判断是否在可见区域
      const isVisible = activeEditor.visibleRanges.some(range => 
        startLine >= range.start.line && startLine <= range.end.line
      );
      
      if (isVisible) {
        priority = TranslationPriority.VISIBLE_CURRENT_FILE;
      } else {
        priority = TranslationPriority.INVISIBLE_CURRENT_FILE;
      }
    }
  }
  
  return extractFunctionLabel(doc, startLine, priority);
}
/**
 * 批量翻译文档中的所有函数名
 */
export async function translateDocumentFunctions(
  doc: vscode.TextDocument,
  functionRanges: Array<{ line: number; functionName: string }>,
  isActiveDocument: boolean = false
): Promise<void> {
  const activeEditor = vscode.window.activeTextEditor;
  const visibleRanges = activeEditor?.visibleRanges || [];
  
  // 分类函数：可见 vs 不可见
  const visibleFunctions: string[] = [];
  const invisibleFunctions: string[] = [];
  const otherFileFunctions: string[] = [];
  
  functionRanges.forEach(({ line, functionName }) => {
    if (functionName === 'anonymous' || !functionName) return;
    
    // 已经在缓存中，跳过
    if (translationCache.has(functionName)) return;
    
    if (isActiveDocument) {
      // 判断是否在可见区域
      const isVisible = visibleRanges.some(range => 
        line >= range.start.line && line <= range.end.line
      );
      
      if (isVisible) {
        visibleFunctions.push(functionName);
      } else {
        invisibleFunctions.push(functionName);
      }
    } else {
      otherFileFunctions.push(functionName);
    }
  });
  
  // 按优先级依次请求翻译
  const promises: Promise<string>[] = [];
  
  // 1. 可见区域（最高优先级）
  visibleFunctions.forEach(name => {
    promises.push(translateFunctionNameToChinese(
      name, 
      TranslationPriority.VISIBLE_CURRENT_FILE, 
      doc.uri.toString()
    ));
  });
  
  // 2. 当前文件不可见区域
  invisibleFunctions.forEach(name => {
    promises.push(translateFunctionNameToChinese(
      name, 
      TranslationPriority.INVISIBLE_CURRENT_FILE, 
      doc.uri.toString()
    ));
  });
  
  // 3. 其他文件
  otherFileFunctions.forEach(name => {
    promises.push(translateFunctionNameToChinese(
      name, 
      TranslationPriority.OTHER_OPEN_FILES, 
      doc.uri.toString()
    ));
  });
  
  // 等待所有翻译完成（后台异步）
  Promise.all(promises).catch(err => {
    console.error('批量翻译出错:', err);
  });
}
