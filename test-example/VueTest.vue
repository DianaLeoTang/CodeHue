<template>
  <div class="vue-test-component">
    <h1>{{ title }}</h1>
    
    <!-- 常用组件测试 -->
    <Popup v-model:show="showPopup" position="bottom">
      <div class="popup-content">
        <h3>弹出层内容</h3>
        <p>这是一个弹出层组件</p>
      </div>
    </Popup>
    
    <Toast v-model:show="showToast" message="操作成功" type="success" />
    
    <List v-model:loading="loading" @load="loadMore">
      <Cell v-for="item in listData" :key="item.id" :title="item.title" />
    </List>
    
    <Field v-model="inputValue" label="用户名" placeholder="请输入用户名" />
    
    <Tabs v-model:active="activeTab">
      <Tab title="首页">首页内容</Tab>
      <Tab title="关于">关于内容</Tab>
    </Tabs>
    
    <Picker v-model="selectedDate" title="选择日期" :columns="dateColumns" />
    
    <CellGroup>
      <Cell title="姓名" :value="userInfo.name" />
      <Cell title="年龄" :value="userInfo.age" />
    </CellGroup>
    
    <Dialog v-model:show="showDialog" title="确认删除" message="确定要删除这个项目吗？" />
    
    <!-- 头部导航区域 -->
    <div class="header-nav" id="main-nav">
      <nav class="navigation">
        <ul>
          <li>首页</li>
          <li>关于</li>
          <li>联系</li>
        </ul>
      </nav>
    </div>
    
    <!-- Vue 指令测试 -->
    <div v-if="isVisible" class="conditional-content">
      <p>这是条件渲染的内容</p>
    </div>
    
    <div v-show="showContent" class="show-content">
      <p>这是 v-show 控制的内容</p>
    </div>
    
    <!-- 主内容区域 -->
    <div class="main-content">
      <h2>主要内容</h2>
      <p>这里是页面的主要内容区域</p>
    </div>
    
    <!-- Vue 事件处理测试 -->
    <div class="button-container" @click="handleClick">
      <button @click="handleClick" class="click-button">
        点击我
      </button>
      
      <button @input="handleInput" class="input-button">
        输入事件
      </button>
    </div>
    
    <!-- 表单区域 -->
    <div class="form-section" v-model="formData">
      <form @submit="handleSubmit">
        <input v-model="inputValue" placeholder="请输入内容" />
        <p>输入的值: {{ inputValue }}</p>
      </form>
    </div>
    
    <!-- Vue 循环测试 -->
    <div class="list-container">
      <ul>
        <li v-for="item in items" :key="item.id" class="list-item">
          {{ item.name }}
        </li>
      </ul>
    </div>
    
    <!-- 侧边栏区域 -->
    <div class="sidebar">
      <aside>
        <h3>侧边栏</h3>
        <p>这里是侧边栏内容</p>
      </aside>
    </div>
    
    <!-- Vue 插槽测试 -->
    <div class="slot-container">
      <slot name="header">
        <h2>默认头部</h2>
      </slot>
      <slot>
        <p>默认内容</p>
      </slot>
    </div>
    
    <!-- 嵌套div测试 -->
    <div class="nested-container">
      <div class="inner-div">
        <div class="deep-div">
          <p>深层嵌套的div</p>
        </div>
      </div>
    </div>
    
    <!-- 底部区域 -->
    <div class="footer-section">
      <footer>
        <p>© 2024 Vue Test Component</p>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'

// === Vue Composition API 测试 ===

// 响应式数据 - ref
const title = ref('Vue 组件测试')
const isVisible = ref(true)
const showContent = ref(false)
const inputValue = ref('')

// 响应式数据 - reactive
const state = reactive({
  count: 0,
  message: 'Hello Vue!',
  user: {
    name: 'Vue User',
    age: 25
  }
})

// 计算属性
const doubleCount = computed(() => state.count * 2)
const userInfo = computed(() => `${state.user.name} (${state.user.age}岁)`)

