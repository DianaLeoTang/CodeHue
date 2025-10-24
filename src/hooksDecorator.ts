import * as vscode from 'vscode';
import { onExclusionRanges } from './exclusionBus';
import { COLOR_SCHEMES_LIGHT, COLOR_SCHEMES_DARK } from './colorSchemes';

let suppressRanges: vscode.Range[] = [];
onExclusionRanges((rs) => { suppressRanges = rs; });

/** 颜色条缓存：不同颜色 → 独立 DecorationType */
const stripeTypeCache = new Map<string, vscode.TextEditorDecorationType>();

/** 行尾中文语义化注释 */
const annotationType = vscode.window.createTextEditorDecorationType({
  isWholeLine: false,
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  after: {
    margin: '0 0 0 8px',
    color: new vscode.ThemeColor('editorCodeLens.foreground'),
  },
});

/** Hook 和 Region 识别缓存 */
const itemCache = new Map<string, { items: DecoratedItem[]; version: number }>();

/** 防重复执行标志 */
let isApplyingDecorations = false;

interface DecoratedItem {
  range: vscode.Range;
  type: HookKeyword | 'region';
  lineContent: string;
}

/** React Hooks 列表 */
const HOOK_KEYWORDS = [
  'useState', 
  'useEffect', 
  'useMemo', 
  'useCallback',
  'useRef',
  'useContext',
  'useReducer',
  'useLayoutEffect',
  'useImperativeHandle',
  'useDebugValue',
  'useDeferredValue',
  'useTransition',
  'useId',
  'useSyncExternalStore',
  'useInsertionEffect'
] as const;
type HookKeyword = typeof HOOK_KEYWORDS[number];

/**
 * 检测当前主题是否为暗色
 */
function isDarkTheme(): boolean {
  const themeKind = vscode.window.activeColorTheme.kind;
  return themeKind === vscode.ColorThemeKind.Dark || themeKind === vscode.ColorThemeKind.HighContrast;
}

/**
 * 获取当前配置的颜色方案（合并自定义颜色）
 */
function getColorScheme(): Record<string, string> {
  const config = vscode.workspace.getConfiguration('codehue');
  const schemeName = config.get<string>('colorScheme', 'vibrant');
  const schemes = isDarkTheme() ? COLOR_SCHEMES_DARK : COLOR_SCHEMES_LIGHT;
  const baseScheme = schemes[schemeName] || schemes.vibrant;
  
  // 获取用户自定义颜色配置（JSON 数组格式）
  const customHookColors = config.get<Array<{tag: string, color: string}>>('customHookColors', []);
  
  // 合并自定义颜色（自定义颜色优先级更高）
  const mergedScheme: Record<string, string> = { ...baseScheme };
  
  // 应用自定义颜色（如果设置了的话）
  for (const hookConfig of customHookColors) {
    if (hookConfig.tag && hookConfig.color && hookConfig.color.trim() !== '') {
      mergedScheme[hookConfig.tag.toLowerCase()] = hookConfig.color;
    }
  }
  
  return mergedScheme;
}

/**
 * 获取背景色装饰
 */
function getBackgroundDecoration(color: string): vscode.TextEditorDecorationType {
  const cacheKey = `${color}-bg`;

  if (stripeTypeCache.has(cacheKey)) {
    return stripeTypeCache.get(cacheKey)!;
  }

  const dt = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: color,
    overviewRulerColor: color,
    overviewRulerLane: vscode.OverviewRulerLane.Left,
  });

  stripeTypeCache.set(cacheKey, dt);
  return dt;
}

/**
 * 严格检测 Hook 调用
 * 确保是真正的 React Hook，不是对象方法或类型定义
 */
