/**
 * Vue 装饰器模块
 * 
 * 负责 Vue 单文件组件的语法高亮和语义化装饰
 * 包括 Composition API、生命周期钩子、指令、组件等的颜色标注
 * 
 * 主要功能：
 * - 检测和装饰 Vue Composition API
 * - 识别生命周期钩子函数
 * - 标注模板指令和事件处理
 * - 支持 Vant 组件库的识别
 * - 提供中文语义化注释
 */

import * as vscode from 'vscode';
import { COLOR_SCHEMES_LIGHT, COLOR_SCHEMES_DARK } from './colorSchemes';
import { translateFunctionNameToChinese, translateFunctionNameToChineseSync, TranslationPriority } from './semanticTranslator';
import { colorToHex, applyColorWithOpacity } from './colorUtils';
import { 
  VueComponentType, 
  VueDecoratedItem,
} from './vueTypes';
import {
  detectVueCompositionAPI,
  detectVueLifecycle,
  detectVueDirective,
  detectVantComponentBlock,
  detectVueDirectiveBlock,
  detectDivBlocks,
  detectMultilineVueAPI,
  detectLongFunctions,
  parseVueSFC,
  extractVueFunctionName,
  detectCommonComponent,
  getRainbowColor,
  getFunctionColor
} from './vueDetectors';
// 翻译请求追踪器
const translationInProgress = new Set<string>();
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

/**
 * 检测当前主题是否为暗色
 */
function isDarkTheme(): boolean {
  const themeKind = vscode.window.activeColorTheme.kind;
  return themeKind === vscode.ColorThemeKind.Dark || themeKind === vscode.ColorThemeKind.HighContrast;
}

/**
 * 获取当前配置的颜色方案
 */
function getColorScheme(): Record<string, string> {
  const config = vscode.workspace.getConfiguration('codehue');
  const schemeName = config.get<string>('colorScheme', 'vibrant');
  const schemes = isDarkTheme() ? COLOR_SCHEMES_DARK : COLOR_SCHEMES_LIGHT;
  const baseScheme = schemes[schemeName] || schemes.vibrant;
  
  // 直接使用 colorSchemes.ts 中定义的颜色方案
  // Vue 专用颜色已经在 colorSchemes.ts 中定义，无需重复
  return baseScheme;
}


/**
 * 获取Vue装饰器（支持两种显示模式：背景色和左侧条带）
 * 复用 hooksDisplayMode 配置，与React保持一致
 */
function getVueDecoration(color: string, vueType: string): vscode.TextEditorDecorationType {
  const config = vscode.workspace.getConfiguration('codehue');
  const displayMode = config.get<string>('hooksDisplayMode', 'background');
  const stripeWidth = config.get<string>('hooksStripeWidth', '3px');
  
  // 生成缓存键，包含颜色、模式和类型
  const cacheKey = `${color}-${displayMode}-${stripeWidth}-vue-${vueType}`;
  
  if (stripeTypeCache.has(cacheKey)) {
    return stripeTypeCache.get(cacheKey)!;
  }
  
  let dt: vscode.TextEditorDecorationType;
  
  if (displayMode === 'stripe') {
    // 左侧条带模式 - 使用用户原始颜色
    const finalColor = colorToHex(color);
    dt = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      borderStyle: 'solid',
      borderColor: finalColor,
      borderWidth: `0 0 0 ${stripeWidth}`,
      overviewRulerColor: finalColor,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    });
  } else {
    // 底色模式 - 转换为十六进制并应用透明度
    const hexColor = colorToHex(color);
    const finalColor = applyColorWithOpacity(hexColor, color, 0.9, 'Vue装饰');
    
    dt = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: finalColor,
      overviewRulerColor: finalColor,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    });
  }
  
  stripeTypeCache.set(cacheKey, dt);
  return dt;
}

/**
 * 获取背景色装饰（已废弃，保留以兼容旧代码）
 * @deprecated 请使用 getVueDecoration 替代
 */
function getBackgroundDecoration(color: string): vscode.TextEditorDecorationType {
  // 为了向后兼容，默认使用背景色模式，但实际会读取配置
  return getVueDecoration(color, 'default');
}

/**
 * 获取Vue组件的中文标签
 */
