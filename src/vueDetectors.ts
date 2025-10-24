/**
 * Vue 检测器模块
 * 
 * 负责检测和识别 Vue 代码中的各种语法元素
 * 包括 Composition API、生命周期、指令、组件等
 * 
 * 主要功能：
 * - 检测 Vue Composition API 使用
 * - 识别生命周期钩子函数
 * - 解析模板指令和事件
 * - 检测 Vant 组件库组件
 * - 解析 Vue 单文件组件结构
 * - 提供颜色分配算法
 */

import * as vscode from 'vscode';
import { 
  VueComponentType, 
  VUE_COMPOSITION_API, 
  VUE_LIFECYCLE_HOOKS, 
  VUE_DIRECTIVES, 
  COMMON_COMPONENTS,
  RAINBOW_COLORS,
  FUNCTION_COLORS
} from './vueTypes';

/**
 * 检测Vue Composition API调用
 */
export function detectVueCompositionAPI(text: string): string | undefined {
  const normalized = text.replace(/\s+/g, ' ').trim();
  
  for (const api of VUE_COMPOSITION_API) {
    const pattern = new RegExp(`\\b${api}\\s*\\(`, 'i');
    if (pattern.test(normalized)) {
      return api;
    }
  }
  
  return undefined;
}

/**
 * 检测Vue生命周期钩子
 */
export function detectVueLifecycle(text: string): string | undefined {
  const normalized = text.replace(/\s+/g, ' ').trim();
  
  for (const hook of VUE_LIFECYCLE_HOOKS) {
    const pattern = new RegExp(`\\b${hook}\\s*\\(`, 'i');
    if (pattern.test(normalized)) {
      return hook;
    }
  }
  
  return undefined;
}

/**
 * 检测Vue模板指令
 */
export function detectVueDirective(text: string): string | undefined {
  for (const directive of VUE_DIRECTIVES) {
    const pattern = new RegExp(`\\b${directive}(?:\\s*=|\\s*:)`, 'i');
    if (pattern.test(text)) {
      return directive;
    }
  }
  
  return undefined;
}

/**
 * 检测Vue事件处理
 */
export function detectVueEvent(text: string): string | undefined {
  const eventPattern = /@(\w+)(?:\s*=|:)/;
  const match = text.match(eventPattern);
  return match ? match[1] : undefined;
}

/**
 * 提取Vue函数名
 */
