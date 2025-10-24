import * as vscode from 'vscode';
import { onExclusionRanges } from './exclusionBus';
import { extractFunctionLabel, translateFunctionNameToChinese, translateFunctionNameToChineseSync,TranslationPriority } from './semanticTranslator';
import { COLOR_SCHEMES_LIGHT, COLOR_SCHEMES_DARK } from './colorSchemes';

let suppressRanges: vscode.Range[] = [];
onExclusionRanges((rs) => { suppressRanges = rs; });

/** 颜色条缓存：不同颜色 → 独立 DecorationType（只画左侧） */
const stripeTypeCache = new Map<string, vscode.TextEditorDecorationType>();
/** 行尾中文语义化注释（虚拟文本，不改源码） */
const annotationType = vscode.window.createTextEditorDecorationType({
  isWholeLine: false,
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  after: {
    margin: '0 0 0 8px',
    color: new vscode.ThemeColor('editorCodeLens.foreground'), // 跟随主题
  },
});

/** 函数解析缓存：文档URI → 解析结果 */
const functionCache = new Map<string, { ranges: vscode.Range[], version: number }>();

// 获取左侧条纹装饰
function getLeftStripeDecoration(color: string) {
  const config = vscode.workspace.getConfiguration('codehue');
  const stripeWidth = config.get<string>('stripeWidth', '3px');
  const cacheKey = `${color}-${stripeWidth}`;
  
  if (stripeTypeCache.has(cacheKey)) return stripeTypeCache.get(cacheKey)!;
  const dt = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    borderStyle: 'solid',
    borderColor: color,
    borderWidth: `0 0 0 ${stripeWidth}`,
    overviewRulerColor: color,
    overviewRulerLane: vscode.OverviewRulerLane.Left,
  });
  stripeTypeCache.set(cacheKey, dt);
  return dt;
}


/** 检测当前主题是否为暗色 */
function isDarkTheme(): boolean {
  const themeKind = vscode.window.activeColorTheme.kind;
  return themeKind === vscode.ColorThemeKind.Dark || themeKind === vscode.ColorThemeKind.HighContrast;
}

/** 获取当前配置的颜色方案（根据主题自动适配） */
function getColorScheme(): Record<string, string> {
  const config = vscode.workspace.getConfiguration('codehue');
  const schemeName = config.get<string>('colorScheme', 'vibrant');
  const schemes = isDarkTheme() ? COLOR_SCHEMES_DARK : COLOR_SCHEMES_LIGHT;
  return schemes[schemeName] || schemes.vibrant;
}
/**
 * 核心优化点:
 * 1. 统一的排除区域管理(Hook内部、Region、JSX)
 * 2. 更精确的函数边界检测
 * 3. 改进的类型定义过滤
 */

// ===== 1. 统一的排除区域管理 =====

interface ExclusionZone {
  range: vscode.Range;
  type: 'hook' | 'region' | 'jsx' | 'typescript';
  reason: string;
}

/**
 * 计算所有需要排除的区域
 */
function computeAllExclusionZones(doc: vscode.TextDocument): ExclusionZone[] {
  const zones: ExclusionZone[] = [];
  
  // 1. 检测 Hook 内部区域
  zones.push(...detectHookInternalZones(doc));
  
  // 2. 检测 Region 区域
  zones.push(...detectRegionZones(doc));
  
  // 3. 检测 JSX 区域
  zones.push(...detectJSXZones(doc));
  
  // 4. 检测 TypeScript 类型定义区域
  zones.push(...detectTypeScriptZones(doc));
  
  return zones;
}

/**
 * 检查某个范围是否在排除区域内
 */
function isInExclusionZone(range: vscode.Range, zones: ExclusionZone[]): boolean {
  return zones.some(zone => {
    // 完全包含或有交集都算在排除区域内
    return !(range.end.isBefore(zone.range.start) || range.start.isAfter(zone.range.end));
  });
}

// ===== 2. Hook 内部区域检测 =====

// const HOOK_KEYWORDS = ['useEffect', 'useState', 'useMemo', 'useCallback'] as const;

/**
 * 检测所有 Hook 调用的内部区域
 * 策略: 找到 Hook 调用后,识别其回调函数的大括号范围
 */
