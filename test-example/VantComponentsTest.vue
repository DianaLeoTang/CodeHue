<template>
  <div class="vant-components-demo">
    <!-- 高频组件测试 -->
    
    <!-- 1. Popup组件 - 弹窗组件（90次使用） -->
    <van-popup 
      v-model:show="showPopup" 
      position="bottom" 
      :style="{ height: '50%' }"
      @close="onPopupClose"
    >
      <div class="popup-content">
        <h3>活动规则</h3>
        <p>这里是活动详情内容...</p>
        <van-button type="primary" @click="closePopup">确定</van-button>
      </div>
    </van-popup>

    <!-- 2. Toast组件 - 轻提示组件（54次使用） -->
    <van-toast 
      v-model:show="showToast" 
      message="操作成功" 
      type="success"
      position="top"
    />

    <!-- 3. List组件 - 列表组件（33次使用） -->
    <van-list 
      v-model:loading="loading" 
      v-model:error="error"
      :finished="finished"
      finished-text="没有更多了"
      @load="onLoad"
    >
      <van-cell 
        v-for="item in list" 
        :key="item.id" 
        :title="item.title"
        :value="item.value"
        is-link
        @click="onItemClick(item)"
      />
    </van-list>

    <!-- 中频组件测试 -->
    
    <!-- 4. Field组件 - 输入框组件（33次使用） -->
    <van-field
      v-model="formData.username"
      label="用户名"
      placeholder="请输入用户名"
      :rules="[{ required: true, message: '请填写用户名' }]"
      @blur="onUsernameBlur"
    />
    
    <van-field
      v-model="formData.phone"
      label="手机号"
      type="tel"
      placeholder="请输入手机号"
      :rules="[{ pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' }]"
    />

    <!-- 5. Picker组件 - 选择器组件（20次使用） -->
    <van-picker
      v-model="selectedDate"
      :columns="dateColumns"
      title="选择日期"
      @confirm="onDateConfirm"
      @cancel="onDateCancel"
    />

    <!-- 6. Tabs组件 - 标签页组件（24次使用） -->
    <van-tabs v-model:active="activeTab" @change="onTabChange">
      <!-- 7. Tab组件 - 标签项组件（15次使用） -->
      <van-tab title="积分获取" name="earn">
        <div class="tab-content">
          <h4>积分获取记录</h4>
          <van-cell-group>
            <van-cell title="签到" value="+10" />
            <van-cell title="分享" value="+5" />
          </van-cell-group>
        </div>
      </van-tab>
      
      <van-tab title="积分消耗" name="spend">
        <div class="tab-content">
          <h4>积分消耗记录</h4>
          <van-cell-group>
            <van-cell title="兑换商品" value="-100" />
            <van-cell title="抽奖" value="-50" />
          </van-cell-group>
        </div>
      </van-tab>
    </van-tabs>

    <!-- 低频组件测试 -->
    
    <!-- 8. Cell组件 - 单元格组件（10次使用） -->
    <van-cell 
      title="会员权益" 
      value="查看详情" 
      is-link
      @click="onMemberClick"
    />
    
    <van-cell 
      title="设置" 
      value="个人设置" 
      is-link
      @click="onSettingsClick"
    />

    <!-- 9. Dialog组件 - 对话框组件（9次使用） -->
    <van-dialog
      v-model:show="showDialog"
      title="确认操作"
      message="确定要删除这条记录吗？"
      show-cancel-button
      @confirm="onDialogConfirm"
      @cancel="onDialogCancel"
    />

    <!-- 10. CellGroup组件 - 单元格组组件（8次使用） -->
    <van-cell-group title="个人信息" inset>
      <van-cell title="头像" value="点击更换" is-link />
      <van-cell title="昵称" :value="userInfo.nickname" is-link />
      <van-cell title="手机号" :value="userInfo.phone" is-link />
    </van-cell-group>

    <!-- 操作按钮 -->
    <div class="action-buttons">
      <van-button type="primary" @click="showPopup = true">
        显示弹窗
      </van-button>
      <van-button type="success" @click="showToast = true">
        显示提示
      </van-button>
      <van-button type="warning" @click="showDialog = true">
        显示对话框
      </van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { showToast as showToastMessage } from 'vant'