// 监听器 - watch
watch(
  () => state.count,
  (newCount, oldCount) => {
    console.log(`计数从 ${oldCount} 变为 ${newCount}`)
  }
)

// 监听器 - watchEffect
watchEffect(() => {
  console.log('当前计数:', state.count)
  console.log('当前消息:', state.message)
})

// 生命周期钩子
onMounted(() => {
  console.log('组件已挂载')
  // 初始化数据
  items.value = [
    { id: 1, name: 'Vue 3' },
    { id: 2, name: 'Composition API' },
    { id: 3, name: 'TypeScript' }
  ]
})

onUnmounted(() => {
  console.log('组件即将卸载')
})

// 方法定义
const handleClick = () => {
  state.count++
  isVisible.value = !isVisible.value
}

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  console.log('输入事件:', target.value)
}

// 数组数据
const items = ref<Array<{ id: number; name: string }>>([])

// 复杂响应式对象
const complexState = reactive({
  todos: [
    { id: 1, text: '学习 Vue 3', completed: false },
    { id: 2, text: '掌握 Composition API', completed: true },
    { id: 3, text: '使用 TypeScript', completed: false }
  ],
  filter: 'all' as 'all' | 'active' | 'completed'
})

// 计算属性 - 过滤后的待办事项
const filteredTodos = computed(() => {
  switch (complexState.filter) {
    case 'active':
      return complexState.todos.filter(todo => !todo.completed)
    case 'completed':
      return complexState.todos.filter(todo => todo.completed)
    default:
      return complexState.todos
  }
})

// 方法 - 添加待办事项
const addTodo = (text: string) => {
  const newTodo = {
    id: Date.now(),
    text,
    completed: false
  }
  complexState.todos.push(newTodo)
}

// 方法 - 切换待办事项状态
const toggleTodo = (id: number) => {
  const todo = complexState.todos.find(t => t.id === id)
  if (todo) {
    todo.completed = !todo.completed
  }
}

// 方法 - 删除待办事项
const removeTodo = (id: number) => {
  const index = complexState.todos.findIndex(t => t.id === id)
  if (index > -1) {
    complexState.todos.splice(index, 1)
  }
}

// 更多Vue函数测试
const calculateTotal = () => {
  return complexState.todos.length
}

const getCompletedCount = () => {
  return complexState.todos.filter(todo => todo.completed).length
}

const clearCompleted = () => {
  complexState.todos = complexState.todos.filter(todo => !todo.completed)
}

const validateInput = (text: string) => {
  return text.trim().length > 0
}

const formatDate = (date: Date) => {
  return date.toLocaleDateString('zh-CN')
}

const generateId = () => {
  return Date.now() + Math.random()
}

// 异步函数测试
const fetchUserData = async (userId: string) => {
  try {
    const response = await fetch(`/api/users/${userId}`)
    return await response.json()
  } catch (error) {
    console.error('获取用户数据失败:', error)
    return null
  }
}

// 长函数测试 - 复杂的数据处理函数
const processComplexData = (data: any[]) => {
  console.log('开始处理复杂数据')
  
  // 数据验证
  if (!Array.isArray(data)) {
    throw new Error('数据必须是数组')
  }
  
  // 数据清洗
  const cleanedData = data.filter(item => {
    return item && typeof item === 'object' && item.id
  })
  
  // 数据转换
  const transformedData = cleanedData.map(item => {
    const processed = {
      id: item.id,
      name: item.name || '未知',
      status: item.status || 'pending',
      createdAt: new Date(item.createdAt || Date.now()),
      updatedAt: new Date(item.updatedAt || Date.now())
    }
    
    // 计算额外属性
    processed.isActive = processed.status === 'active'
    processed.daysSinceCreated = Math.floor(
      (Date.now() - processed.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    )
    
    return processed
  })
  
  // 数据排序
  transformedData.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status.localeCompare(b.status)
    }
    return b.createdAt.getTime() - a.createdAt.getTime()
  })
  
  // 数据分组
  const groupedData = transformedData.reduce((groups, item) => {
    const key = item.status
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(item)
    return groups
  }, {} as Record<string, any[]>)
  
  // 生成统计信息
  const statistics = {
    total: transformedData.length,
    active: transformedData.filter(item => item.isActive).length,
    pending: transformedData.filter(item => item.status === 'pending').length,
    completed: transformedData.filter(item => item.status === 'completed').length,
    averageDays: transformedData.reduce((sum, item) => sum + item.daysSinceCreated, 0) / transformedData.length
  }
  
  console.log('数据处理完成', statistics)
  return {
    data: transformedData,
    grouped: groupedData,
    statistics
  }
}

