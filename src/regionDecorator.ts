import * as vscode from 'vscode';
import { publishExclusionRanges } from './exclusionBus';
import { COLOR_SCHEMES_LIGHT, COLOR_SCHEMES_DARK } from './colorSchemes';
import { colorToHex, applyColorWithOpacity } from './colorUtils';

let regionDecorationType: vscode.TextEditorDecorationType | null = null;
let lastRegionColor: string | null = null;
let cachedRegions: vscode.Range[] = [];

// 允许“行尾注释里的标记”，大小写不敏感
// 例：code ... // #region 费用明细弹窗
//      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ ← 只要这一段出现即可
const REGION_OPEN_RE  = /\/\/\s*#region\b(?:\s+(.+?))?\s*$/i;
const REGION_CLOSE_RE = /\/\/\s*#endregion\b(?:\s+(.+?))?\s*$/i;

// --- 事件：region 变化（供外部需要时订阅；当前由 extension.ts 统一刷新） ---
const _regionEmitter = new vscode.EventEmitter<void>();
export const onRegionsChanged = _regionEmitter.event;

function isDarkTheme(): boolean {
  const themeKind = vscode.window.activeColorTheme.kind;
  return themeKind === vscode.ColorThemeKind.Dark || themeKind === vscode.ColorThemeKind.HighContrast;
}

let lastThemeKind: vscode.ColorThemeKind | null = null;

// 仅左侧细条，不涂底色
// 确保装饰类型
let lastConfigString: string = '';


function ensureDecorationType(forceRecreate: boolean = false): vscode.TextEditorDecorationType {
  const config = vscode.workspace.getConfiguration('codehue');
  const explicitRegionColor = config.get<string>('regionColor');
  const regionDisplayMode = config.get<string>('regionDisplayMode', 'background'); // 'stripe' 或 'background'
  const stripeWidth = config.get<string>('regionStripeWidth', '3px');
  
  // 👇 生成配置指纹，包含所有影响颜色的因素
  const currentConfigString = JSON.stringify({
    regionColor: explicitRegionColor,
    regionDisplayMode,
    stripeWidth,
    colorScheme: config.get<string>('colorScheme'),
    themeKind: vscode.window.activeColorTheme.kind
  });
  
  let rawColor = explicitRegionColor && explicitRegionColor.trim() !== ''
    ? explicitRegionColor
    : undefined;

  if (!rawColor) {
    const schemeName = config.get<string>('colorScheme', 'vibrant');
    const schemes = isDarkTheme() ? COLOR_SCHEMES_DARK : COLOR_SCHEMES_LIGHT;
    const scheme = schemes[schemeName] || schemes.vibrant;
    rawColor = scheme['region'] || 'rgba(76, 175, 80, 0.12)';
  }
  
  console.log('[CodeHue] 读取 regionColor 配置:', rawColor);
  console.log('[CodeHue] 显示模式:', regionDisplayMode);
  
  // 👇 关键改动：配置指纹变化或强制重建时，重新创建
  if (!regionDecorationType || lastConfigString !== currentConfigString || forceRecreate) {
    console.log('[CodeHue] 重新创建装饰类型');
    
    if (regionDecorationType) {
      regionDecorationType.dispose();
    }
    
    if (regionDisplayMode === 'stripe') {
      // 左侧条带模式 - 使用用户原始颜色
      const finalColor = colorToHex(rawColor);
      regionDecorationType = vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        borderStyle: 'solid',
        borderColor: finalColor,
        borderWidth: `0 0 0 ${stripeWidth}`,
        overviewRulerColor: finalColor,
        overviewRulerLane: vscode.OverviewRulerLane.Right,
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      });
    } else {
      // 底色模式 - 转换为十六进制并应用透明度
      const hexColor = colorToHex(rawColor);
      const finalColor = applyColorWithOpacity(hexColor, rawColor, 0.9, '区域');
      
      console.log('[CodeHue] 格式化后的颜色:', finalColor);
      
      regionDecorationType = vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: finalColor,
        overviewRulerColor: finalColor,
        overviewRulerLane: vscode.OverviewRulerLane.Right,
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      });
    }
    
    lastRegionColor = currentConfigString;
    lastConfigString = currentConfigString;
  }
  
  return regionDecorationType!;
}

// 统一把标签做“可宽松匹配”的规范化
// 规范化标签
function normLabel(raw?: string | null): string {
  if (!raw) return '__default__';
  return raw
    .replace(/\u3000/g, ' ')      // 全角空格 -> 半角
    .trim()
    .replace(/\s+/g, ' ')         // 多空格合一
    .toLowerCase();
}

