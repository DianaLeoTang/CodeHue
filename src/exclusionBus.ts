import * as vscode from 'vscode';

/**
 * 一个极简的“排除总线”：Region 把自身的范围发布出去；函数装饰在渲染前做相减。
 */

type RangesListener = (ranges: vscode.Range[]) => void;

let lastRanges: vscode.Range[] = [];
const listeners = new Set<RangesListener>();

export function publishExclusionRanges(ranges: vscode.Range[]) {
  lastRanges = ranges;
  for (const l of listeners) {
    try { l(ranges); } catch { /* noop */ }
  }
}

export function onExclusionRanges(listener: RangesListener): vscode.Disposable {
  listeners.add(listener);
  // 立即回放一次，保持同步
  try { listener(lastRanges); } catch { /* noop */ }
  return {
    dispose() {
      listeners.delete(listener);
    }
  };
}

export function getLastExclusionRanges(): vscode.Range[] {
  return lastRanges;
}
