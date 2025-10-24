import * as vscode from 'vscode';
import { publishExclusionRanges, getLastExclusionRanges } from './exclusionBus';

let regionDecorationType: vscode.TextEditorDecorationType | null = null;
let cachedRegions: vscode.Range[] = [];

// 允许“行尾注释里的标记”，大小写不敏感
// 例：code ... // #region 费用明细弹窗
//      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ ← 只要这一段出现即可
const REGION_OPEN_RE  = /\/\/\s*#region\b(?:\s+(.+?))?\s*$/i;
const REGION_CLOSE_RE = /\/\/\s*#endregion\b(?:\s+(.+?))?\s*$/i;

// --- 事件：region 变化（供外部需要时订阅；当前由 extension.ts 统一刷新） ---
const _regionEmitter = new vscode.EventEmitter<void>();
export const onRegionsChanged = _regionEmitter.event;

// 仅左侧细条，不涂底色
// 确保装饰类型
function ensureDecorationType(): vscode.TextEditorDecorationType {
  const config = vscode.workspace.getConfiguration('codehue');
  const regionColor = config.get<string>('regionColor', 'rgba(76, 175, 80, 0.12)');
  
  
  // 如果配置改变，需要重新创建装饰类型
  if (regionDecorationType) {
    regionDecorationType.dispose();
    regionDecorationType = null;
  }
  
  regionDecorationType = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: regionColor,  // 使用 regionColor 作为背景色
    overviewRulerColor: regionColor,
    overviewRulerLane: vscode.OverviewRulerLane.Right,
  });
  return regionDecorationType;
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
export function applyRegionDecorations(editor: vscode.TextEditor) {
  const doc = editor.document;
  const dt = ensureDecorationType();
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
  cachedRegions = [];
}

// // 获取区域抑制范围
// export function getRegionSuppressionRanges(): vscode.Range[] {
//   // 给函数装饰用
//   return cachedRegions.length ? cachedRegions : getLastExclusionRanges();
// }