// 响应式数据
const showPopup = ref(false)
const showToast = ref(false)
const showDialog = ref(false)
const loading = ref(false)
const error = ref(false)
const finished = ref(false)
const activeTab = ref('earn')
const selectedDate = ref('')

// 表单数据
const formData = reactive({
  username: '',
  phone: ''
})

// 用户信息
const userInfo = reactive({
  nickname: 'Vue用户',
  phone: '138****8888'
})

// 列表数据
const list = ref([
  { id: 1, title: '积分记录1', value: '+10' },
  { id: 2, title: '积分记录2', value: '-5' },
  { id: 3, title: '积分记录3', value: '+20' }
])

// 日期选择器数据
const dateColumns = ref([
  { text: '2024年1月', value: '2024-01' },
  { text: '2024年2月', value: '2024-02' },
  { text: '2024年3月', value: '2024-03' }
])

// 计算属性
const totalPoints = computed(() => {
  return list.value.reduce((sum, item) => {
    const value = parseInt(item.value.replace(/[+-]/, ''))
    return sum + (item.value.startsWith('+') ? value : -value)
  }, 0)
})

// 监听器
watch(activeTab, (newTab) => {
  console.log('切换到标签页:', newTab)
})

// 生命周期钩子
onMounted(() => {
  console.log('Vant组件演示页面已挂载')
})

// 事件处理函数
const onPopupClose = () => {
  console.log('弹窗关闭')
}

const closePopup = () => {
  showPopup.value = false
}

const onLoad = () => {
  console.log('加载更多数据')
  // 模拟异步加载
  setTimeout(() => {
    loading.value = false
    if (list.value.length >= 10) {
      finished.value = true
    }
  }, 1000)
}

const onItemClick = (item: any) => {
  console.log('点击列表项:', item)
}

const onUsernameBlur = () => {
  console.log('用户名输入完成')
}

const onDateConfirm = (value: string) => {
  console.log('选择日期:', value)
  selectedDate.value = value
}

const onDateCancel = () => {
  console.log('取消选择日期')
}

const onTabChange = (name: string) => {
  console.log('切换标签页:', name)
}

const onMemberClick = () => {
  console.log('点击会员权益')
}

const onSettingsClick = () => {
  console.log('点击设置')
}

const onDialogConfirm = () => {
  console.log('确认删除')
  showDialog.value = false
}

const onDialogCancel = () => {
  console.log('取消删除')
  showDialog.value = false
}

// 长函数测试
const processComplexData = () => {
  console.log('开始处理复杂数据')
  
  // 模拟复杂的数据处理逻辑
  const processedData = list.value.map(item => {
    const value = parseInt(item.value.replace(/[+-]/, ''))
    const isPositive = item.value.startsWith('+')
    
    return {
      ...item,
      processedValue: value,
      isPositive,
      timestamp: Date.now(),
      category: isPositive ? 'earn' : 'spend'
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
  }, {} as Record<string, any[]>)
  
  // 计算统计信息
  const stats = Object.keys(groupedData).reduce((acc, category) => {
    acc[category] = {
      count: groupedData[category].length,
      total: groupedData[category].reduce((sum, item) => sum + item.processedValue, 0)
    }
    return acc
  }, {} as Record<string, any>)
  
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
                user: userInfo,
                points: totalPoints.value,
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
.vant-components-demo {
  padding: 20px;
  background-color: #f5f5f5;
  min-height: 100vh;
}

.popup-content {
  padding: 20px;
  text-align: center;
}

.popup-content h3 {
  margin-bottom: 15px;
  color: #333;
}

.tab-content {
  padding: 15px;
}

.tab-content h4 {
  margin-bottom: 10px;
  color: #666;
}

.action-buttons {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  justify-content: center;
}

.action-buttons .van-button {
  flex: 1;
  max-width: 120px;
}
</style>