function detectHookInternalZones(doc: vscode.TextDocument): ExclusionZone[] {
  const zones: ExclusionZone[] = [];
  
  for (let i = 0; i < doc.lineCount; i++) {
    const line = doc.lineAt(i).text;
    
    // 检测是否有 Hook 调用
    const hookMatch = line.match(/\b(useEffect|useState|useMemo|useCallback)\s*\(/);
    if (!hookMatch) continue;
    
    const hookName = hookMatch[1];
    
    // 对于 useState,通常没有回调函数,跳过
    if (hookName === 'useState') continue;
    
    // 查找 Hook 参数中的函数定义范围
    const functionRange = findHookCallbackRange(doc, i);
    if (functionRange) {
      zones.push({
        range: functionRange,
        type: 'hook',
        reason: `${hookName} 内部函数`
      });
    }
  }
  
  return zones;
}

/**
 * 查找 Hook 回调函数的大括号范围
 * 例如: useEffect(() => { ... }, [deps])
 */
function findHookCallbackRange(doc: vscode.TextDocument, startLine: number): vscode.Range | null {
  let line = startLine;
  let text = doc.lineAt(line).text;
  
  // 查找第一个 => { 或 function() {
  let foundStart = false;
  let braceStartLine = -1;
  let braceStartChar = -1;
  
  // 向前查找最多10行
  for (let lookAhead = 0; lookAhead < 10 && line + lookAhead < doc.lineCount; lookAhead++) {
    const currentLine = doc.lineAt(line + lookAhead).text;
    
    // 匹配箭头函数或普通函数的开始大括号
    const arrowMatch = currentLine.match(/=>\s*\{/);
    const functionMatch = currentLine.match(/function\s*\([^)]*\)\s*\{/);
    
    if (arrowMatch || functionMatch) {
      braceStartLine = line + lookAhead;
      const matchIndex = arrowMatch 
        ? currentLine.indexOf('{', currentLine.indexOf('=>'))
        : currentLine.indexOf('{', currentLine.indexOf('function'));
      braceStartChar = matchIndex;
      foundStart = true;
      break;
    }
    
    // 如果遇到分号或下一个语句,停止查找
    if (/;\s*$/.test(currentLine.trim()) && lookAhead > 0) break;
  }
  
  if (!foundStart) return null;
  
  // 从找到的大括号开始,匹配闭合的大括号
  let openCount = 1;
  let currentLine = braceStartLine;
  let currentChar = braceStartChar + 1;
  
  while (currentLine < doc.lineCount && openCount > 0) {
    const lineText = doc.lineAt(currentLine).text;
    
    for (let i = currentChar; i < lineText.length; i++) {
      if (lineText[i] === '{') openCount++;
      else if (lineText[i] === '}') {
        openCount--;
        if (openCount === 0) {
          // 找到匹配的闭合大括号
          return new vscode.Range(
            new vscode.Position(braceStartLine, braceStartChar),
            new vscode.Position(currentLine, i + 1)
          );
        }
      }
    }
    
    currentLine++;
    currentChar = 0;
  }
  
  return null;
}

// ===== 3. Region 区域检测 =====

/**
 * 检测 #region / #endregion 标记的区域
 */
function detectRegionZones(doc: vscode.TextDocument): ExclusionZone[] {
  const zones: ExclusionZone[] = [];
  const regionStack: number[] = [];
  
  for (let i = 0; i < doc.lineCount; i++) {
    const text = doc.lineAt(i).text.trim();
    
    // 检测 region 开始
    if (/#region\b/.test(text)) {
      regionStack.push(i);
    }
    // 检测 region 结束
    else if (/#endregion\b/.test(text)) {
      const startLine = regionStack.pop();
      if (startLine !== undefined) {
        zones.push({
          range: new vscode.Range(
            new vscode.Position(startLine, 0),
            new vscode.Position(i, doc.lineAt(i).text.length)
          ),
          type: 'region',
          reason: 'Region 标记区域'
        });
      }
    }
  }
  
  return zones;
}

// ===== 4. JSX 区域检测(改进版) =====

/**
 * 检测 JSX 标签内的函数区域
 * 策略: 识别 return ( 后的JSX区域
 */
function detectJSXZones(doc: vscode.TextDocument): ExclusionZone[] {
  const zones: ExclusionZone[] = [];
  
  for (let i = 0; i < doc.lineCount; i++) {
    const line = doc.lineAt(i).text;
    
    // 检测 return 语句
    if (/\breturn\s*\(/.test(line) || /\breturn\s*</.test(line)) {
      const jsxRange = findJSXBlockRange(doc, i);
      if (jsxRange) {
        zones.push({
          range: jsxRange,
          type: 'jsx',
          reason: 'JSX 标签区域'
        });
      }
    }
  }
  
  return zones;
}

/**
 * 查找 JSX 块的范围
 */
function findJSXBlockRange(doc: vscode.TextDocument, startLine: number): vscode.Range | null {
  const line = doc.lineAt(startLine).text;
  
  // 如果是 return ( 形式
  if (/\breturn\s*\(/.test(line)) {
    let parenCount = 0;
    let foundStart = false;
    
    for (let i = startLine; i < doc.lineCount; i++) {
      const currentLine = doc.lineAt(i).text;
      
      for (let j = 0; j < currentLine.length; j++) {
        if (currentLine[j] === '(') {
          parenCount++;
          foundStart = true;
        } else if (currentLine[j] === ')') {
          parenCount--;
          if (foundStart && parenCount === 0) {
            return new vscode.Range(
              new vscode.Position(startLine, 0),
              new vscode.Position(i, j + 1)
            );
          }
        }
      }
    }
  }
  
  // 如果是 return < 形式,查找对应的闭合标签
  if (/\breturn\s*</.test(line)) {
    let tagDepth = 0;
    
    for (let i = startLine; i < Math.min(startLine + 100, doc.lineCount); i++) {
      const currentLine = doc.lineAt(i).text;
      
      // 简单的标签计数(不完美,但足够用)
      const openTags = (currentLine.match(/<[A-Z][^>]*>/g) || []).length;
      const selfClosingTags = (currentLine.match(/<[A-Z][^>]*\/>/g) || []).length;
      const closeTags = (currentLine.match(/<\/[A-Z][^>]*>/g) || []).length;
      
      tagDepth += openTags - selfClosingTags - closeTags;
      
      if (i > startLine && tagDepth === 0) {
        return new vscode.Range(
          new vscode.Position(startLine, 0),
          new vscode.Position(i, doc.lineAt(i).text.length)
        );
      }
    }
  }
  
  return null;
}

// ===== 5. TypeScript 类型定义区域检测(增强版) =====

/**
 * 检测 TypeScript 类型定义区域
 */
function detectTypeScriptZones(doc: vscode.TextDocument): ExclusionZone[] {
  const zones: ExclusionZone[] = [];
  
  // 检测文件扩展名
  if (!doc.fileName.match(/\.(ts|tsx)$/)) {
    return zones;
  }
  
  let inTypeBlock = false;
  let typeBlockStart = -1;
  let braceCount = 0;
  
  for (let i = 0; i < doc.lineCount; i++) {
    const line = doc.lineAt(i).text.trim();
    
    // 检测类型定义开始
    if (/^\s*(type|interface|enum|namespace)\s+[A-Za-z_$][\w$]*/.test(line)) {
      inTypeBlock = true;
      typeBlockStart = i;
      braceCount = 0;
    }
    
    if (inTypeBlock) {
      // 计算大括号
      for (const char of line) {
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
      }
      
      // 类型定义结束
      if (braceCount === 0 && line.includes('}')) {
        zones.push({
          range: new vscode.Range(
            new vscode.Position(typeBlockStart, 0),
            new vscode.Position(i, doc.lineAt(i).text.length)
          ),
          type: 'typescript',
          reason: 'TypeScript 类型定义'
        });
        inTypeBlock = false;
      }
      
      // 单行类型定义(无大括号)
      if (braceCount === 0 && /;\s*$/.test(line) && typeBlockStart === i) {
        zones.push({
          range: new vscode.Range(
            new vscode.Position(i, 0),
            new vscode.Position(i, doc.lineAt(i).text.length)
          ),
          type: 'typescript',
          reason: 'TypeScript 单行类型定义'
        });
        inTypeBlock = false;
      }
    }
  }
  
  return zones;
}

// ===== 6. 改进的主函数识别逻辑 =====

/**
 * 改进的函数范围计算
 */
export function computeFunctionRangesOptimized(doc: vscode.TextDocument): vscode.Range[] {
  // 1. 先计算所有排除区域
  const exclusionZones = computeAllExclusionZones(doc);
  
  exclusionZones.forEach(zone => {
    // 排除区域处理
  });
  
  // 2. 使用原有逻辑识别所有可能的函数
  const allRanges = computeFunctionRangesOptimized(doc);
  
  // 3. 过滤掉在排除区域内的函数
  const filteredRanges = allRanges.filter(range => {
    const inExclusion = isInExclusionZone(range, exclusionZones);
    if (inExclusion) {
      const line = doc.lineAt(range.start.line).text.trim();
    }
    return !inExclusion;
  });
  
  
  return filteredRanges;
}
/** React Hooks 关键字列表 - 包含所有官方 Hooks */
const HOOK_KEYWORDS = [
  'useEffect',
  'useState',
  'useMemo',
  'useCallback',
  // 'useRef',
  // 'useReducer',
  // 'useLayoutEffect',
  // 'useContext',
  // 'useImperativeHandle',
  // 'useDebugValue',
  // 'useDeferredValue',
  // 'useTransition',
  // 'useId',
  // 'useSyncExternalStore',
  // 'useInsertionEffect'
] as const;

type HookKeyword = typeof HOOK_KEYWORDS[number];

/**
 * 检测一行或多行文本中是否包含 Hook 调用
 * 支持各种模式:
 * - useEffect(() => {})
 * - React.useEffect(() => {})
 * - useEffect(function() {})
 * - useEffect(async () => {})
 */
function detectHookInText(text: string): HookKeyword | undefined {
  const normalized = text.replace(/\s+/g, ' ').trim();
  
  for (const hook of HOOK_KEYWORDS) {
    // 匹配 hook 名称后跟开括号，支持可选的 React. 前缀
    const pattern = new RegExp(`(?:React\\.)?${hook}\\s*\\(`, 'i');
    if (pattern.test(normalized)) {
      return hook.toLowerCase() as HookKeyword;
    }
  }
  
  return undefined;
}

/**
 * 判断是否是裸箭头函数的开始
 */
function isLikelyBareArrowStart(line: string): boolean {
  const trimmed = line.trim();
  return /^(?:async\s+)?(?:\/\*.*?\*\/)?\s*\([^)]*\)\s*=>\s*\{/.test(trimmed);
}

/**
 * 检查某行是否是数组方法链式调用的一部分
 * 这些不应该被识别为独立函数
 */
function isArrayMethodChain(doc: vscode.TextDocument, lineIndex: number): boolean {
  // 向上查找几行，看是否有数组方法调用
  const maxLookback = 5;
  let currentLine = lineIndex;
  
  for (let i = 0; i < maxLookback && currentLine >= 0; currentLine--, i++) {
    const text = doc.lineAt(currentLine).text.trim();
    
    // 如果找到数组方法（.map, .filter 等），说明是链式调用
    if (/\.(map|filter|forEach|reduce|find|some|every|sort|flatMap|reduceRight|findIndex)\s*\(/.test(text)) {
      return true;
    }
    
    // 如果遇到语句结束或新的赋值，停止查找
    if (/^(const|let|var|return|if|while|for)\s/.test(text) || /;\s*$/.test(text)) {
      // 但要检查这一行本身是否包含数组方法
      if (/\.(map|filter|forEach|reduce|find|some|every|sort|flatMap|reduceRight|findIndex)\s*\(/.test(text)) {
        return true;
      }
      break;
    }
    
    // 如果这行以点开头，继续向上查找（链式调用）
    if (!text.startsWith('.')) {
      // 检查这一行是否有数组方法
      if (/\.(map|filter|forEach|reduce|find|some|every|sort|flatMap|reduceRight|findIndex)\s*\(/.test(text)) {
        return true;
      }
      break;
    }
  }
  
  return false;
}

/**
 * 向上回溯查找 Hook 上下文
 * 当遇到裸箭头函数时使用
 * 增强版：排除数组方法链式调用
 */
function lookupHookAbove(doc: vscode.TextDocument, startLine: number): HookKeyword | undefined {
  const maxLookback = 8;
  let checkedLines = 0;
  let accumulatedText = '';
  let inBlockComment = false;

  for (let line = startLine - 1; line >= 0 && checkedLines < maxLookback; line--) {
    const raw = doc.lineAt(line).text;
    const trimmed = raw.trim();

    if (!trimmed) continue;

    // 处理块注释
    if (inBlockComment) {
      if (trimmed.includes('/*')) inBlockComment = false;
      continue;
    }
    if (trimmed.includes('*/')) {
      inBlockComment = true;
      continue;
    }

    // 跳过单行注释
    if (trimmed.startsWith('//')) continue;

    checkedLines++;
    
    // 检查是否遇到数组方法 - 如果是，立即停止并返回 undefined
    if (/\.(map|filter|forEach|reduce|find|some|every|sort|flatMap|reduceRight|findIndex)\s*\(/.test(trimmed)) {
      return undefined;
    }
    
    // 累积文本
    accumulatedText = trimmed + ' ' + accumulatedText;

    // 检测累积的文本中是否包含 Hook
    const hook = detectHookInText(accumulatedText);
    if (hook) return hook;

    // 如果遇到明显的语句开始（const/let/var/return 等），停止回溯
    if (/^(const|let|var|return|if|while|for|function)\s/.test(trimmed)) {
      break;
    }
    
    // 如果遇到分号或大括号结束，停止回溯
    if (/[;{}]\s*$/.test(trimmed)) {
      break;
    }
  }

  return undefined;
}

/**
 * 根据函数名和上下文识别函数类型
 */
function getFunctionType(doc: vscode.TextDocument, startLine: number): string {
  const currentLine = doc.lineAt(startLine).text;
  const trimmed = currentLine.trim();
  const nextLine = startLine + 1 < doc.lineCount ? doc.lineAt(startLine + 1).text : '';
  const combined = `${currentLine} ${nextLine}`;
  // 🔥 最优先：检查是否是 Hook 调用
  const directHook = detectHookInText(currentLine);
  if (directHook) {
    return directHook;
  }

  // 检查跨行的 Hook 调用
  const combinedHook = detectHookInText(combined);
  if (combinedHook) {
    return combinedHook;
  }

  // 0. 优先检查：如果是数组方法链式调用的一部分，直接返回 'array-callback'
  if (isArrayMethodChain(doc, startLine)) {
    return 'array-callback';
  }

  // 1. 检查 JSX 内联函数（需要过滤掉）
  const jsxEventPattern = /\b(onClick|onChange|onSubmit|onFocus|onBlur|onMouse|onKey|onLoad|onError|onScroll|onResize|onTouch|onInput|onSelect|onContextMenu|onDrag|onDrop|onWheel|onAnimation|onTransition|onClickItem|onClickStickItem|onOpenRightSwipe)\s*=\s*\{/i;
  if (jsxEventPattern.test(combined)) {
    return 'jsx-inline';
  }

  // 1.1 检查 JSX 属性中的函数引用（需要过滤掉）
  const jsxFunctionRefPattern = /\b(onClick|onChange|onSubmit|onFocus|onBlur|onMouse|onKey|onLoad|onError|onScroll|onResize|onTouch|onInput|onSelect|onContextMenu|onDrag|onDrop|onWheel|onAnimation|onTransition|onClickItem|onClickStickItem|onOpenRightSwipe)\s*=\s*\{?[A-Za-z_$][\w$]*\}?/i;
  if (jsxFunctionRefPattern.test(combined)) {
    return 'jsx-inline';
  }

  // 1.2 检查 JSX 标签内的箭头函数（需要过滤掉）
  // 匹配: (item) => ( 或 (id: string) => { 等JSX内的箭头函数
  const jsxArrowPattern = /^\s*\([^)]*\)\s*=>\s*[({]/;
  if (jsxArrowPattern.test(trimmed)) {
    return 'jsx-inline';
  }

  // 1.3 检查 JSX 标签内的异步箭头函数（需要过滤掉）
  // 匹配: async () => { 等JSX内的异步箭头函数
  const jsxAsyncArrowPattern = /^\s*async\s*\([^)]*\)\s*=>\s*\{/;
  if (jsxAsyncArrowPattern.test(trimmed)) {
    return 'jsx-inline';
  }

  // 1.4 检查 JSX 标签内的回调函数（需要过滤掉）
  // 匹配: Taro.nextTick(() => { 等JSX内的回调函数
  const jsxCallbackPattern = /^\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*\(\s*\([^)]*\)\s*=>\s*\{/;
  if (jsxCallbackPattern.test(trimmed)) {
    return 'jsx-inline';
  }

  // 2. 检查当前行本身是否包含数组方法回调（单行形式）
  if (/\.(map|filter|forEach|reduce|find|some|every|sort|flatMap|reduceRight|findIndex)\s*\(\s*\([^)]*\)\s*=>\s*\{/.test(combined)) {
    return 'array-callback';
  }

  // 5. 如果是裸箭头函数，向上回溯查找 Hook 上下文（已增强，会排除数组方法）
  if (isLikelyBareArrowStart(trimmed)) {
    const hookFromAbove = lookupHookAbove(doc, startLine);
    if (hookFromAbove) return hookFromAbove;
  }

  // 6. 检查 region 标注
  if (combined.includes('#region')) return 'region';

  // 其他所有函数都不识别
  return 'ignore';
}

/**
 * 增强的函数名提取器 - 支持各种箭头函数写法
 * 支持: export const func = (params) => {}
 * 支持: const func = (param = defaultValue) => {}
 * 支持: export const func = () => {}
 * 支持: export const func = (): ReturnType => {
 * 等各种变体
 */
function extractFunctionName(text: string): string {
  // 1. 传统 function 声明: function myFunc() 或 export function myFunc()
  let m = text.match(/\b(?:export\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/);
  if (m) return m[1];

  // 2. const/let/var 箭头函数 - 最宽松的匹配，支持所有变体
  // 匹配: export const getLocationCoord = (needAuth = false) => {
  // 匹配: const func = () => {}
  // 匹配: export const func = async (param: Type = default) => {
  // 匹配: export const initOrderTemplate = (): API.Order.OrderTemplateInfo => {
  // 关键改进：返回类型可以包含点号、泛型等复杂类型
  m = text.match(/\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s+)?(?:<[^>]*>\s*)?\([^)]*\)\s*(?::\s*[^=>]+)?\s*=>/);
  if (m) return m[1];

  // 3. 简化的箭头函数赋值（无 const/let/var 关键字）
  // 匹配: myFunc = (params) => {}
  m = text.match(/\b([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:<[^>]*>\s*)?\([^)]*\)\s*(?::\s*[^=>]+)?\s*=>/);
  if (m) return m[1];

  // 4. 对象方法（async 或普通）
  // 匹配: async myMethod() {}
  m = text.match(/^(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/);
  if (m) return m[1];

  // 5. 对象字面量中的方法
  // 匹配: obj = { myMethod() {} }
  m = text.match(/[:,]\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/);
  if (m) return m[1];

  return '';
}

/**
 * 计算函数范围（带缓存）
 */
export function computeFunctionRanges(doc: vscode.TextDocument): vscode.Range[] {
  const docUri = doc.uri.toString();
  const docVersion = doc.version;
  
  // 检查缓存
  const cached = functionCache.get(docUri);
  if (cached && cached.version === docVersion) {
    return cached.ranges;
  }
  
  const ranges: vscode.Range[] = [];
  
  // 预编译正则表达式
  const commentPattern = /^\s*(\/\/|\*|\/\*)/;
  const controlFlowPattern = /\b(if|else|while|for|switch|catch|with|try)\s*\(/;
  const functionPattern = /\bfunction\b/;
  // 增强的箭头函数模式 - 支持默认参数、类型注解、export 等
  // 匹配: export const func = (param = value) => {}
  // 匹配: const func = (a, b = 1) => {}
  // 匹配: const func = () => {}
  // 匹配: export const initOrderTemplate = (): API.Order.OrderTemplateInfo => {
  // 关键：返回类型注解可以包含点号、泛型等复杂结构，所以用 [^=>]+ 而不是 [^=>{]+
  const constArrowPattern = /\b(?:export\s+)?(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*(?::[^=]+)?=\s*(?:async\s+)?(?:<[^>]*>\s*)?\([^)]*\)\s*(?::\s*[^=>]+)?\s*=>/;
  const assignArrowPattern = /\b[A-Za-z_$][\w$]*\s*(?::[^=]+)?=\s*(?:async\s+)?(?:<[^>]*>\s*)?\([^)]*\)\s*(?::\s*[^=>]+)?\s*=>/;
  const genericArrowPattern = /[=:\)]\s*=>/;
  // 变量赋值 + 回调箭头函数作为参数的启发式检测
  const assignedWithCallbackPattern = /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*(?::[^=]+)?=\s*[^;]*\([^)]*\)\s*=>/;
  const methodPattern = /^(?:async\s+)?[A-Za-z_$][\w$]*\s*\([^)]*\)\s*\{/;
  const objectMethodPattern = /[:,]\s*(?:async\s+)?[A-Za-z_$][\w$]*\s*\([^)]*\)\s*\{/;
  // Hook 调用模式：匹配任何 useXxx( 格式
  const hookCallPattern = /\b(?:React\.)?use[A-Z]\w*\s*\(/;
  const hookAssignedPattern = /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*(?:React\.)?use[A-Z]\w*\s*\(/;

  const maybeFuncStart = (line: string, lineIndex: number) => {
    const s = line.trim();
    // 🔥 直接优先检查 Hook - 在所有过滤规则之前
    const directHookPattern = /\b(?:React\.)?(useEffect|useState|useMemo|useCallback)\s*\(/;
    if (directHookPattern.test(s)) {
      return true;
    }
    
    // 检查跨行
    if (lineIndex + 1 < doc.lineCount) {
      const nextLine = doc.lineAt(lineIndex + 1).text.trim();
      if (directHookPattern.test(s + ' ' + nextLine)) {
        return true;
      }
    }

    if (commentPattern.test(s)) return false;
    if (controlFlowPattern.test(s)) return false;
    
    // 检查是否是 TypeScript 类型定义（需要过滤掉）
    const typeDefinitionPattern = /^\s*(type|interface|enum|namespace)\s+[A-Za-z_$][\w$]*/;
    if (typeDefinitionPattern.test(s)) return false;
    
    // 检查是否是 TypeScript 类型别名中的函数类型（需要过滤掉）
    const typeAliasPattern = /^\s*type\s+[A-Za-z_$][\w$]*\s*=\s*\([^)]*\)\s*=>/;
    if (typeAliasPattern.test(s)) return false;
    
    // 检查是否是 TypeScript 接口/类型中的函数属性（需要过滤掉）
    // 匹配: success?: (text: string, res: Components.Address.AnalysisResultType, isUseAI: boolean) => void;
    const interfaceFunctionPattern = /^\s*[A-Za-z_$][\w$]*\??\s*:\s*\([^)]*\)\s*=>/;
    if (interfaceFunctionPattern.test(s)) return false;
    
    // 检查是否是 TypeScript 接口/类型中的简单函数属性（需要过滤掉）
    // 匹配: cancel?: () => void;
    const simpleFunctionPattern = /^\s*[A-Za-z_$][\w$]*\??\s*:\s*\(\)\s*=>/;
    if (simpleFunctionPattern.test(s)) return false;
    
    // 检查是否是 TypeScript 接口/类型中的复杂函数属性（需要过滤掉）
    // 匹配: ref?: React.MutableRefObject<{ setIsShowExtNum: (visible: boolean) => void; clearAddress: () => void }>;
    const complexFunctionPattern = /^\s*[A-Za-z_$][\w$]*\??\s*:\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*<[^>]*>/;
    if (complexFunctionPattern.test(s)) return false;
    
    // 检查是否在 TypeScript 接口/类型定义块内
    // 向上查找是否在 interface/type 块内
let inTypeDefinition = false;
for (let j = lineIndex - 1; j >= 0 && j >= lineIndex - 10; j--) {
  const prevLine = doc.lineAt(j).text.trim();
  
  // 如果遇到函数体开始（箭头函数或普通函数），停止检查
  if (/\)\s*=>\s*\{/.test(prevLine) || /\bfunction\s*\([^)]*\)\s*\{/.test(prevLine)) {
    break;
  }
  
  // 如果遇到闭合大括号，停止检查
  if (prevLine.includes('}') && !prevLine.includes('{')) {
    break;
  }
  
  // 只有明确的类型定义开头才算
  if (prevLine.match(/^\s*(type|interface|enum|namespace)\s+[A-Za-z_$][\w$]*\s*=?\s*\{/) && !prevLine.includes('=>')) {
    inTypeDefinition = true;
    break;
  }
}
if (inTypeDefinition) return false;
    
    // 检查是否是导出的大组件函数（需要过滤掉）
    // 匹配: export default function ComponentName 或 export const ComponentName = 
    // const exportComponentPattern = /^\s*export\s+(?:default\s+)?(?:function\s+([A-Z][A-Za-z_$]*)|(?:const|let|var)\s+([A-Z][A-Za-z_$]*)\s*=)/;
    // if (exportComponentPattern.test(s)) return false;
    
    // 检查是否是 JSX 内联函数（需要过滤掉）
    const jsxEventPattern = /\b(onClick|onChange|onSubmit|onFocus|onBlur|onMouse|onKey|onLoad|onError|onScroll|onResize|onTouch|onInput|onSelect|onContextMenu|onDrag|onDrop|onWheel|onAnimation|onTransition|onClickItem|onClickStickItem|onOpenRightSwipe)\s*=\s*\{/i;
    if (jsxEventPattern.test(s)) return false;
    
    // 检查是否是 JSX 属性中的函数引用（需要过滤掉）
    const jsxFunctionRefPattern = /\b(onClick|onChange|onSubmit|onFocus|onBlur|onMouse|onKey|onLoad|onError|onScroll|onResize|onTouch|onInput|onSelect|onContextMenu|onDrag|onDrop|onWheel|onAnimation|onTransition|onClickItem|onClickStickItem|onOpenRightSwipe)\s*=\s*\{?[A-Za-z_$][\w$]*\}?/i;
    if (jsxFunctionRefPattern.test(s)) return false;
    
    // 检查是否是 JSX 标签内的箭头函数（需要过滤掉）
    const jsxArrowPattern = /^\s*\([^)]*\)\s*=>\s*[({]/;
    if (jsxArrowPattern.test(s)) return false;
    
    // 检查是否是 JSX 标签内的异步箭头函数（需要过滤掉）
    const jsxAsyncArrowPattern = /^\s*async\s*\([^)]*\)\s*=>\s*\{/;
    if (jsxAsyncArrowPattern.test(s)) return false;
    
    // 检查是否是 JSX 标签内的回调函数（需要过滤掉）
    const jsxCallbackPattern = /^\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*\(\s*\([^)]*\)\s*=>\s*\{/;
    if (jsxCallbackPattern.test(s)) return false;
    
    // 如果匹配到 genericArrowPattern，需要额外检查是否是数组方法链式调用
    if (genericArrowPattern.test(s)) {
      // 检查是否是数组方法的回调
      if (isArrayMethodChain(doc, lineIndex)) {
        return false;
      }
    }
    return false;
  };

  for (let i = 0; i < doc.lineCount; i++) {
    const text = doc.lineAt(i).text;
     // 🔥 调试：检测 useEffect
      if (text.includes('useEffect')) {
        const result = maybeFuncStart(text, i);
      }

    if (!maybeFuncStart(text, i)) continue;

    // 查找第一个 '{'
    let braceLine = i;
    let foundBrace = text.includes('{');
    
    // 允许跨行查找（最多 5 行）
    let lookAhead = 0;
    while (!foundBrace && braceLine + 1 < doc.lineCount && lookAhead < 5) {
      braceLine++;
      lookAhead++;
      if (doc.lineAt(braceLine).text.includes('{')) {
        foundBrace = true;
        break;
      }
    }
    
    if (!foundBrace) continue;

    // 从找到的第一个 '{' 开始做 { } 计数直到闭合
    let open = 0;
    let endLine = braceLine;

    const countBraces = (s: string) => {
      for (let k = 0; k < s.length; k++) {
        const ch = s[k];
        if (ch === '{') open++;
        else if (ch === '}') {
          open--;
          if (open === 0) return true;
        }
      }
      return false;
    };

    countBraces(doc.lineAt(braceLine).text);

    while (open > 0 && endLine + 1 < doc.lineCount) {
      endLine++;
      const done = countBraces(doc.lineAt(endLine).text);
      if (done) break;
    }

    const start = new vscode.Position(i, 0);
    const endChar = doc.lineAt(endLine).range.end.character;
    const end = new vscode.Position(endLine, endChar);
    ranges.push(new vscode.Range(start, end));
  }

  const result = dropNested(ranges);
  
  // 缓存结果
  functionCache.set(docUri, { ranges: result, version: docVersion });
  
  // 限制缓存大小
  if (functionCache.size > 50) {
    const firstKey = functionCache.keys().next().value;
    if (firstKey) functionCache.delete(firstKey);
  }
  
  return result;
}

/** 保留嵌套函数：不去掉被包裹的内层函数 */
function dropNested(ranges: vscode.Range[]): vscode.Range[] {
  // 直接返回所有函数范围，不进行嵌套过滤
  // 这样可以让嵌套的函数（如 useEffect 内的箭头函数）也被识别
  return ranges;
}

/** Region 抑制：在 suppress 段内的部分全部裁掉 */
function filterOutSuppressed(ranges: vscode.Range[], suppress: vscode.Range[]): vscode.Range[] {
  if (!suppress.length) return ranges;
  const out: vscode.Range[] = [];
  for (const r of ranges) {
    let pieces: vscode.Range[] = [r];
    for (const s of suppress) {
      const next: vscode.Range[] = [];
      for (const p of pieces) {
        if (p.end.isBeforeOrEqual(s.start) || p.start.isAfterOrEqual(s.end)) {
          next.push(p);
          continue;
        }
        if (p.start.isBefore(s.start)) next.push(new vscode.Range(p.start, s.start));
        if (p.end.isAfter(s.end)) next.push(new vscode.Range(s.end, p.end));
      }
      pieces = next;
      if (!pieces.length) break;
    }
    out.push(...pieces);
  }
  return out;
}

/** 分割为代码段（仅裁边，不在中间切段） */
function splitToCodeSegments(doc: vscode.TextDocument, range: vscode.Range): vscode.Range[] {
  const startLine = range.start.line;
  const endLine = range.end.line;

  let first = -1;
  let last = -1;
  let inBlockComment = false;

  const isOnlyPunct = (t: string) => /^[()\[\]{};,]+$/.test(t);
  const isIgnorableLine = (line: string): boolean => {
    const t = line.trim();
    if (t === '') return true;
    if (!inBlockComment && t.startsWith('//')) return true;
    if (!inBlockComment && t.startsWith('/*') && !t.includes('*/')) {
      inBlockComment = true;
      return true;
    }
    if (inBlockComment) {
      if (t.includes('*/')) inBlockComment = false;
      return true;
    }
    if (/^\/\*.*\*\/$/.test(t)) return true;
    if (isOnlyPunct(t) && !t.includes('}')) return true;
    return false;
  };

  for (let i = startLine; i <= endLine; i++) {
    const raw = doc.lineAt(i).text;
    if (!isIgnorableLine(raw)) {
      if (first === -1) first = i;
      last = i;
    }
  }

  if (first === -1) return [];

  const endChar = doc.lineAt(last).range.end.character;
  return [new vscode.Range(new vscode.Position(first, 0), new vscode.Position(last, endChar))];
}

/** 把一组范围做"仅裁边"，不拆分中间逻辑 */
function keepCodeOnly(doc: vscode.TextDocument, ranges: vscode.Range[]): vscode.Range[] {
  const out: vscode.Range[] = [];
  for (const r of ranges) {
    const trimmed = splitToCodeSegments(doc, r);
    if (trimmed.length) out.push(trimmed[0]);
  }
  return out;
}

/**
 * 预加载所有函数的翻译（异步，在后台进行）
 */
async function preloadTranslations(doc: vscode.TextDocument, ranges: vscode.Range[]): Promise<void> {
  const config = vscode.workspace.getConfiguration('codehue');
  const translationMode = config.get<string>('translationMode', 'ai');
  const apiKey = config.get<string>('deepseekApiKey', '');

  // 只在 AI 模式且配置了 API Key 时预加载
  if (translationMode !== 'ai' || !apiKey) {
    return;
  }

  // 提取所有函数名
  const functionNames: string[] = [];
  for (const r of ranges) {
    const line = r.start.line;
    const l1 = doc.lineAt(line).text.trim();
    const l2 = line + 1 < doc.lineCount ? doc.lineAt(line + 1).text.trim() : '';
    const s = `${l1} ${l2}`;

    const functionName = extractFunctionName(s);
    
    if (functionName && functionName !== 'anonymous') {
      functionNames.push(functionName);
    }
  }

  // 在后台批量预加载翻译
  const promises = functionNames.map(name => 
    translateFunctionNameToChinese(name).catch(err => {
      // 静默失败，不影响主流程
      console.debug(`预加载翻译失败: ${name}`, err);
    })
  );

  // 并发限制：每次最多处理 10 个
  const batchSize = 10;
  for (let i = 0; i < promises.length; i += batchSize) {
    const batch = promises.slice(i, i + batchSize);
    await Promise.allSettled(batch);
  }
}

export function refreshFunctionDecorations() {
  // 留空，真正刷新在 extension.ts 里通过 applyAll 触发
}

export function disposeFunctionDecorations() {
  stripeTypeCache.forEach((dt) => dt.dispose());
  stripeTypeCache.clear();
  functionCache.clear();
}

/** 自动为函数添加中文注释 */
export function addFunctionComments(editor: vscode.TextEditor) {
  const doc = editor.document;
  const edit = new vscode.WorkspaceEdit();
  
  let addedComments = 0;
  const keywords = /\b(if|else|while|for|switch|catch|with)\s*\(/;
  
  for (let i = 0; i < doc.lineCount; i++) {
    const line = doc.lineAt(i).text.trim();
    
    if (!line || line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) {
      continue;
    }
    
    if (keywords.test(line)) continue;
    
    // 使用统一的函数名提取器
    const functionName = extractFunctionName(line);
    
    if (functionName) {
      const hasComment = i > 0 && (
        doc.lineAt(i - 1).text.trim().startsWith('//') ||
        doc.lineAt(i - 1).text.trim().startsWith('/*') ||
        doc.lineAt(i - 1).text.trim().startsWith('*')
      );
      
      if (!hasComment) {
        const comment = `// ${functionName}`;
        const insertPosition = new vscode.Position(i, 0);
        edit.insert(doc.uri, insertPosition, comment + '\n');
        addedComments++;
      }
    }
  }
  
  if (edit.size > 0) {
    vscode.workspace.applyEdit(edit);
    vscode.window.showInformationMessage(`成功为 ${addedComments} 个函数添加了注释`);
  } else {
    vscode.window.showInformationMessage('没有找到需要添加注释的函数');
  }
}

/** 扫描"被注释掉的单独方法"行，生成注释装饰（不画条） */
function findCommentedOutFunctionNotes(doc: vscode.TextDocument): vscode.DecorationOptions[] {
  const notes: vscode.DecorationOptions[] = [];
  for (let i = 0; i < doc.lineCount; i++) {
    const raw = doc.lineAt(i).text;
    const t = raw.trim();
    if (!t.startsWith('//')) continue;

    const s = t.replace(/^\/\//, '').trim();
    if (/\bfunction\b/.test(s) || /\b[A-Za-z_$][\w$]*\s*\([^)]*\)\s*\{/.test(s) || /[=:\)]\s*=>\s*\{/.test(s)) {
      const label = '（已注释的方法）';
      notes.push({
        range: new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, 0)),
        renderOptions: { after: { contentText: ` ${label}` } }
      });
    }
  }
  return notes;
}

/**
 * 判断某个范围是否在可见区域内
 */
function isRangeVisible(editor: vscode.TextEditor, range: vscode.Range): boolean {
  return editor.visibleRanges.some(visibleRange => 
    range.start.line >= visibleRange.start.line && 
    range.end.line <= visibleRange.end.line
  );
}

/**
 * 判断某个范围是否部分可见
 */
function isRangePartiallyVisible(editor: vscode.TextEditor, range: vscode.Range): boolean {
  return editor.visibleRanges.some(visibleRange => 
    !(range.end.line < visibleRange.start.line || range.start.line > visibleRange.end.line)
  );
}

/**
 * 预加载所有函数的翻译（按优先级分层）
 */
async function preloadTranslationsWithPriority(
  editor: vscode.TextEditor,
  doc: vscode.TextDocument, 
  ranges: vscode.Range[]
): Promise<void> {
  const config = vscode.workspace.getConfiguration('codehue');
  const enableAI = config.get<boolean>('enableAITranslation', true);

  if (!enableAI) {
    return;
  }

  // 判断是否是当前活动编辑器
  const isActiveEditor = vscode.window.activeTextEditor === editor;
  const docUri = doc.uri.toString();

  // 按优先级分类函数
  const visibleFunctions: Array<{ name: string; line: number }> = [];
  const invisibleFunctions: Array<{ name: string; line: number }> = [];
  const otherFileFunctions: Array<{ name: string; line: number }> = [];

  for (const r of ranges) {
    const line = r.start.line;
    const l1 = doc.lineAt(line).text.trim();
    const l2 = line + 1 < doc.lineCount ? doc.lineAt(line + 1).text.trim() : '';
    const s = `${l1} ${l2}`;

    const functionName = extractFunctionName(s);
    
    if (functionName && functionName !== 'anonymous') {
      if (isActiveEditor) {
        // 判断是否在可见区域
        if (isRangePartiallyVisible(editor, r)) {
          visibleFunctions.push({ name: functionName, line });
        } else {
          invisibleFunctions.push({ name: functionName, line });
        }
      } else {
        otherFileFunctions.push({ name: functionName, line });
      }
    }
  }
  // 按优先级依次加载
  const allPromises: Promise<any>[] = [];

  // 1. 最高优先级：可见区域
  visibleFunctions.forEach(({ name, line }) => {
    allPromises.push(
      translateFunctionNameToChinese(name, TranslationPriority.VISIBLE_CURRENT_FILE, docUri)
        .catch(err => console.debug(`翻译失败 [可见]: ${name}`, err))
    );
  });

  // 2. 中优先级：当前文件不可见区域
  invisibleFunctions.forEach(({ name, line }) => {
    allPromises.push(
      translateFunctionNameToChinese(name, TranslationPriority.INVISIBLE_CURRENT_FILE, docUri)
        .catch(err => console.debug(`翻译失败 [不可见]: ${name}`, err))
    );
  });

  // 3. 低优先级：其他文件
  otherFileFunctions.forEach(({ name, line }) => {
    allPromises.push(
      translateFunctionNameToChinese(name, TranslationPriority.OTHER_OPEN_FILES, docUri)
        .catch(err => console.debug(`翻译失败 [其他]: ${name}`, err))
    );
  });

  // 不等待完成，让翻译在后台异步进行
  Promise.allSettled(allPromises).then(() => {
    // 翻译请求提交完成
  });
}