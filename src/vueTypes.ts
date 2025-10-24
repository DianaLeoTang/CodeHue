/**
 * Vue 类型定义模块
 * 
 * 定义 Vue 相关的类型、常量和数据结构
 * 为 Vue 装饰器和检测器提供类型支持
 * 
 * 主要功能：
 * - 定义 Vue 组件类型枚举
 * - 提供颜色常量和配置
 * - 定义数据结构接口
 * - 导出通用组件配置
 */

import * as vscode from 'vscode';

/** Vue 组件类型 */
export type VueComponentType = 
  | 'vue-composition-api'  // Composition API
  | 'vue-lifecycle-mounted'     // onMounted
  | 'vue-lifecycle-unmounted'   // onUnmounted
  | 'vue-lifecycle-updated'     // onUpdated
  | 'vue-lifecycle-before-mount'    // onBeforeMount
  | 'vue-lifecycle-before-unmount'  // onBeforeUnmount
  | 'vue-lifecycle-before-update'   // onBeforeUpdate
  | 'vue-lifecycle-activated'       // onActivated
  | 'vue-lifecycle-deactivated'     // onDeactivated
  | 'vue-directive'        // 模板指令
  | 'vue-directive-block' // 模板指令块（包含指令的HTML标签）
  | 'vue-event'           // 事件处理
  | 'vue-computed'        // 计算属性
  | 'vue-watch'           // 监听器
  | 'vue-ref'             // ref/reactive
  | 'vue-function'        // Vue函数
  | 'vue-div-block'       // 模板div块
  | 'vant-popup'          // Vant Popup组件
  | 'vant-toast'          // Vant Toast组件
  | 'vant-list'           // Vant List组件
  | 'vant-field'          // Vant Field组件
  | 'vant-picker'         // Vant Picker组件
  | 'vant-tabs'           // Vant Tabs组件
  | 'vant-tab'            // Vant Tab组件
  | 'vant-cell'           // Vant Cell组件
  | 'vant-dialog'         // Vant Dialog组件
  | 'vant-cell-group';    // Vant CellGroup组件

export interface VueDecoratedItem {
  range: vscode.Range;
  type: VueComponentType;
  lineContent: string;
  section?: 'template' | 'script' | 'style';
}

/** Vue Composition API 关键字 */
export const VUE_COMPOSITION_API = [
  'ref', 'reactive', 'computed', 'watch', 'watchEffect',
  'onMounted', 'onUnmounted', 'onUpdated', 'onBeforeMount', 'onBeforeUnmount', 'onBeforeUpdate',
  'provide', 'inject', 'nextTick', 'defineProps', 'defineEmits', 'defineExpose'
] as const;

/** Vue 生命周期钩子 */
export const VUE_LIFECYCLE_HOOKS = [
  'onMounted', 'onUnmounted', 'onUpdated', 'onBeforeMount', 
  'onBeforeUnmount', 'onBeforeUpdate', 'onActivated', 'onDeactivated'
] as const;

/** Vue 模板指令 */
export const VUE_DIRECTIVES = [
  'v-if', 'v-else', 'v-else-if', 'v-for', 'v-show', 'v-model',
  'v-bind', 'v-on', 'v-slot', 'v-text', 'v-html', 'v-once', 'v-cloak'
] as const;