function detectHookCall(text: string): HookKeyword | undefined {
  // --- 步骤 1: 文本归一化 ---
  const normalized = text
    .split('\n')
    .map(line => {
      // 移除行注释后的内容
      const commentIndex = line.indexOf('//');
      return commentIndex !== -1 ? line.substring(0, commentIndex) : line;
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized.length === 0) {
      return undefined;
  }

  // --- 步骤 2: 遍历所有 Hook 并匹配 ---
  for (const hook of HOOK_KEYWORDS) {
    let pattern: RegExp;

    // --- 针对 useEffect 的专属宽松规则 ---
    if (hook === 'useEffect') {
      /*
       * useEffect 专属规则：
       * 匹配：(行首 或 非点号前缀) 后面跟着 零个或多个空白/分号，然后是 HookName(
       */
      // pattern = new RegExp(
      //   // 确保前面不是点号或在行首，且后面可能有空白（代表语句分隔）
      //   `(?:^|[^.])` +                                  
      //   `\\s*` +                                       // 零个或多个 空白 (归一化后的换行/空格/制表符)
      //   `(?:React\\.)?` +                              // 可选 React.
      //   `(${hook})` +                                  // Hook 名称
      //   `\\s*(?:<[^>]*>)?\\s*\\(`,                     // 可选泛型和开括号
      //   'i' 
      // )
      pattern = new RegExp(
        `(?:^|[^a-zA-Z0-9_$.]|[;,{\\(\\[])` +     // 确保前面是语句边界
        `\\s*` +                                   // 可选空白
        `(?:React\\.)?` +                          // 可选 React.
        `(useEffect)` +                            // Hook 名称
        `\\s*(?:<[^>]*>)?` +                       // 可选泛型
        `\\s*\\(` +                                // 开括号
        `\\s*(?:async\\s+)?` +                     // 可选 async
        `(?:(?:function|\\(|\\w+\\s*=>))`,         // 函数开始标志
        'i'
      );
    } 
    // --- 针对 useState, useMemo, useCallback 的增强规则 (包含赋值解构) ---
    else {
      // 其他 Hooks 的通用模式
      pattern = new RegExp(
        `(?:^|[^a-zA-Z0-9_$.]|[;,{=])` +           // 确保前面不是标识符的一部分
        `\\s*` +                                    // 可选空白
        `(?:const|let|var)?` +                     // 可选变量声明
        `\\s*` +                                    // 可选空白
        `(?:\\[?[\\w,\\s]*\\]?)?` +                // 可选解构
        `\\s*=?\\s*` +                             // 可选赋值
        `(?:React\\.)?` +                          // 可选 React.
        `(${hook})` +                              // Hook 名称
        `\\s*(?:<[^>]*>)?\\s*\\(`,                 // 可选泛型和开括号
        'i'
      );
    }
    
    // --- 步骤 3: 尝试匹配 ---
    const match = normalized.match(pattern);
    if (match) {
        return hook as HookKeyword;
    }
  }

  return undefined;
}

/**
 * 检查某行是否是 Hook 调用 (增强版)
 * 返回 { hook: HookKeyword, actualLine: number } 或 undefined
 */
function isHookCallLine(doc: vscode.TextDocument, lineIndex: number): { hook: HookKeyword; actualLine: number } | undefined {
  const line = doc.lineAt(lineIndex).text;

  // 1. 直接检查当前行
  let hook = detectHookCall(line);
  if (hook) {
    return { hook, actualLine: lineIndex };
  }

  // 2. 检查跨行情况：合并当前行和接下来的几行
  // useEffect 经常跨多行，所以需要多看几行
  const maxLookAhead = 3; // 最多向前看3行
  
  for (let offset = 1; offset <= maxLookAhead && lineIndex + offset < doc.lineCount; offset++) {
    const lines: string[] = [line];
    
    for (let i = 1; i <= offset; i++) {
      lines.push(doc.lineAt(lineIndex + i).text);
    }
    
    const combined = lines.join(' ');
    hook = detectHookCall(combined);

    if (hook) {
      // 找到 Hook 在合并文本中的位置
      const hookIndex = combined.toLowerCase().indexOf(hook.toLowerCase());
      
      // 计算 Hook 实际在哪一行
      let currentPos = 0;
      let actualLine = lineIndex;
      
      for (let i = 0; i < lines.length; i++) {
        const lineLength = lines[i].length + 1; // +1 for the space we added
        if (hookIndex < currentPos + lineLength) {
          actualLine = lineIndex + i;
          break;
        }
        currentPos += lineLength;
      }
      
      return { hook, actualLine };
    }
  }

  return undefined;
}

/**
 * 计算 Hook 调用的范围（从 Hook 名称开始到闭括号）
 */
function getHookCallRange(doc: vscode.TextDocument, startLine: number, hookName: string): vscode.Range | null {
  let line = startLine;
  let text = doc.lineAt(line).text;

  // 首先找到 Hook 名称的位置
  let hookPos = text.toLowerCase().indexOf(hookName.toLowerCase());
  let hookLine = line;
  
  // 如果当前行没有找到 Hook，向前查找
  while (hookPos === -1 && hookLine < doc.lineCount - 1) {
    hookLine++;
    text = doc.lineAt(hookLine).text;
    hookPos = text.toLowerCase().indexOf(hookName.toLowerCase());
  }

  if (hookPos === -1) return null;

  // 从 Hook 名称开始查找第一个 (
  let parenPos = text.indexOf('(', hookPos);
  while (parenPos === -1 && hookLine < doc.lineCount - 1) {
    hookLine++;
    text = doc.lineAt(hookLine).text;
    parenPos = text.indexOf('(');
  }

  if (parenPos === -1) return null;

  // 从这个 ( 开始计数，找到匹配的 )
  let openCount = 0;
  let currentLine = hookLine;
  let currentPos = parenPos;

  while (currentLine < doc.lineCount) {
    const lineText = doc.lineAt(currentLine).text;

    for (let i = currentPos; i < lineText.length; i++) {
      if (lineText[i] === '(') {
        openCount++;
      } else if (lineText[i] === ')') {
        openCount--;
        if (openCount === 0) {
          // 找到了匹配的闭括号
          return new vscode.Range(
            new vscode.Position(hookLine, hookPos),
            new vscode.Position(currentLine, i + 1)
          );
        }
      }
    }

    currentLine++;
    currentPos = 0;
  }

  return null;
}

/**
 * 识别所有 Hooks 和 Regions
 */
function findHooksAndRegions(doc: vscode.TextDocument): DecoratedItem[] {
  const items: DecoratedItem[] = [];
  const processed = new Set<number>();

  for (let i = 0; i < doc.lineCount; i++) {
    if (processed.has(i)) continue;

    const line = doc.lineAt(i).text;
    const trimmed = line.trim();

    // ===== 检测 React Hooks =====
    const hookResult = isHookCallLine(doc, i);
    if (hookResult) {
      const { hook, actualLine } = hookResult;
      const range = getHookCallRange(doc, actualLine, hook);
      if (range) {
        
        // 检查是否在排除区域内
        const isInSuppressedRange = suppressRanges.some(suppressRange => {
          return !(range.end.isBefore(suppressRange.start) || range.start.isAfter(suppressRange.end));
        });

        if (!isInSuppressedRange) {
          items.push({
            range,
            type: hook,
            lineContent: trimmed,
          });
        }

        // 标记已处理的行
        for (let j = range.start.line; j <= range.end.line; j++) {
          processed.add(j);
        }
      }
      continue;
    }

    // ===== 检测 Region =====
    if (/#region\b/.test(trimmed)) {
      let endLine = -1;

      // 查找匹配的 #endregion
      for (let j = i + 1; j < doc.lineCount; j++) {
        if (/#endregion\b/.test(doc.lineAt(j).text.trim())) {
          endLine = j;
          break;
        }
      }

      if (endLine !== -1) {
        const range = new vscode.Range(
          new vscode.Position(i, 0),
          new vscode.Position(endLine, doc.lineAt(endLine).text.length)
        );

        items.push({
          range,
          type: 'region',
          lineContent: trimmed,
        });

        // 标记已处理的行
        for (let j = i; j <= endLine; j++) {
          processed.add(j);
        }

        i = endLine;
      }
    }
  }

  return items;
}

/**
 * 获取 Hook 的中文标签
 */
function getHookChineseLabel(hookType: string): string {
  const labels: Record<string, string> = {
    'useState': '状态管理',
    'useEffect': '副作用处理',
    'useMemo': '记忆化计算',
    'useCallback': '记忆回调',
    'useRef': '引用管理',
    'useContext': '上下文消费',
    'useReducer': '状态管理',
    'useLayoutEffect': '布局副作用',
    'useImperativeHandle': '命令式句柄',
    'useDebugValue': '调试值',
    'useDeferredValue': '延迟值',
    'useTransition': '过渡状态',
    'useId': '唯一标识',
    'useSyncExternalStore': '外部同步',
    'useInsertionEffect': '插入副作用',
    'region': '区域',
  };

  return labels[hookType] || hookType;
}

/**
 * 应用 Hooks 和 Regions 的装饰
 */
export function applyHooksAndRegionsDecorations(editor: vscode.TextEditor): void {
  // 防重复执行
  if (isApplyingDecorations) {
    return;
  }
  
  isApplyingDecorations = true;
  
  try {
    const doc = editor.document;

    // 性能检查
    if (doc.lineCount > 10000) {
      return;
    }

  // 获取缓存或计算
  const docUri = doc.uri.toString();
  const docVersion = doc.version;

  let items: DecoratedItem[] = [];

  const cached = itemCache.get(docUri);
  if (cached && cached.version === docVersion) {
    items = cached.items;
  } else {
    items = findHooksAndRegions(doc);
    itemCache.set(docUri, { items, version: docVersion });

    // 限制缓存大小
    if (itemCache.size > 50) {
      const firstKey = itemCache.keys().next().value;
      if (firstKey) itemCache.delete(firstKey);
    }
  }

  // 清除旧装饰
  stripeTypeCache.forEach((dt) => editor.setDecorations(dt, []));
  // 清除旧的注释装饰
  editor.setDecorations(annotationType, []);

  // 按类型分组并应用颜色
  const groups = new Map<string, vscode.Range[]>();
  const colorScheme = getColorScheme();

  for (const item of items) {
    if (!groups.has(item.type)) {
      groups.set(item.type, []);
    }
    groups.get(item.type)!.push(item.range);
  }

  for (const [type, ranges] of groups) {
    // 将 Hook 类型转换为小写以匹配颜色配置
    const colorKey = type.toLowerCase();
    const color = colorScheme[colorKey] || colorScheme['default'];
    const dt = getBackgroundDecoration(color);
    editor.setDecorations(dt, ranges);
  }

  // 应用中文语义注释
  const config = vscode.workspace.getConfiguration('codehue');
  const enableSemanticComments = config.get<boolean>('enableSemanticComments', true);

  const annotations: vscode.DecorationOptions[] = [];

  if (enableSemanticComments) {
    // 使用 Map 来去重，key 为 "行号:位置"
    const annotationMap = new Map<string, string>();
    
    for (const item of items) {
      if (item.type === 'region') continue;  // region 不需要额外注释

      const line = item.range.start.line;
      const chineseLabel = getHookChineseLabel(item.type);

      // 在前一行的末尾添加注释
      const targetLine = line > 0 ? line - 1 : line;
      const targetPos = doc.lineAt(targetLine).range.end;
      
      // 使用行号和位置作为唯一标识
      const key = `${targetLine}:${targetPos.character}`;
      
      // 如果已经存在注释，则合并（或者跳过重复）
      if (!annotationMap.has(key)) {
        annotationMap.set(key, chineseLabel);
      }
    }
    
    // 根据去重后的 Map 生成注释
    for (const [key, label] of annotationMap) {
      const [lineStr, charStr] = key.split(':');
      const line = parseInt(lineStr);
      const char = parseInt(charStr);
      const targetPos = new vscode.Position(line, char);
      
      annotations.push({
        range: new vscode.Range(targetPos, targetPos),
        renderOptions: {
          after: {
            contentText: ` // ${label}`,
          },
        },
      });
    }
  }

  editor.setDecorations(annotationType, annotations);
  
  } finally {
    isApplyingDecorations = false;
  }
}

/**
 * 刷新装饰
 */
export function refreshFunctionDecorations(): void {
  // 触发重新计算
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    applyHooksAndRegionsDecorations(editor);
  }
}

