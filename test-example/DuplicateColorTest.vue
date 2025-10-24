<template>
  <div class="test-container">
    <!-- 测试可能导致重复着色的情况 -->
    
    <!-- 1. 测试嵌套组件 -->
    <van-popup v-model:show="showPopup" position="bottom">
      <van-picker
        title="问题类型"
        :columns="cateList"
        @cancel="showPopup = false"
        @confirm="onConfirm"
      />
    </van-popup>

    <!-- 2. 测试带有指令的div（不再识别@click事件） -->
    <div class="foot" v-model="testValue">
      <img :src="check" alt="" />
    </div>

    <!-- 3. 测试带有v-model的div -->
    <div v-model="testValue" class="test-div">
      <span>测试内容</span>
    </div>

    <!-- 4. 测试带有v-if的div -->
    <div v-if="showContent" class="conditional-div">
      <p>条件显示的内容</p>
    </div>

    <!-- 5. 测试独立的van-picker -->
    <van-picker
      v-model="selectedValue"
      :columns="columns"
      title="独立选择器"
      @confirm="onPickerConfirm"
    />

    <!-- 6. 测试按钮触发 -->
    <van-button type="primary" @click="showPopup = true">
      显示弹窗
    </van-button>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// 状态管理
const showPopup = ref(false)
const showContent = ref(true)
const testValue = ref('')
const selectedValue = ref('')
const check = ref('/path/to/image.png')

// 数据
const cateList = ref([
  { text: '技术问题', value: 'tech' },
  { text: '功能问题', value: 'feature' },
  { text: '界面问题', value: 'ui' }
])

const columns = ref([
  { text: '选项1', value: 'option1' },
  { text: '选项2', value: 'option2' },
  { text: '选项3', value: 'option3' }
])

// 事件处理
const submit = () => {
  console.log('提交表单')
}

const onConfirm = (value) => {
  console.log('确认选择:', value)
  showPopup.value = false
}

const onPickerConfirm = (value) => {
  console.log('选择器确认:', value)
}
</script>

<style scoped>
.test-container {
  padding: 20px;
}

.foot {
  padding: 10px;
  background-color: #f0f0f0;
  cursor: pointer;
}

.test-div {
  padding: 15px;
  border: 1px solid #ddd;
  margin: 10px 0;
}

.conditional-div {
  padding: 15px;
  background-color: #e8f5e8;
  margin: 10px 0;
}
</style>