// 行 -> 覆盖整行（到行末），不吃下一行的列0
// 行范围
function lineRange(doc: vscode.TextDocument, startLine: number, endLine: number): vscode.Range {
  const start = new vscode.Position(startLine, 0);
  const end = new vscode.Position(endLine, doc.lineAt(endLine).range.end.character);
  return new vscode.Range(start, end);
}

/**
 * 解析配对的 region 段：
 * - 支持行尾注释里的 #region / #endregion
 * - 标签大小写/多空格不敏感；无标签的 #endregion 关闭最近一次 #region
 * - 结果区间包含两端标记行
 */
// 解析区域
function parseRegions(doc: vscode.TextDocument): vscode.Range[] {
  type Frame = { label: string; line: number };
  const stack: Frame[] = [];
  const out: vscode.Range[] = [];

  for (let i = 0; i < doc.lineCount; i++) {
    const text = doc.lineAt(i).text;

    // 优先判断 close；避免同一行先 open 后 close 的极端写法导致顺序问题
    const closeM = text.match(REGION_CLOSE_RE);
    if (closeM) {
      const lbl = normLabel(closeM[1] ?? null);
      if (stack.length) {
        if (lbl === '__default__') {
          // 无标签：关最近一次
          const frame = stack.pop()!;
          out.push(lineRange(doc, frame.line, i));
        } else {
          // 有标签：从栈顶往上找最近的同标签
          let idx = -1;
          for (let k = stack.length - 1; k >= 0; k--) {
            if (stack[k].label === lbl) { idx = k; break; }
          }
          if (idx >= 0) {
            const frame = stack.splice(idx, 1)[0];
            out.push(lineRange(doc, frame.line, i));
          }
          // 若未找到同标签，忽略该 close（容错）
        }
      }
      continue; // 若同一行既有 close 又有 open，优先 close；下一轮再处理 open
    }

    const openM = text.match(REGION_OPEN_RE);
    if (openM) {
      const lbl = normLabel(openM[1] ?? null);
      stack.push({ label: lbl, line: i });
      continue;
    }
  }

  // 未闭合的 #region 直接忽略（不生成区间），让函数装饰来处理该区域

  // 仅保留“外层段”（去掉被完全包裹的嵌套段），避免叠条带
  return outermostOnly(sortByStart(out));
}

// 按开始位置排序
function sortByStart(ranges: vscode.Range[]): vscode.Range[] {
  return ranges.slice().sort((a, b) =>
    a.start.line - b.start.line || a.end.line - b.end.line
  );
}

// 仅保留最外层
function outermostOnly(ranges: vscode.Range[]): vscode.Range[] {
  const out: vscode.Range[] = [];
  for (const r of ranges) {
    const last = out[out.length - 1];
    if (!last) { out.push(r); continue; }
    // 若当前完全被上一个覆盖，则跳过（保留外层）
    if (r.start.isAfterOrEqual(last.start) && r.end.isBeforeOrEqual(last.end)) continue;
    // 若有交叠但不包含：把两段分开保留（不再强行合并成“大区间”，避免跨模块）
    if (!r.start.isAfter(last.end) && !r.end.isBefore(last.start)) {
      // 若需要“合并相邻仅空行”可在此加贴边合并逻辑；目前严格分段以避免串色
      if (r.end.isAfter(last.end)) {
        // 防止顺序错乱，直接追加
        out.push(r);
      }
      continue;
    }
    out.push(r);
  }
  return out;
}

// 应用区域装饰
export function applyRegionDecorations(editor: vscode.TextEditor, forceRecreate: boolean = false) {
  const doc = editor.document;
  const dt = ensureDecorationType(forceRecreate); // 🔥 传递 forceRecreate 参数
  cachedRegions = parseRegions(doc);

  // 渲染左侧条
  editor.setDecorations(dt, cachedRegions);
  // 发布排除范围（函数装饰据此做相减）
  publishExclusionRanges(cachedRegions);
  _regionEmitter.fire();
}

// 清理区域装饰
export function disposeRegionDecorations() {
  if (regionDecorationType) {
    regionDecorationType.dispose();
    regionDecorationType = null;
  }
  lastRegionColor = null;
  lastConfigString = ''; // 🔥 清空配置指纹，确保配置变更时能重建装饰
  cachedRegions = [];
}

// 清理 EventEmitter（仅在扩展停用时调用）
export function disposeRegionEmitter() {
  _regionEmitter.dispose();
}

// // 获取区域抑制范围
// export function getRegionSuppressionRanges(): vscode.Range[] {
//   // 给函数装饰用
//   return cachedRegions.length ? cachedRegions : getLastExclusionRanges();
// }
