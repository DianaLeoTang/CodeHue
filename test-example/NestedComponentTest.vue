<template>
  <div class="nested-component-test">
    <!-- 测试嵌套组件：van-picker 嵌套在 van-popup 中 -->
    <van-popup v-model:show="state.showCateList" position="bottom">
      <van-picker
        title="问题类型"
        :columns="constState.cate_list"
        @cancel="state.showCateList = false"
        @confirm="onConfirm($event, 'showCateList', 'category_sub', 'category_sub_text')"
      />
    </van-popup>

    <!-- 测试其他嵌套情况 -->
    <van-popup v-model:show="showPicker" position="bottom">
      <van-picker
        v-model="selectedValue"
        :columns="columns"
        title="选择城市"
        @confirm="onPickerConfirm"
        @cancel="onPickerCancel"
      />
    </van-popup>

    <!-- 测试多层嵌套 -->
    <van-popup v-model:show="showDialog" position="center">
      <van-dialog
        v-model:show="showDialog"
        title="确认操作"
        message="确定要执行此操作吗？"
        show-cancel-button
        @confirm="onDialogConfirm"
        @cancel="onDialogCancel"
      />
    </van-popup>

    <!-- 测试非嵌套的独立组件 -->
    <van-picker
      v-model="standalonePicker"
      :columns="standaloneColumns"
      title="独立选择器"
      @confirm="onStandaloneConfirm"
    />

    <!-- 测试按钮触发 -->
    <van-button type="primary" @click="showPicker = true">
      显示选择器
    </van-button>
    
    <van-button type="warning" @click="showDialog = true">
      显示对话框
    </van-button>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'

// 状态管理
const state = reactive({
  showCateList: false
})

const constState = reactive({
  cate_list: [
    { text: '技术问题', value: 'tech' },
    { text: '功能问题', value: 'feature' },
    { text: '界面问题', value: 'ui' }
  ]
})

// 其他状态
const showPicker = ref(false)
const showDialog = ref(false)
const selectedValue = ref('')
const standalonePicker = ref('')

// 数据
const columns = ref([
  { text: '北京', value: 'beijing' },
  { text: '上海', value: 'shanghai' },
  { text: '广州', value: 'guangzhou' }
])

const standaloneColumns = ref([
  { text: '选项1', value: 'option1' },
  { text: '选项2', value: 'option2' },
  { text: '选项3', value: 'option3' }
])

// 事件处理
const onConfirm = (value, showKey, subKey, textKey) => {
  console.log('确认选择:', value)
  state[showKey] = false
}

const onPickerConfirm = (value) => {
  console.log('选择器确认:', value)
  showPicker.value = false
}

const onPickerCancel = () => {
  console.log('选择器取消')
  showPicker.value = false
}

const onDialogConfirm = () => {
  console.log('对话框确认')
  showDialog.value = false
}

const onDialogCancel = () => {
  console.log('对话框取消')
  showDialog.value = false
}

const onStandaloneConfirm = (value) => {
  console.log('独立选择器确认:', value)
}
</script>

<style scoped>
.nested-component-test {
  padding: 20px;
}
</style>