function getVueChineseLabel(type: VueComponentType): string {
  const labels: Record<VueComponentType, string> = {
    'vue-composition-api': '组合式API',
    'vue-lifecycle-mounted': '挂载完成',
    'vue-lifecycle-unmounted': '卸载完成',
    'vue-lifecycle-updated': '更新完成',
    'vue-lifecycle-before-mount': '挂载前',
    'vue-lifecycle-before-unmount': '卸载前',
    'vue-lifecycle-before-update': '更新前',
    'vue-lifecycle-activated': '激活',
    'vue-lifecycle-deactivated': '失活',
    'vue-directive': '模板指令',
    'vue-directive-block': '指令块',
    'vue-event': '事件处理',
    'vue-computed': '计算属性',
    'vue-watch': '监听器',
    'vue-ref': '响应式数据',
    'vue-function': '', // 移除硬编码，使用AI翻译
    'vue-div-block': '模板块',
    'vant-popup': '弹窗组件',
    'vant-toast': '轻提示组件',
    'vant-list': '列表组件',
    'vant-field': '输入框组件',
    'vant-picker': '选择器组件',
    'vant-tabs': '标签页组件',
    'vant-tab': '标签项组件',
    'vant-cell': '单元格组件',
    'vant-dialog': '对话框组件',
    'vant-cell-group': '单元格组组件',
  };

  return labels[type] || type;
}

/**
 * 识别Vue组件中的所有装饰项
 */