/** 彩虹色数组 - 马卡龙色系，用于div块区分 */
export const RAINBOW_COLORS = [
  'rgba(255, 182, 193, 0.3)',  // 樱花粉
  'rgba(173, 216, 230, 0.3)',   // 浅蓝
  'rgba(221, 160, 221, 0.3)',  // 淡紫
  'rgba(144, 238, 144, 0.3)',   // 薄荷绿
  'rgba(255, 218, 185, 0.3)',  // 桃色
  'rgba(255, 192, 203, 0.3)',  // 粉红
  'rgba(176, 224, 230, 0.3)',  // 淡青
  'rgba(230, 230, 250, 0.3)',  // 薰衣草
  'rgba(152, 251, 152, 0.3)',  // 春绿
  'rgba(255, 228, 196, 0.3)',  // 米色
  'rgba(255, 239, 213, 0.3)',  // 香草
  'rgba(240, 248, 255, 0.3)',  // 爱丽丝蓝
  'rgba(255, 240, 245, 0.3)',  // 薰衣草雾
  'rgba(240, 255, 240, 0.3)',  // 蜜瓜
  'rgba(255, 250, 240, 0.3)',  // 亚麻
  'rgba(248, 248, 255, 0.3)',  // 幽灵白
  'rgba(255, 245, 238, 0.3)',  // 海贝壳
  'rgba(245, 255, 250, 0.3)',  // 薄荷奶油
  'rgba(250, 240, 230, 0.3)'   // 亚麻布
];

/** 常用组件识别配置 - 马卡龙色系 */
export const COMMON_COMPONENTS = [
  { name: 'Popup', pattern: /<Popup\b/i, color: 'rgba(255, 182, 193,0.3)', type: '弹出层' },      // 樱花粉
  { name: 'Toast', pattern: /<Toast\b/i, color: 'rgba(173, 216, 230,0.3)', type: '轻提示' },      // 浅蓝
  { name: 'List', pattern: /<List\b/i, color: 'rgba(221, 160, 221,0.3)', type: '列表' },         // 淡紫
  { name: 'Field', pattern: /<Field\b/i, color: 'rgba(144, 238, 144,0.3)', type: '输入框' },     // 薄荷绿
  { name: 'Tabs', pattern: /<Tabs\b/i, color: 'rgba(255, 218, 185,0.3)', type: '标签页' },       // 桃色
  { name: 'Picker', pattern: /<Picker\b/i, color: 'rgba(255, 192, 203,0.3)', type: '选择器' },   // 粉红
  { name: 'Tab', pattern: /<Tab\b/i, color: 'rgba(176, 224, 230,0.3)', type: '标签页项' },        // 淡青
  { name: 'Cell', pattern: /<Cell\b/i, color: 'rgba(230, 230, 250,0.3)', type: '单元格' },        // 薰衣草
  { name: 'Dialog', pattern: /<Dialog\b/i, color: 'rgba(152, 251, 152,0.3)', type: '对话框' },   // 春绿
  { name: 'CellGroup', pattern: /<CellGroup\b/i, color: 'rgba(255, 228, 196,0.3)', type: '单元格组' } // 米色
];

/** 函数颜色数组 - 马卡龙色系，用于长函数区分 */
export const FUNCTION_COLORS = [
  'rgba(255, 182, 193, 0.3)',  // 樱花粉
  'rgba(173, 216, 230, 0.3)',   // 浅蓝
  'rgba(221, 160, 221, 0.3)',  // 淡紫
  'rgba(144, 238, 144, 0.3)',   // 薄荷绿
  'rgba(255, 218, 185, 0.3)',  // 桃色
  'rgba(255, 192, 203, 0.3)',  // 粉红
  'rgba(176, 224, 230, 0.3)',  // 淡青
  'rgba(230, 230, 250, 0.3)',  // 薰衣草
  'rgba(152, 251, 152, 0.3)',  // 春绿
  'rgba(255, 228, 196, 0.3)',  // 米色
  'rgba(255, 239, 213, 0.3)',  // 香草
  'rgba(240, 248, 255, 0.3)',  // 爱丽丝蓝
  'rgba(255, 240, 245, 0.3)',  // 薰衣草雾
  'rgba(240, 255, 240, 0.3)',  // 蜜瓜
  'rgba(255, 250, 240, 0.3)',  // 亚麻
  'rgba(248, 248, 255, 0.3)',  // 幽灵白
  'rgba(255, 245, 238, 0.3)',  // 海贝壳
  'rgba(245, 255, 250, 0.3)',  // 薄荷奶油
  'rgba(250, 240, 230, 0.3)'   // 亚麻布
];