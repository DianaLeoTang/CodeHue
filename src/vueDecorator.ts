import * as vscode from 'vscode';
import { onExclusionRanges } from './exclusionBus';
import { VueDecoratedItem } from './vueTypes';
import { findVueDecoratedItems, applyVueDecorations as applyVueDecorationsInternal, disposeVueDecorations as disposeVueDecorationsInternal } from './vueDecorators';

let suppressRanges: vscode.Range[] = [];
onExclusionRanges((rs) => { suppressRanges = rs; });

/** Vue 组件识别缓存 */
const vueItemCache = new Map<string, { items: VueDecoratedItem[]; version: number }>();

/** 防重复执行标志 */
let isApplyingVueDecorations = false;

/**
 * 应用Vue组件装饰
 */
export function applyVueDecorations(editor: vscode.TextEditor): void {
  // 防重复执行
  if (isApplyingVueDecorations) {
    return;
  }
  
  isApplyingVueDecorations = true;
  
  try {
    const doc = editor.document;
    
    // 只处理Vue文件
    if (doc.languageId !== 'vue') {
      return;
    }
    
    // 性能检查
    if (doc.lineCount > 10000) {
      return;
    }
  
    // 获取缓存或计算
    const docUri = doc.uri.toString();
    const docVersion = doc.version;
    
    let items: VueDecoratedItem[] = [];
    
    const cached = vueItemCache.get(docUri);
    if (cached && cached.version === docVersion) {
      items = cached.items;
    } else {
      items = findVueDecoratedItems(doc);
      vueItemCache.set(docUri, { items, version: docVersion });
      
      // 限制缓存大小
      if (vueItemCache.size > 50) {
        const firstKey = vueItemCache.keys().next().value;
        if (firstKey) vueItemCache.delete(firstKey);
      }
    }
    
    // 应用装饰
    applyVueDecorationsInternal(editor, items);
    
  } finally {
    isApplyingVueDecorations = false;
  }
}

/**
 * 清理资源
 */
export function disposeVueDecorations(): void {
  vueItemCache.clear();
  disposeVueDecorationsInternal();
}

/**
 * 获取当前文件中所有的Vue装饰项
 */
export function getVueDecoratedItems(doc: vscode.TextDocument): VueDecoratedItem[] {
  return findVueDecoratedItems(doc);
}