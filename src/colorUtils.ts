/**
 * 颜色工具函数
 * 提供颜色格式转换、透明度提取和应用等功能
 */

/**
 * 将颜色转换为十六进制格式
 * 支持 rgb、rgba、#rgb、#rrggbb 等格式
 */
export function colorToHex(color: string): string {
  // 如果是 rgba 或 rgb
  const rgbMatch = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/i);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]);
    const g = parseInt(rgbMatch[2]);
    const b = parseInt(rgbMatch[3]);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
  
  // 如果是 #rgb 短格式
  if (color.match(/^#([0-9a-fA-F]{3})$/i)) {
    const short = color.slice(1);
    return `#${short[0]}${short[0]}${short[1]}${short[1]}${short[2]}${short[2]}`;
  }
  
  // 如果已经是 #rrggbb 格式
  if (color.match(/^#([0-9a-fA-F]{6})$/i)) {
    return color.toLowerCase();
  }
  
  return color;
}

/**
 * 从原始颜色中提取透明度（如果有的话）
 * @param originalColor 颜色字符串，如 "rgba(255, 0, 0, 0.5)"
 * @returns 透明度值（0-1），如果不是 rgba 格式则返回 null
 */
export function extractOpacity(originalColor: string): number | null {
  const rgbaMatch = originalColor.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/i);
  if (rgbaMatch) {
    return parseFloat(rgbaMatch[4]);
  }
  return null;
}

/**
 * 应用颜色透明度（用于底色模式）
 * 如果用户配置了透明度，保留用户配置；否则使用默认 0.9
 * 用户设置的透明度高于0.9时，强制使用0.9（避免遮挡文本选中高亮）
 * 
 * @param hexColor 十六进制颜色字符串，如 "#ff0000"
 * @param originalColor 原始颜色字符串，可能包含透明度信息
 * @param defaultOpacity 默认透明度，默认为 0.9
 * @param context 上下文信息，用于警告消息（如 "钩子"、"区域"、"Vue装饰"）
 * @returns rgba 格式的颜色字符串
 */
export function applyColorWithOpacity(
  hexColor: string, 
  originalColor: string, 
  defaultOpacity: number = 0.9,
  context: string = '颜色'
): string {
  const hexMatch = hexColor.match(/^#([0-9a-fA-F]{6})$/i);
  if (!hexMatch) {
    // 如果 hexColor 不是有效的十六进制格式，尝试转换
    const converted = colorToHex(hexColor);
    const convertedMatch = converted.match(/^#([0-9a-fA-F]{6})$/i);
    if (convertedMatch) {
      // 递归调用，使用转换后的颜色
      return applyColorWithOpacity(converted, originalColor, defaultOpacity, context);
    }
    // 如果转换失败，返回原始颜色
    return originalColor;
  }
  
  const hex = hexMatch[1];
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  
  // 如果用户配置了透明度，使用用户配置的；否则使用默认值
  const userOpacity = extractOpacity(originalColor);
  const finalOpacity = userOpacity !== null ? Math.min(userOpacity, 0.9) : defaultOpacity;
  
  // 如果用户配置的透明度 >= 0.9，给出警告
  if (userOpacity !== null && userOpacity >= 0.9) {
    console.warn(`[CodeHue] ⚠️ 警告：${context}颜色透明度过高 (${userOpacity.toFixed(2)})，已自动调整为 0.9 以保持文本选中高亮可见。`);
  }
  
  return `rgba(${r}, ${g}, ${b}, ${finalOpacity})`;
}