export function findVueDecoratedItems(doc: vscode.TextDocument): VueDecoratedItem[] {
  const items: VueDecoratedItem[] = [];
  const processed = new Set<number>();
  
  // 解析Vue SFC结构
  const sfc = parseVueSFC(doc);
  
  // 处理script区域
  if (sfc.script) {
    // 检测多行Vue API声明
    const multilineVueAPI = detectMultilineVueAPI(doc, sfc.script);
    multilineVueAPI.forEach((api, index) => {
      items.push({
        range: api.range,
        type: api.apiType as VueComponentType,
        lineContent: `${api.name} (${api.type})`,
        section: 'script'
      });
      // 标记多行API的所有行为已处理
      for (let line = api.range.start.line; line <= api.range.end.line; line++) {
        processed.add(line);
      }
    });
    
    // 检测长函数
    const longFunctions = detectLongFunctions(doc, sfc.script);
    longFunctions.forEach((func, index) => {
      items.push({
        range: func.range,
        type: 'vue-function',
        lineContent: `${func.functionName} (${func.lineCount}行)`,
        section: 'script'
      });
      // 标记长函数的所有行为已处理
      for (let line = func.range.start.line; line <= func.range.end.line; line++) {
        processed.add(line);
      }
    });
    
    for (let i = sfc.script.start.line; i <= sfc.script.end.line; i++) {
      if (processed.has(i)) continue;
      
      const line = doc.lineAt(i).text;
      const trimmed = line.trim();
      
      // 检测Composition API
      const compositionAPI = detectVueCompositionAPI(trimmed);
      if (compositionAPI) {
        const range = new vscode.Range(i, 0, i, line.length);
        items.push({
          range,
          type: 'vue-composition-api',
          lineContent: trimmed,
          section: 'script'
        });
        processed.add(i);
        continue;
      }
      
      // 检测单行生命周期钩子（不在多行检测中）
      const lifecycle = detectVueLifecycle(trimmed);
      if (lifecycle && /^\s*(onMounted|onUnmounted|onUpdated|onBeforeMount|onBeforeUnmount|onBeforeUpdate|onActivated|onDeactivated)\s*\([^)]*\)\s*;?\s*$/.test(trimmed)) {
        // 根据钩子名称分配不同的类型
        const lifecycleTypeMap: Record<string, VueComponentType> = {
          'onMounted': 'vue-lifecycle-mounted',
          'onUnmounted': 'vue-lifecycle-unmounted',
          'onUpdated': 'vue-lifecycle-updated',
          'onBeforeMount': 'vue-lifecycle-before-mount',
          'onBeforeUnmount': 'vue-lifecycle-before-unmount',
          'onBeforeUpdate': 'vue-lifecycle-before-update',
          'onActivated': 'vue-lifecycle-activated',
          'onDeactivated': 'vue-lifecycle-deactivated'
        };
        
        const hookName = trimmed.match(/^\s*(onMounted|onUnmounted|onUpdated|onBeforeMount|onBeforeUnmount|onBeforeUpdate|onActivated|onDeactivated)\s*\(/)?.[1];
        const lifecycleType = hookName ? lifecycleTypeMap[hookName] : 'vue-lifecycle-mounted';
        
        const range = new vscode.Range(i, 0, i, line.length);
        items.push({
          range,
          type: lifecycleType,
          lineContent: trimmed,
          section: 'script'
        });
        processed.add(i);
        continue;
      }
      
      // 检测单行ref/reactive（不在多行检测中）
      if (/^\s*(?:const|let|var)\s+\w+\s*=\s*(?:ref|reactive)\s*\([^)]*\)\s*;?\s*$/.test(trimmed)) {
        const range = new vscode.Range(i, 0, i, line.length);
        items.push({
          range,
          type: 'vue-ref',
          lineContent: trimmed,
          section: 'script'
        });
        processed.add(i);
        continue;
      }
      
      // 检测单行computed（不在多行检测中）
      if (/^\s*(?:const|let|var)\s+\w+\s*=\s*computed\s*\([^)]*\)\s*;?\s*$/.test(trimmed)) {
        const range = new vscode.Range(i, 0, i, line.length);
        items.push({
          range,
          type: 'vue-computed',
          lineContent: trimmed,
          section: 'script'
        });
        processed.add(i);
        continue;
      }
      
      // 检测单行watch/watchEffect（不在多行检测中）
      if (/^\s*(?:watch|watchEffect)\s*\([^)]*\)\s*;?\s*$/.test(trimmed)) {
        const range = new vscode.Range(i, 0, i, line.length);
        items.push({
          range,
          type: 'vue-watch',
          lineContent: trimmed,
          section: 'script'
        });
        processed.add(i);
        continue;
      }
      
      // 检测Vue函数（非Composition API）
      const functionName = extractVueFunctionName(trimmed);
      if (functionName && !compositionAPI && !lifecycle) {
        const range = new vscode.Range(i, 0, i, line.length);
        items.push({
          range,
          type: 'vue-function',
          lineContent: trimmed,
          section: 'script'
        });
        processed.add(i);
        continue;
      }
    }
  }
  
  // 处理template区域
  if (sfc.template) {
    // 检测Vant组件块（整个组件标签）
    const vantComponentBlocks = detectVantComponentBlock(doc, sfc.template);
    vantComponentBlocks.forEach((block, index) => {
      items.push({
        range: block.range,
        type: block.componentType,
        lineContent: `${block.componentName}组件`,
        section: 'template'
      });
      // 标记Vant组件块的所有行为已处理
      for (let line = block.range.start.line; line <= block.range.end.line; line++) {
        processed.add(line);
      }
    });
    
    // 检测Vue指令块（包含指令的HTML标签）
    const directiveBlocks = detectVueDirectiveBlock(doc, sfc.template);
    directiveBlocks.forEach((block, index) => {
      // 检查是否与Vant组件块重叠
      let isOverlapped = false;
      for (const vantBlock of vantComponentBlocks) {
        if (block.range.start.line >= vantBlock.range.start.line && 
            block.range.end.line <= vantBlock.range.end.line) {
          isOverlapped = true;
          break;
        }
      }
      
      if (!isOverlapped) {
        items.push({
          range: block.range,
          type: 'vue-directive-block',
          lineContent: `${block.directiveType}指令块`,
          section: 'template'
        });
        // 标记指令块的所有行为已处理
        for (let line = block.range.start.line; line <= block.range.end.line; line++) {
          processed.add(line);
        }
      }
    });
    
    // 检测div块（不在指令块和Vant组件块中的）
    const divBlocks = detectDivBlocks(doc, sfc.template);
    divBlocks.forEach((divBlock, index) => {
      // 检查是否与指令块或Vant组件块重叠
      let isOverlapped = false;
      for (const block of [...directiveBlocks, ...vantComponentBlocks]) {
        if (divBlock.range.start.line >= block.range.start.line && 
            divBlock.range.end.line <= block.range.end.line) {
          isOverlapped = true;
          break;
        }
      }
      
      if (!isOverlapped) {
        items.push({
          range: divBlock.range,
          type: 'vue-div-block',
          lineContent: `<div> ${divBlock.componentInfo}`,
          section: 'template'
        });
      }
    });
    //  在 sfc.template 循环之前，先提取所有块级装饰的行范围
    const blockLines = new Set<number>();
    [...vantComponentBlocks, ...directiveBlocks].forEach(block => {
        for (let line = block.range.start.line; line <= block.range.end.line; line++) {
            blockLines.add(line);
        }
    });
    for (let i = sfc.template.start.line; i <= sfc.template.end.line; i++) {
      if (processed.has(i)) continue;
      
      const line = doc.lineAt(i).text;
      if (blockLines.has(i)) {
          continue; // 再次确保被块级装饰覆盖的行被跳过
      }
      // 检测Vant组件（单行，不在组件块中的，且不是自闭合标签）
      // const vantComponent = detectVantComponent(line);
      // if (vantComponent && !line.includes('/>') && !line.match(/<(\w+)[^>]*\s*\/\s*>$/)) {
      //   const range = new vscode.Range(i, 0, i, line.length);
      //   items.push({
      //     range,
      //     type: vantComponent.componentType,
      //     lineContent: `${vantComponent.componentName}组件`,
      //     section: 'template'
      //   });
      //   processed.add(i);
      //   continue;
      // }
      
      // 检测Vue指令（单行指令，不在指令块中的）
      const directive = detectVueDirective(line);
      if (directive) {
        const range = new vscode.Range(i, 0, i, line.length);
        items.push({
          range,
          type: 'vue-directive',
          lineContent: line.trim(),
          section: 'template'
        });
        processed.add(i);
        continue;
      }
      
      // 不再检测Vue事件，避免不必要的绿色标注
      // const event = detectVueEvent(line);
      // if (event) {
      //   const range = new vscode.Range(i, 0, i, line.length);
      //   items.push({
      //     range,
      //     type: 'vue-event',
      //     lineContent: line.trim(),
      //     section: 'template'
      //   });
      //   processed.add(i);
      //   continue;
      // }
    }
  }
  
  // 不再为大的template、script、style标签添加装饰
  // 这些是Vue单文件组件的结构约定，不需要特殊标注
  
  return items;
}

