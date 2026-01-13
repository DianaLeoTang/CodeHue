import * as vscode from 'vscode';

/**
 * 读取用户显式配置的设置值（工作区文件夹 > 工作区 > 全局）。
 * 若没有用户覆盖，则返回 undefined。
 */
export function getExplicitSetting<T>(config: vscode.WorkspaceConfiguration, key: string): T | undefined {
  const inspection = config.inspect<T>(key);
  if (!inspection) {
    return undefined;
  }

  const {
    workspaceFolderLanguageValue,
    workspaceLanguageValue,
    globalLanguageValue,
    workspaceFolderValue,
    workspaceValue,
    globalValue,
  } = inspection;

  const orderedCandidates = [
    workspaceFolderLanguageValue,
    workspaceLanguageValue,
    globalLanguageValue,
    workspaceFolderValue,
    workspaceValue,
    globalValue,
  ];

  for (const candidate of orderedCandidates) {
    if (candidate !== undefined) {
      return candidate;
    }
  }

  return undefined;
}
