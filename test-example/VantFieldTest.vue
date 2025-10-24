<template>
  <div class="test-container">
    <!-- 测试自闭合van-field组件 -->
    <van-field
      v-model="info.reported_phone"
      type="tel"
      label="被举报人手机号"
      placeholder="请输入11位手机号"
      clearable
      :required="true"
      maxlength="11"
      @clear="handleClear('reported_phone')"
    />
    
    <!-- 测试多行van-field组件 -->
    <van-field
      v-model="username"
      label="用户名"
      placeholder="请输入用户名"
      :rules="[{ required: true, message: '请填写用户名' }]"
      @blur="onUsernameBlur"
    >
      <template #right-icon>
        <van-icon name="search" />
      </template>
    </van-field>
    
    <!-- 测试单行van-field组件 -->
    <van-field v-model="email" label="邮箱" />
  </div>
</template>

<script setup>
import { ref } from 'vue'

const info = ref({
  reported_phone: ''
})

const username = ref('')
const email = ref('')

const handleClear = (field) => {
  console.log('清除字段:', field)
}

const onUsernameBlur = () => {
  console.log('用户名输入完成')
}
</script>

<style scoped>
.test-container {
  padding: 20px;
}
</style>