/**
 * 应用Vue组件装饰
 */
export function applyVueDecorations(editor: vscode.TextEditor, items: VueDecoratedItem[]): void {
  // 清除旧装饰
  stripeTypeCache.forEach((dt) => editor.setDecorations(dt, []));
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
    let color = colorScheme[type] || colorScheme['default'];
    
    // 特殊处理div块 - 使用彩虹色或常用组件颜色
    if (type === 'vue-div-block') {
      ranges.forEach((range, index) => {
        // 检查是否是常用组件
        const line = editor.document.lineAt(range.start.line).text;
        const commonComponent = detectCommonComponent(line);
        
        let finalColor: string;
        if (commonComponent) {
          finalColor = commonComponent.color;
        } else {
          finalColor = getRainbowColor(index);
        }
        
        const dt = getVueDecoration(finalColor, type);
        editor.setDecorations(dt, [range]);
      });
    } 
    // 特殊处理长函数 - 使用函数颜色
    else if (type === 'vue-function') {
      ranges.forEach((range, index) => {
        const functionColor = getFunctionColor(index);
        const dt = getVueDecoration(functionColor, type);
        editor.setDecorations(dt, [range]);
      });
    } 
    else {
      const dt = getVueDecoration(color, type);
      editor.setDecorations(dt, ranges);
    }
  }
  
  // 应用中文语义注释
  const config = vscode.workspace.getConfiguration('codehue');
  const enableSemanticComments = config.get<boolean>('enableSemanticComments', true);
  
  const annotations: vscode.DecorationOptions[] = [];
  
  if (enableSemanticComments) {
    const annotationMap = new Map<string, string>();
    
    for (const item of items) {
      // 不再为section区域添加注释，这些是结构约定
      
      const line = item.range.start.line;
      let chineseLabel = getVueChineseLabel(item.type);
      
      // 如果是div块，显示组件信息
      if (item.type === 'vue-div-block') {
        // 从lineContent中提取组件信息
        const componentInfo = item.lineContent.replace('<div>', '').trim();
        if (componentInfo) {
          chineseLabel = componentInfo;
        }
      }
      
      // 如果是Vue函数，优先使用AI翻译
      if (item.type === 'vue-function') {
        const functionName = extractVueFunctionName(item.lineContent);
        if (functionName) {
          // 先尝试同步获取缓存的翻译结果
          const cachedTranslation = translateFunctionNameToChineseSync(
            functionName, 
            TranslationPriority.VISIBLE_CURRENT_FILE, 
            editor.document.uri.toString()
          );
          
          if (cachedTranslation && cachedTranslation !== functionName) {
            chineseLabel = cachedTranslation;
          } else {
            // 如果没有缓存，先使用函数名，然后异步获取翻译
            chineseLabel = functionName;
            
            // 启动异步翻译，但不阻塞主流程
            translateFunctionNameToChinese(functionName, TranslationPriority.VISIBLE_CURRENT_FILE, editor.document.uri.toString())
              .then(translation => {
                // 翻译完成后会自动触发重新渲染
              })
              .catch(() => {
                // 翻译失败，保持使用函数名
              });
          }
        }
      }
      
      const targetLine = line > 0 ? line - 1 : line;
      const targetPos = editor.document.lineAt(targetLine).range.end;
      
      const key = `${targetLine}:${targetPos.character}`;
      
      if (!annotationMap.has(key)) {
        annotationMap.set(key, chineseLabel);
      }
    }
    
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
}

/**
 * 清理资源
 */
export function disposeVueDecorations(): void {
  stripeTypeCache.forEach((dt) => dt.dispose());
  stripeTypeCache.clear();
}
