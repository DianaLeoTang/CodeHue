import * as vscode from 'vscode';
import { disposeFunctionDecorations, refreshFunctionDecorations } from './functionDecorator';
import { applyRegionDecorations, disposeRegionDecorations, disposeRegionEmitter, onRegionsChanged } from './regionDecorator';
import { clearTranslationCache, setTranslationCompleteCallback, initializeCache } from './semanticTranslator';
import { applyHooksAndRegionsDecorations } from './hooksDecorator';
import { applyVueDecorations, disposeVueDecorations } from './vueDecorator';
// 防抖定时器
let debounceTimer: NodeJS.Timeout | undefined;

// 性能限制：最大文件行数
const MAX_FILE_LINES = 10000;

// 上次处理的文档版本，用于避免重复处理
let lastProcessedVersion = new Map<string, number>();

// 判断是否是代码文件
function isCodeFile(doc: vscode.TextDocument): boolean {
  const codeLanguages = [
    'javascript', 'typescript', 'javascriptreact', 'typescriptreact',
    'vue'
  ];
  return codeLanguages.includes(doc.languageId);
}

// 应用所有装饰（force=true 时无视文档版本缓存，强制刷新）
function applyAll(editor: vscode.TextEditor, force = false) {
  if (!editor || editor.document.isClosed) return;
  
  // 只处理代码文件
  if (!isCodeFile(editor.document)) {
    return;
  }
  
  const docUri = editor.document.uri.toString();
  const docVersion = editor.document.version;
  
  // 检查是否已经处理过这个版本
  if (!force && lastProcessedVersion.get(docUri) === docVersion) {
    return;
  }
  
  // 性能检查：跳过过大的文件
  if (editor.document.lineCount > MAX_FILE_LINES) {
    return;
  }
  
  // 先清除所有装饰，避免叠加导致文本选择问题
  disposeRegionDecorations();
  disposeFunctionDecorations();
  disposeVueDecorations();
  
  // 先渲染 region（也会计算并发布 suppress 范围）
  applyRegionDecorations(editor, force); // 🔥 传递 force 参数以强制重建装饰
  
  // 根据文件类型应用不同的装饰
  if (editor.document.languageId === 'vue') {
    applyVueDecorations(editor);
  } else {
    // 再渲染函数，并对 region 进行相减
    applyHooksAndRegionsDecorations(editor);
  }
  
  // 记录已处理的版本
  lastProcessedVersion.set(docUri, docVersion);
  
  // 限制版本缓存大小
  if (lastProcessedVersion.size > 100) {
    const firstKey = lastProcessedVersion.keys().next().value;
    if (firstKey) {
      lastProcessedVersion.delete(firstKey);
    }
  }
}

// 防抖版本的应用函数（支持强制刷新）
function applyAllDebounced(editor: vscode.TextEditor, force = false) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  debounceTimer = setTimeout(() => {
    applyAll(editor, force);
  }, 150); // 150ms 防抖延迟
}

// 激活扩展
export function activate(context: vscode.ExtensionContext) {
  // 🔥 关键修改1：初始化翻译缓存系统（加载持久化缓存）
  initializeCache(context);
  
  // 设置翻译完成回调：翻译完成后刷新界面
  setTranslationCompleteCallback(() => {
    const ed = vscode.window.activeTextEditor;
    if (ed) {
      applyAllDebounced(ed, true); // 强制刷新，确保显示最新翻译
    }
  });

  // 🔥 关键修改2：处理当前已打开的所有文档
  vscode.workspace.textDocuments.forEach(doc => {
    // 只处理代码文件
    if (isCodeFile(doc)) {
      const editor = vscode.window.visibleTextEditors.find(e => e.document === doc);
      if (editor) {
        applyAll(editor);
      }
    }
  });

  // 首次启动对激活编辑器应用
  if (vscode.window.activeTextEditor && isCodeFile(vscode.window.activeTextEditor.document)) {
    applyAll(vscode.window.activeTextEditor);
  }

  // 编辑器切换
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((ed) => {
      if (ed && isCodeFile(ed.document)) {
        applyAll(ed);
      }
    })
  );

  // 🔥 关键修改3：监听可见区域变化（滚动时优先翻译可见区域）
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
      // 可见区域变化时重新应用装饰，会触发优先级更高的翻译
      applyAllDebounced(event.textEditor, true);
    })
  );

  // 🔥 关键修改4：监听文档打开事件
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (isCodeFile(doc)) {
        const editor = vscode.window.visibleTextEditors.find(e => e.document === doc);
        if (editor) {
          applyAll(editor);
        }
      }
    })
  );

  // 文档内容变化 - 使用防抖版本
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      const ed = vscode.window.activeTextEditor;
      if (ed && e.document === ed.document) {
        applyAllDebounced(ed);
      }
    })
  );

  // Region 变化（例如颜色或解析到的新范围）- 使用防抖版本
  context.subscriptions.push(
    onRegionsChanged(() => {
      const ed = vscode.window.activeTextEditor;
      if (ed) applyAllDebounced(ed);
    })
  );

  // 手动刷新命令
  context.subscriptions.push(
    vscode.commands.registerCommand('codehue.refresh', () => {
      const ed = vscode.window.activeTextEditor;
      if (ed) {
        applyAll(ed, true); // 强制刷新
      }
    })
  );

  // 清空翻译缓存命令
  context.subscriptions.push(
    vscode.commands.registerCommand('codehue.clearCache', () => {
      clearTranslationCache();
      vscode.window.showInformationMessage('翻译缓存已清空');
      const ed = vscode.window.activeTextEditor;
      if (ed) {
        applyAll(ed, true); // 强制刷新
      }
    })
  );

  // 退出清理
  context.subscriptions.push({ 
    dispose: () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      lastProcessedVersion.clear();
      disposeAll();
    }
  });

  // 配置变更时强制刷新可见代码编辑器，确保最新设置生效
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('codehue')) {
      
        disposeRegionDecorations();
          vscode.window.visibleTextEditors.forEach(editor => {
            if (isCodeFile(editor.document)) {
              applyAll(editor, true);
            }
          });
      }
    })
  );
}

// 清理所有资源
function disposeAll() {
  disposeFunctionDecorations();
  disposeRegionDecorations();
  disposeVueDecorations();
  disposeRegionEmitter(); // 清理 EventEmitter，防止内存泄漏
}

// 停用扩展
export function deactivate() {
  disposeAll();
}