/**
 * 清理资源
 */
export function disposeFunctionDecorations(): void {
  stripeTypeCache.forEach((dt) => dt.dispose());
  stripeTypeCache.clear();
  itemCache.clear();
}

/**
 * 添加函数注释
 * 为找到的每个 Hook 添加注释
 */
export function addFunctionComments(editor: vscode.TextEditor): void {
  const doc = editor.document;
  const edit = new vscode.WorkspaceEdit();

  const items = findHooksAndRegions(doc);
  let addedComments = 0;

  for (const item of items) {
    if (item.type === 'region') continue;

    const line = item.range.start.line;
    const hasComment = line > 0 && (
      doc.lineAt(line - 1).text.trim().startsWith('//')
    );

    if (!hasComment) {
      const chineseLabel = getHookChineseLabel(item.type);
      const comment = `// ${chineseLabel}\n`;
      const insertPosition = new vscode.Position(line, 0);
      edit.insert(doc.uri, insertPosition, comment);
      addedComments++;
    }
  }

  if (edit.size > 0) {
    vscode.workspace.applyEdit(edit);
    vscode.window.showInformationMessage(`为 ${addedComments} 个 Hook 添加了注释`);
  } else {
    vscode.window.showInformationMessage('没有找到需要添加注释的 Hook');
  }
}

/**
 * 获取当前文件中所有的 Hooks 和 Regions
 * 用于其他扩展功能
 */
export function getHooksAndRegions(doc: vscode.TextDocument): DecoratedItem[] {
  return findHooksAndRegions(doc);
}