// 长函数测试 - 复杂的API调用函数
const fetchUserDataWithRetry = async (userId: string, maxRetries: number = 3) => {
  console.log(`开始获取用户数据: ${userId}`)
  
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`尝试第 ${attempt} 次获取数据`)
      
      // 构建请求URL
      const baseUrl = process.env.VUE_APP_API_BASE_URL || 'https://api.example.com'
      const url = `${baseUrl}/users/${userId}`
      
      // 设置请求头
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'X-Request-ID': `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }
      
      // 发送请求
      const response = await fetch(url, {
        method: 'GET',
        headers,
        timeout: 10000
      })
      
      // 检查响应状态
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      // 解析响应数据
      const userData = await response.json()
      
      // 数据验证
      if (!userData || typeof userData !== 'object') {
        throw new Error('无效的用户数据格式')
      }
      
      // 数据标准化
      const normalizedData = {
        id: userData.id,
        name: userData.name || userData.username || '未知用户',
        email: userData.email,
        avatar: userData.avatar || userData.profile_picture,
        role: userData.role || 'user',
        permissions: userData.permissions || [],
        lastLogin: userData.last_login ? new Date(userData.last_login) : null,
        isActive: userData.is_active !== false,
        metadata: {
          createdAt: userData.created_at ? new Date(userData.created_at) : null,
          updatedAt: userData.updated_at ? new Date(userData.updated_at) : null,
          source: 'api'
        }
      }
      
      console.log(`成功获取用户数据: ${normalizedData.name}`)
      return normalizedData
      
    } catch (error) {
      lastError = error as Error
      console.error(`第 ${attempt} 次尝试失败:`, error)
      
      // 如果不是最后一次尝试，等待后重试
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000 // 指数退避
        console.log(`等待 ${delay}ms 后重试...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  // 所有重试都失败了
  throw new Error(`获取用户数据失败，已重试 ${maxRetries} 次。最后错误: ${lastError?.message}`)
}

// 工具函数
const debounce = (func: Function, delay: number) => {
  let timeoutId: NodeJS.Timeout
  return (...args: any[]) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func.apply(null, args), delay)
  }
}

const throttle = (func: Function, limit: number) => {
  let inThrottle: boolean
  return (...args: any[]) => {
    if (!inThrottle) {
      func.apply(null, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

// 暴露给模板的方法和数据
defineExpose({
  state,
  handleClick,
  addTodo,
  toggleTodo,
  removeTodo,
  calculateTotal,
  getCompletedCount,
  clearCompleted,
  validateInput,
  formatDate,
  generateId,
  fetchUserData,
  debounce,
  throttle
})
</script>

<style scoped>
.vue-test-component {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.conditional-content {
  background-color: #e8f5e8;
  padding: 10px;
  border-radius: 4px;
  margin: 10px 0;
}

.show-content {
  background-color: #e3f2fd;
  padding: 10px;
  border-radius: 4px;
  margin: 10px 0;
}

.click-button, .input-button {
  background-color: #42b883;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  margin: 5px;
}

.click-button:hover, .input-button:hover {
  background-color: #369870;
}

input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin: 10px 0;
  width: 200px;
}

.list-item {
  padding: 5px 0;
  border-bottom: 1px solid #eee;
}

.slot-container {
  border: 2px dashed #42b883;
  padding: 15px;
  margin: 20px 0;
  border-radius: 4px;
}

h1 {
  color: #42b883;
  text-align: center;
}

h2 {
  color: #35495e;
  margin-bottom: 10px;
}
</style>