export function extractVueFunctionName(text: string): string {
  // 1. 箭头函数: const func = () => {}
  let match = text.match(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/);
  if (match) return match[1];

  // 2. 普通函数: function func() {}
  match = text.match(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/);
  if (match) return match[1];

  // 3. 对象方法: method() {}
  match = text.match(/^\s*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/);
  if (match) return match[1];

  // 4. 箭头函数赋值: func = () => {}
  match = text.match(/\b([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/);
  if (match) return match[1];

  return '';
}

/**
 * 检测div标签块并识别组件信息
 */
export function detectDivBlocks(doc: vscode.TextDocument, templateRange: vscode.Range): Array<{range: vscode.Range, componentInfo: string}> {
  const divBlocks: Array<{range: vscode.Range, componentInfo: string}> = [];
  const divStack: { startLine: number, startChar: number, componentInfo: string }[] = [];
  
  for (let i = templateRange.start.line; i <= templateRange.end.line; i++) {
    const line = doc.lineAt(i).text;
    
    // 查找div开始标签
    const openDivMatch = line.match(/<div\b[^>]*>/gi);
    if (openDivMatch) {
      for (const match of openDivMatch) {
        const startIndex = line.indexOf(match);
        const componentInfo = extractComponentInfo(line, match);
        divStack.push({ startLine: i, startChar: startIndex, componentInfo });
      }
    }
    
    // 查找div结束标签
    const closeDivMatch = line.match(/<\/div>/gi);
    if (closeDivMatch && divStack.length > 0) {
      for (const match of closeDivMatch) {
        const endIndex = line.indexOf(match) + match.length;
        const start = divStack.pop()!;
        
        // 确保范围有效
        if (start && start.startLine <= i) {
          // 只处理多行div块，跳过单行div
          const lineCount = i - start.startLine + 1;
          if (lineCount > 1) {
            divBlocks.push({
              range: new vscode.Range(
                new vscode.Position(start.startLine, start.startChar),
                new vscode.Position(i, endIndex)
              ),
              componentInfo: start.componentInfo
            });
          }
        }
      }
    }
  }
  
  return divBlocks;
}

/**
 * 检测常用组件
 */
export function detectCommonComponent(line: string): { name: string, color: string, type: string } | null {
  for (const component of COMMON_COMPONENTS) {
    if (component.pattern.test(line)) {
      return {
        name: component.name,
        color: component.color,
        type: component.type
      };
    }
  }
  return null;
}

/**
 * 从div标签中提取组件信息
 */
export function extractComponentInfo(line: string, divMatch: string): string {
  // 0. 优先检查常用组件
  const commonComponent = detectCommonComponent(line);
  if (commonComponent) {
    return `${commonComponent.name} (${commonComponent.type})`;
  }
  
  // 1. 检查是否有class属性
  const classMatch = divMatch.match(/class\s*=\s*["']([^"']+)["']/i);
  if (classMatch) {
    const className = classMatch[1];
    // 提取主要的类名（去掉修饰符）
    const mainClass = className.split(/\s+/)[0];
    return `组件: ${mainClass}`;
  }
  
  // 2. 检查是否有id属性
  const idMatch = divMatch.match(/id\s*=\s*["']([^"']+)["']/i);
  if (idMatch) {
    return `ID: ${idMatch[1]}`;
  }
  
  // 3. 检查是否有Vue指令
  if (divMatch.includes('v-if')) {
    return '条件渲染块';
  }
  if (divMatch.includes('v-for')) {
    return '循环渲染块';
  }
  if (divMatch.includes('v-show')) {
    return '显示控制块';
  }
  
  // 4. 检查是否有事件监听器
  const eventMatch = divMatch.match(/@(\w+)/);
  if (eventMatch) {
    return `事件: ${eventMatch[1]}`;
  }
  
  // 5. 检查是否有数据绑定
  if (divMatch.includes('v-model')) {
    return '双向绑定块';
  }
  if (divMatch.includes('v-bind') || divMatch.includes(':')) {
    return '属性绑定块';
  }
  
  // 6. 检查内容类型（通过分析div内容）
  const content = line.trim();
  if (content.includes('<h1>') || content.includes('<h2>') || content.includes('<h3>')) {
    return '标题区域';
  }
  if (content.includes('<button>') || content.includes('<input>')) {
    return '交互区域';
  }
  if (content.includes('<ul>') || content.includes('<ol>')) {
    return '列表区域';
  }
  if (content.includes('<form>')) {
    return '表单区域';
  }
  if (content.includes('<nav>') || content.includes('导航')) {
    return '导航区域';
  }
  if (content.includes('<header>') || content.includes('头部')) {
    return '头部区域';
  }
  if (content.includes('<footer>') || content.includes('底部')) {
    return '底部区域';
  }
  if (content.includes('<main>') || content.includes('主要内容')) {
    return '主内容区域';
  }
  if (content.includes('<aside>') || content.includes('侧边')) {
    return '侧边栏区域';
  }
  
  // 7. 默认返回
  return '通用容器';
}

/**
 * 获取彩虹色（基于位置）
 */
export function getRainbowColor(index: number): string {
  return RAINBOW_COLORS[index % RAINBOW_COLORS.length];
}

/**
 * 获取函数颜色（基于位置，确保相邻函数不同色）
 */
export function getFunctionColor(index: number): string {
  return FUNCTION_COLORS[index % FUNCTION_COLORS.length];
}

/**
 * 检测Vue模板指令块（包含指令的HTML标签）
 */
export function detectVueDirectiveBlock(doc: vscode.TextDocument, templateRange: vscode.Range): Array<{range: vscode.Range, directiveType: string, tagName: string}> {
  const directiveBlocks: Array<{range: vscode.Range, directiveType: string, tagName: string}> = [];
  
  for (let i = templateRange.start.line; i <= templateRange.end.line; i++) {
    const line = doc.lineAt(i).text;
    
    // 检测包含Vue指令的HTML标签
    const directivePatterns = [
      // v-if指令
      { pattern: /<(\w+)[^>]*\s+v-if\s*=\s*["'][^"']*["'][^>]*>/, directiveType: 'v-if', tagName: '' },
      // v-for指令
      { pattern: /<(\w+)[^>]*\s+v-for\s*=\s*["'][^"']*["'][^>]*>/, directiveType: 'v-for', tagName: '' },
      // v-show指令
      { pattern: /<(\w+)[^>]*\s+v-show\s*=\s*["'][^"']*["'][^>]*>/, directiveType: 'v-show', tagName: '' },
      // v-model指令
      { pattern: /<(\w+)[^>]*\s+v-model[^>]*>/, directiveType: 'v-model', tagName: '' },
      // v-else指令
      { pattern: /<(\w+)[^>]*\s+v-else[^>]*>/, directiveType: 'v-else', tagName: '' },
      // v-else-if指令
      { pattern: /<(\w+)[^>]*\s+v-else-if\s*=\s*["'][^"']*["'][^>]*>/, directiveType: 'v-else-if', tagName: '' }
    ];
    
    let matchFound = false;
    let directiveType = '';
    let tagName = '';
    
    for (const { pattern, directiveType: type } of directivePatterns) {
      const match = line.match(pattern);
      if (match) {
        tagName = match[1] || 'div';
        directiveType = type;
        matchFound = true;
        break;
      }
    }
    
    if (matchFound) {
      const startLine = i;
      let endLine = i;
      
      // 查找标签的结束位置
      const tagEndPattern = new RegExp(`</${tagName}>`, 'i');
      
      // 标记是否找到闭合标签
      let foundClosing = false;
      
      // 从当前行开始查找标签的结束位置（支持多行标签）
      for (let j = i; j <= templateRange.end.line; j++) {
        const currentLine = doc.lineAt(j).text;
        
        // 检查是否包含自闭合标签结束符 />
        if (currentLine.includes('/>')) {
          endLine = j;
          foundClosing = true;
          break;
        }
        
        // 检查是否包含正常的结束标签 </tagName>
        if (tagEndPattern.test(currentLine)) {
          endLine = j;
          foundClosing = true;
          break;
        }
        
        // 检查是否包含开始标签的结束符 >（但不是 />）
        const tagCloseMatch = currentLine.match(/>\s*$/);
        if (tagCloseMatch && j > i && !currentLine.includes('/>')) {
          // 找到了开始标签的结束，现在需要找到配对的结束标签
          let tagCount = 1;
          for (let k = j + 1; k <= templateRange.end.line; k++) {
            const searchLine = doc.lineAt(k).text;
            
            // 检查是否有同名的新开始标签（完整的单行标签）
            const newStartPattern = new RegExp(`<${tagName}\\b[^>]*>`, 'i');
            if (newStartPattern.test(searchLine) && !searchLine.includes('/>')) {
              tagCount++;
            }
            
            // 检查是否有结束标签
            if (tagEndPattern.test(searchLine)) {
              tagCount--;
              if (tagCount === 0) {
                endLine = k;
                foundClosing = true;
                break;
              }
            }
          }
          break;
        }
      }
      
      // 只有找到闭合标签且是多行时才添加
      if (foundClosing && (endLine - startLine + 1) > 1) {
        directiveBlocks.push({
          range: new vscode.Range(
            new vscode.Position(startLine, 0),
            new vscode.Position(endLine, doc.lineAt(endLine).text.length)
          ),
          directiveType,
          tagName
        });
      }
    }
  }
  
  return directiveBlocks;
}

/**
 * 检测Vant组件块（整个组件标签）
 */
export function detectVantComponentBlock(doc: vscode.TextDocument, templateRange: vscode.Range): Array<{range: vscode.Range, componentName: string, componentType: VueComponentType}> {
  const vantComponentBlocks: Array<{range: vscode.Range, componentName: string, componentType: VueComponentType}> = [];
  
  for (let i = templateRange.start.line; i <= templateRange.end.line; i++) {
    const line = doc.lineAt(i).text;
    
    // 检测Vant组件开始
    const vantPatterns = [
      // Popup组件
      { pattern: /<van-popup\b/, componentName: 'Popup', componentType: 'vant-popup' as VueComponentType },
      { pattern: /<Popup\b/, componentName: 'Popup', componentType: 'vant-popup' as VueComponentType },
      
      // Toast组件
      { pattern: /<van-toast\b/, componentName: 'Toast', componentType: 'vant-toast' as VueComponentType },
      { pattern: /<Toast\b/, componentName: 'Toast', componentType: 'vant-toast' as VueComponentType },
      
      // List组件
      { pattern: /<van-list\b/, componentName: 'List', componentType: 'vant-list' as VueComponentType },
      { pattern: /<List\b/, componentName: 'List', componentType: 'vant-list' as VueComponentType },
      
      // Field组件
      { pattern: /<van-field\b/, componentName: 'Field', componentType: 'vant-field' as VueComponentType },
      { pattern: /<Field\b/, componentName: 'Field', componentType: 'vant-field' as VueComponentType },
      
      // Picker组件
      { pattern: /<van-picker\b/, componentName: 'Picker', componentType: 'vant-picker' as VueComponentType },
      { pattern: /<Picker\b/, componentName: 'Picker', componentType: 'vant-picker' as VueComponentType },
      
      // Tabs组件
      { pattern: /<van-tabs\b/, componentName: 'Tabs', componentType: 'vant-tabs' as VueComponentType },
      { pattern: /<Tabs\b/, componentName: 'Tabs', componentType: 'vant-tabs' as VueComponentType },
      
      // Tab组件
      { pattern: /<van-tab\b/, componentName: 'Tab', componentType: 'vant-tab' as VueComponentType },
      { pattern: /<Tab\b/, componentName: 'Tab', componentType: 'vant-tab' as VueComponentType },
      
      // Cell组件
      { pattern: /<van-cell\b/, componentName: 'Cell', componentType: 'vant-cell' as VueComponentType },
      { pattern: /<Cell\b/, componentName: 'Cell', componentType: 'vant-cell' as VueComponentType },
      
      // Dialog组件
      { pattern: /<van-dialog\b/, componentName: 'Dialog', componentType: 'vant-dialog' as VueComponentType },
      { pattern: /<Dialog\b/, componentName: 'Dialog', componentType: 'vant-dialog' as VueComponentType },
      
      // CellGroup组件
      { pattern: /<van-cell-group\b/, componentName: 'CellGroup', componentType: 'vant-cell-group' as VueComponentType },
      { pattern: /<CellGroup\b/, componentName: 'CellGroup', componentType: 'vant-cell-group' as VueComponentType },
    ];
    
    let matchFound = false;
    let componentName = '';
    let componentType = '';
    let tagName = '';
    
    for (const { pattern, componentName: name, componentType: type } of vantPatterns) {
      const match = line.match(pattern);
      if (match) {
        componentName = name;
        componentType = type;
        tagName = match[0].match(/<(\w+)/)?.[1] || 'div';
        matchFound = true;
        break;
      }
    }
    
    if (matchFound) {
      const startLine = i;
      let endLine = i;
      
      // 查找组件标签的结束位置
      const tagEndPattern = new RegExp(`</${tagName}>`, 'i');
      
      // 标记是否找到闭合标签
      let foundClosing = false;
      
      // 从当前行开始查找标签的结束位置（支持多行标签）
      for (let j = i; j <= templateRange.end.line; j++) {
        const currentLine = doc.lineAt(j).text;
        
        // 检查是否包含自闭合标签结束符 />
        if (currentLine.includes('/>')) {
          endLine = j;
          foundClosing = true;
          break;
        }
        
        // 检查是否包含正常的结束标签 </tagName>
        if (tagEndPattern.test(currentLine)) {
          endLine = j;
          foundClosing = true;
          break;
        }
        
        // 检查是否包含开始标签的结束符 >（但不是 />）
        // 这处理的是多行开始标签的情况，例如：
        // <van-picker
        //   prop1="..."
        //   prop2="...">  <-- 这里是开始标签的结束
        const tagCloseMatch = currentLine.match(/>\s*$/);
        if (tagCloseMatch && j > i && !currentLine.includes('/>')) {
          // 找到了开始标签的结束，现在需要找到配对的结束标签
          let tagCount = 1;
          for (let k = j + 1; k <= templateRange.end.line; k++) {
            const searchLine = doc.lineAt(k).text;
            
            // 检查是否有同名的新开始标签（完整的单行标签）
            const newStartPattern = new RegExp(`<${tagName}\\b[^>]*>`, 'i');
            if (newStartPattern.test(searchLine) && !searchLine.includes('/>')) {
              tagCount++;
            }
            
            // 检查是否有结束标签
            if (tagEndPattern.test(searchLine)) {
              tagCount--;
              if (tagCount === 0) {
                endLine = k;
                foundClosing = true;
                break;
              }
            }
          }
          break;
        }
      }
      
      // 对于Vant组件，只有找到闭合标签才添加
      if (foundClosing) {
        vantComponentBlocks.push({
          range: new vscode.Range(
            new vscode.Position(startLine, 0),
            new vscode.Position(endLine, doc.lineAt(endLine).text.length)
          ),
          componentName,
          componentType: componentType as VueComponentType
        });
      }
    }
  }
  
  // 优化嵌套组件检测：移除被外层组件完全包含的内层组件
  return filterNestedComponents(vantComponentBlocks);
}

/**
 * 过滤嵌套组件，只保留外层组件
 * 当内层组件被外层组件完全包含时，移除内层组件的装饰
 */
export function filterNestedComponents(components: Array<{range: vscode.Range, componentName: string, componentType: VueComponentType}>): Array<{range: vscode.Range, componentName: string, componentType: VueComponentType}> {
  const filteredComponents: Array<{range: vscode.Range, componentName: string, componentType: VueComponentType}> = [];
  
  for (let i = 0; i < components.length; i++) {
    const currentComponent = components[i];
    let isNested = false;
    
    // 检查当前组件是否被其他组件完全包含
    for (let j = 0; j < components.length; j++) {
      if (i === j) continue;
      
      const otherComponent = components[j];
      
      // 检查当前组件是否被其他组件完全包含
      if (currentComponent.range.start.isAfterOrEqual(otherComponent.range.start) && 
          currentComponent.range.end.isBeforeOrEqual(otherComponent.range.end)) {
        isNested = true;
        break;
      }
    }
    
    // 只有非嵌套组件才保留
    if (!isNested) {
      filteredComponents.push(currentComponent);
    }
  }
  
  return filteredComponents;
}

/**
 * 检测Vant组件（单行）
 */
export function detectVantComponent(line: string): { componentName: string, componentType: VueComponentType } | null {
  // Vant组件检测模式
  const vantPatterns = [
    // Popup组件 - 各种弹窗
    { pattern: /<van-popup\b/, componentName: 'Popup', componentType: 'vant-popup' as VueComponentType },
    { pattern: /<Popup\b/, componentName: 'Popup', componentType: 'vant-popup' as VueComponentType },
    
    // Toast组件 - 轻提示
    { pattern: /<van-toast\b/, componentName: 'Toast', componentType: 'vant-toast' as VueComponentType },
    { pattern: /<Toast\b/, componentName: 'Toast', componentType: 'vant-toast' as VueComponentType },
    
    // List组件 - 列表
    { pattern: /<van-list\b/, componentName: 'List', componentType: 'vant-list' as VueComponentType },
    { pattern: /<List\b/, componentName: 'List', componentType: 'vant-list' as VueComponentType },
    
    // Field组件 - 输入框
    { pattern: /<van-field\b/, componentName: 'Field', componentType: 'vant-field' as VueComponentType },
    { pattern: /<Field\b/, componentName: 'Field', componentType: 'vant-field' as VueComponentType },
    
    // Picker组件 - 选择器
    { pattern: /<van-picker\b/, componentName: 'Picker', componentType: 'vant-picker' as VueComponentType },
    { pattern: /<Picker\b/, componentName: 'Picker', componentType: 'vant-picker' as VueComponentType },
    
    // Tabs组件 - 标签页容器
    { pattern: /<van-tabs\b/, componentName: 'Tabs', componentType: 'vant-tabs' as VueComponentType },
    { pattern: /<Tabs\b/, componentName: 'Tabs', componentType: 'vant-tabs' as VueComponentType },
    
    // Tab组件 - 标签页项
    { pattern: /<van-tab\b/, componentName: 'Tab', componentType: 'vant-tab' as VueComponentType },
    { pattern: /<Tab\b/, componentName: 'Tab', componentType: 'vant-tab' as VueComponentType },
    
    // Cell组件 - 单元格
    { pattern: /<van-cell\b/, componentName: 'Cell', componentType: 'vant-cell' as VueComponentType },
    { pattern: /<Cell\b/, componentName: 'Cell', componentType: 'vant-cell' as VueComponentType },
    
    // Dialog组件 - 对话框
    { pattern: /<van-dialog\b/, componentName: 'Dialog', componentType: 'vant-dialog' as VueComponentType },
    { pattern: /<Dialog\b/, componentName: 'Dialog', componentType: 'vant-dialog' as VueComponentType },
    
    // CellGroup组件 - 单元格组
    { pattern: /<van-cell-group\b/, componentName: 'CellGroup', componentType: 'vant-cell-group' as VueComponentType },
    { pattern: /<CellGroup\b/, componentName: 'CellGroup', componentType: 'vant-cell-group' as VueComponentType },
  ];
  
  for (const { pattern, componentName, componentType } of vantPatterns) {
    if (pattern.test(line)) {
      return { componentName, componentType };
    }
  }
  
  return null;
}

/**
 * 检测多行Vue API声明（ref/reactive/computed/watch/watchEffect/生命周期）
 */
export function detectMultilineVueAPI(doc: vscode.TextDocument, scriptRange: vscode.Range): Array<{range: vscode.Range, name: string, type: string, apiType: string}> {
  const multilineVueAPI: Array<{range: vscode.Range, name: string, type: string, apiType: string}> = [];
  
  for (let i = scriptRange.start.line; i <= scriptRange.end.line; i++) {
    const line = doc.lineAt(i).text;
    
    // 检测各种Vue API开始
    const patterns = [
      // ref/reactive
      { pattern: /^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(ref|reactive)\s*\(/, apiType: 'vue-ref' },
      // computed
      { pattern: /^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*computed\s*\(/, apiType: 'vue-computed' },
      // watch
      { pattern: /^\s*watch\s*\(/, apiType: 'vue-watch' },
      // watchEffect
      { pattern: /^\s*watchEffect\s*\(/, apiType: 'vue-watch' },
      // 生命周期钩子 - 需要特殊处理，因为每个钩子都有不同的类型
    ];
    
    let matchFound = false;
    let apiType = '';
    let name = '';
    
    for (const { pattern, apiType: type } of patterns) {
      const match = line.match(pattern);
      if (match) {
        if (match[1]) {
          name = match[1]; // 变量名或函数名
        } else {
          name = match[0].trim().split('(')[0].trim(); // 对于watch/watchEffect
        }
        apiType = type;
        matchFound = true;
        break;
      }
    }
    
    // 特殊处理生命周期钩子
    if (!matchFound) {
      const lifecycleMatch = line.match(/^\s*(onMounted|onUnmounted|onUpdated|onBeforeMount|onBeforeUnmount|onBeforeUpdate|onActivated|onDeactivated)\s*\(/);
      if (lifecycleMatch) {
        const hookName = lifecycleMatch[1];
        name = hookName;
        // 根据钩子名称分配不同的类型
        const lifecycleTypeMap: Record<string, string> = {
          'onMounted': 'vue-lifecycle-mounted',
          'onUnmounted': 'vue-lifecycle-unmounted',
          'onUpdated': 'vue-lifecycle-updated',
          'onBeforeMount': 'vue-lifecycle-before-mount',
          'onBeforeUnmount': 'vue-lifecycle-before-unmount',
          'onBeforeUpdate': 'vue-lifecycle-before-update',
          'onActivated': 'vue-lifecycle-activated',
          'onDeactivated': 'vue-lifecycle-deactivated'
        };
        apiType = lifecycleTypeMap[hookName] || 'vue-lifecycle-mounted';
        matchFound = true;
      }
    }
    
    if (matchFound) {
      const startLine = i;
      let braceCount = 0;
      let foundStartBrace = false;
      let endLine = i;
      
      // 查找第一个大括号或圆括号
      for (let j = i; j <= scriptRange.end.line; j++) {
        const currentLine = doc.lineAt(j).text;
        if (currentLine.includes('{') || currentLine.includes('(')) {
          foundStartBrace = true;
          break;
        }
        if (j > i + 3) break; // 最多向前查找3行
      }
      
      if (foundStartBrace) {
        // 从找到的括号开始计数
        for (let j = i; j <= scriptRange.end.line; j++) {
          const currentLine = doc.lineAt(j).text;
          
          for (let k = 0; k < currentLine.length; k++) {
            if (currentLine[k] === '{' || currentLine[k] === '(') {
              braceCount++;
            } else if (currentLine[k] === '}' || currentLine[k] === ')') {
              braceCount--;
              if (braceCount === 0) {
                endLine = j;
                break;
              }
            }
          }
          
          if (braceCount === 0) break;
        }
        
        // 检查是否是多行（超过1行）
        const lineCount = endLine - startLine + 1;
        if (lineCount > 1) {
          multilineVueAPI.push({
            range: new vscode.Range(
              new vscode.Position(startLine, 0),
              new vscode.Position(endLine, doc.lineAt(endLine).text.length)
            ),
            name,
            type: apiType,
            apiType
          });
        }
      }
    }
  }
  
  return multilineVueAPI;
}

/**
 * 检测长函数（超过10行）
 */
export function detectLongFunctions(doc: vscode.TextDocument, scriptRange: vscode.Range): Array<{range: vscode.Range, functionName: string, lineCount: number}> {
  const longFunctions: Array<{range: vscode.Range, functionName: string, lineCount: number}> = [];
  
  for (let i = scriptRange.start.line; i <= scriptRange.end.line; i++) {
    const line = doc.lineAt(i).text;
    
    // 检测函数开始 - 支持更多函数声明格式
    const functionPatterns = [
      /^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:function\s*)?\([^)]*\)\s*=>\s*\{/,  // 箭头函数
      /^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:function\s*)?\([^)]*\)\s*\{/,     // 函数表达式
      /^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/,                                   // 函数声明
      /^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>\s*\{/,                // 箭头函数（无function关键字）
    ];
    
    let functionName = '';
    let matchFound = false;
    
    for (const pattern of functionPatterns) {
      const match = line.match(pattern);
      if (match) {
        functionName = match[1];
        matchFound = true;
        break;
      }
    }
    
    if (matchFound) {
      const startLine = i;
      let braceCount = 0;
      let foundStartBrace = false;
      let endLine = i;
      
      // 查找第一个大括号
      for (let j = i; j <= scriptRange.end.line; j++) {
        const currentLine = doc.lineAt(j).text;
        if (currentLine.includes('{')) {
          foundStartBrace = true;
          break;
        }
        if (j > i + 3) break; // 最多向前查找3行
      }
      
      if (foundStartBrace) {
        // 从找到的大括号开始计数
        for (let j = i; j <= scriptRange.end.line; j++) {
          const currentLine = doc.lineAt(j).text;
          
          for (let k = 0; k < currentLine.length; k++) {
            if (currentLine[k] === '{') {
              braceCount++;
            } else if (currentLine[k] === '}') {
              braceCount--;
              if (braceCount === 0) {
                endLine = j;
                break;
              }
            }
          }
          
          if (braceCount === 0) break;
        }
        
        // 检查函数长度
        const lineCount = endLine - startLine + 1;
        if (lineCount > 10) {
          longFunctions.push({
            range: new vscode.Range(
              new vscode.Position(startLine, 0),
              new vscode.Position(endLine, doc.lineAt(endLine).text.length)
            ),
            functionName,
            lineCount
          });
        }
      }
    }
  }
  
  return longFunctions;
}

/**
 * 解析Vue单文件组件结构
 */
export function parseVueSFC(doc: vscode.TextDocument): { template: vscode.Range | null, script: vscode.Range | null, style: vscode.Range | null } {
  let template: vscode.Range | null = null;
  let script: vscode.Range | null = null;
  let style: vscode.Range | null = null;
  
  let currentSection: 'template' | 'script' | 'style' | null = null;
  let sectionStart = -1;
  
  for (let i = 0; i < doc.lineCount; i++) {
    const line = doc.lineAt(i).text.trim();
    
    // 检测section开始
    if (line.startsWith('<template')) {
      currentSection = 'template';
      sectionStart = i;
    } else if (line.startsWith('<script')) {
      currentSection = 'script';
      sectionStart = i;
    } else if (line.startsWith('<style')) {
      currentSection = 'style';
      sectionStart = i;
    }
    // 检测section结束
    else if (line.startsWith('</template>') && currentSection === 'template') {
      template = new vscode.Range(sectionStart, 0, i, line.length);
      currentSection = null;
    } else if (line.startsWith('</script>') && currentSection === 'script') {
      script = new vscode.Range(sectionStart, 0, i, line.length);
      currentSection = null;
    } else if (line.startsWith('</style>') && currentSection === 'style') {
      style = new vscode.Range(sectionStart, 0, i, line.length);
      currentSection = null;
    }
  }
  
  return { template, script, style };
}
