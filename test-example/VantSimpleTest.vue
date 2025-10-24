<template>
  <div class="vant-test">
    <!-- 高频组件测试 -->
    
    <!-- 1. Popup组件 - 弹窗组件（90次使用） -->
    <van-popup v-model:show="showPopup" position="bottom">
      <div>弹窗内容</div>
    </van-popup>
    
    <!-- 2. Toast组件 - 轻提示组件（54次使用） -->
    <van-toast v-model:show="showToast" message="操作成功" />
    
    <!-- 3. List组件 - 列表组件（33次使用） -->
    <van-list v-model:loading="loading" @load="onLoad">
      <van-cell v-for="item in list" :key="item.id" :title="item.title" />
    </van-list>

    <!-- 中频组件测试 -->
    
    <!-- 4. Field组件 - 输入框组件（33次使用） -->
    <van-field v-model="username" label="用户名" placeholder="请输入用户名" />
    
    <!-- 5. Picker组件 - 选择器组件（20次使用） -->
    <van-picker v-model="selectedDate" :columns="dateColumns" />
    
    <!-- 6. Tabs组件 - 标签页组件（24次使用） -->
    <van-tabs v-model:active="activeTab">
      <!-- 7. Tab组件 - 标签项组件（15次使用） -->
      <van-tab title="标签1" />
      <van-tab title="标签2" />
    </van-tabs>

    <!-- 低频组件测试 -->
    
    <!-- 8. Cell组件 - 单元格组件（10次使用） -->
    <van-cell title="单元格" value="内容" is-link />
    
    <!-- 9. Dialog组件 - 对话框组件（9次使用） -->
    <van-dialog v-model:show="showDialog" title="确认" message="确定要删除吗？" />
    
    <!-- 10. CellGroup组件 - 单元格组组件（8次使用） -->
    <van-cell-group>
      <van-cell title="设置" />
      <van-cell title="关于" />
    </van-cell-group>

    <!-- 操作按钮 -->
    <van-button type="primary" @click="showPopup = true">显示弹窗</van-button>
    <van-button type="success" @click="showToast = true">显示提示</van-button>
    <van-button type="warning" @click="showDialog = true">显示对话框</van-button>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'

// 响应式数据
const showPopup = ref(false)
const showToast = ref(false)
const showDialog = ref(false)
const loading = ref(false)
const username = ref('')
const selectedDate = ref('')
const activeTab = ref(0)

// 列表数据
const list = ref([
  { id: 1, title: '列表项1' },
  { id: 2, title: '列表项2' },
  { id: 3, title: '列表项3' }
])

// 日期选择器数据
const dateColumns = ref([
  { text: '2024年1月', value: '2024-01' },
  { text: '2024年2月', value: '2024-02' },
  { text: '2024年3月', value: '2024-03' }
])

// 计算属性
const totalItems = computed(() => {
  return list.value.length
})

// 监听器
watch(activeTab, (newTab) => {
  console.log('切换到标签页:', newTab)
})

// 生命周期钩子
onMounted(() => {
  console.log('Vant组件测试页面已挂载')
})

// 事件处理函数
const onLoad = () => {
  console.log('加载更多数据')
  loading.value = false
}

// 长函数测试
const processComplexData = () => {
  console.log('开始处理复杂数据')
  
  // 模拟复杂的数据处理逻辑
  const processedData = list.value.map(item => {
    return {
      ...item,
      processedValue: item.title.toUpperCase(),
      timestamp: Date.now(),
      category: 'processed'
    }
  })
  
  // 数据分组
  const groupedData = processedData.reduce((groups, item) => {
    const category = item.category
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(item)
    return groups
  }, {})
  
  // 计算统计信息
  const stats = Object.keys(groupedData).reduce((acc, category) => {
    acc[category] = {
      count: groupedData[category].length,
      total: groupedData[category].reduce((sum, item) => sum + 1, 0)
    }
    return acc
  }, {})
  
  console.log('处理完成:', { processedData, groupedData, stats })
  return { processedData, groupedData, stats }
}

const fetchUserDataWithRetry = async (maxRetries = 3) => {
  console.log('开始获取用户数据')
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`尝试第 ${attempt} 次获取数据`)
      
      // 模拟API调用
      const response = await new Promise((resolve, reject) => {
        setTimeout(() => {
          if (Math.random() > 0.3) { // 70% 成功率
            resolve({
              success: true,
              data: {
                user: { name: 'Test User' },
                points: 100,
                history: list.value
              }
            })
          } else {
            reject(new Error('网络请求失败'))
          }
        }, 1000)
      })
      
      console.log('数据获取成功:', response)
      return response
      
    } catch (error) {
      console.error(`第 ${attempt} 次尝试失败:`, error)
      
      if (attempt === maxRetries) {
        console.error('所有重试都失败了')
        throw new Error('获取用户数据失败')
      }
      
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
    }
  }
}
</script>

<style scoped>
.vant-test {
  padding: 20px;
  background-color: #f5f5f5;
  min-height: 100vh;
}

.van-button {
  margin: 10px;
}
</style>
