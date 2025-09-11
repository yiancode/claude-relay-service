<template>
  <div class="clerk-auth-handler">
    <!-- 认证状态显示 -->
    <div v-if="isVisible" class="auth-status-overlay">
      <div class="auth-status-modal">
        <!-- 标题 -->
        <div class="auth-header">
          <div class="auth-logo">
            <svg
              class="h-8 w-8 text-blue-600 dark:text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
              />
            </svg>
            <span class="ml-2 text-xl font-bold text-gray-900 dark:text-white">ViliCode</span>
          </div>
          <h3 class="auth-title">{{ statusTitle }}</h3>
        </div>

        <!-- 状态内容 -->
        <div class="auth-content">
          <!-- 加载状态 -->
          <div v-if="status === 'loading'" class="auth-loading">
            <div class="loading-spinner">
              <div class="spinner-ring"></div>
              <div class="spinner-ring"></div>
              <div class="spinner-ring"></div>
            </div>
            <p class="loading-text">{{ statusMessage }}</p>
          </div>

          <!-- 同步状态 -->
          <div v-else-if="status === 'syncing'" class="auth-syncing">
            <div class="sync-icon">
              <i class="fas fa-sync-alt animate-spin text-blue-500"></i>
            </div>
            <p class="sync-text">{{ statusMessage }}</p>
            <div class="sync-progress">
              <div class="progress-bar"></div>
            </div>
          </div>

          <!-- 成功状态 -->
          <div v-else-if="status === 'success'" class="auth-success">
            <div class="success-icon">
              <i class="fas fa-check-circle text-green-500"></i>
            </div>
            <p class="success-text">{{ statusMessage }}</p>
            <div class="success-details" v-if="userInfo">
              <div class="user-avatar">
                <img
                  v-if="userInfo.avatar"
                  :src="userInfo.avatar"
                  :alt="userInfo.fullName"
                  class="avatar-image"
                />
                <div v-else class="avatar-placeholder">
                  <i class="fas fa-user"></i>
                </div>
              </div>
              <div class="user-details">
                <p class="user-name">{{ userInfo.fullName || userInfo.email }}</p>
                <p class="user-email">{{ userInfo.email }}</p>
              </div>
            </div>
          </div>

          <!-- 错误状态 -->
          <div v-else-if="status === 'error'" class="auth-error">
            <div class="error-icon">
              <i class="fas fa-exclamation-triangle text-red-500"></i>
            </div>
            <p class="error-text">{{ statusMessage }}</p>
            <div v-if="errorDetails" class="error-details">
              <details class="error-details-collapse">
                <summary class="error-details-summary">查看错误详情</summary>
                <pre class="error-details-content">{{ errorDetails }}</pre>
              </details>
            </div>
            <div class="error-actions">
              <button
                @click="handleRetry"
                class="retry-button"
                :disabled="retrying"
              >
                <i class="fas fa-redo mr-2" :class="{ 'animate-spin': retrying }"></i>
                {{ retrying ? '重试中...' : '重试' }}
              </button>
              <button @click="handleClose" class="close-button">
                取消
              </button>
            </div>
          </div>
        </div>

        <!-- 关闭按钮 -->
        <button
          v-if="status === 'success' || status === 'error'"
          @click="handleClose"
          class="auth-close-button"
          :title="status === 'success' ? '继续' : '关闭'"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <!-- 网络状态指示器 -->
    <div v-if="showNetworkStatus && !isOnline" class="network-status">
      <i class="fas fa-wifi text-red-500 mr-2"></i>
      <span class="text-sm text-red-600 dark:text-red-400">网络连接已断开</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useClerkStore } from '@/stores/clerk'
import { useUserStore } from '@/stores/user'
import { showToast } from '@/utils/toast'

// Props
const props = defineProps({
  // 是否显示组件
  visible: {
    type: Boolean,
    default: false
  },
  // 当前认证状态
  authStatus: {
    type: String,
    default: 'idle',
    validator: (value) => ['idle', 'loading', 'syncing', 'success', 'error'].includes(value)
  },
  // 状态消息
  message: {
    type: String,
    default: ''
  },
  // 错误详情
  error: {
    type: [String, Object],
    default: null
  },
  // 用户信息
  user: {
    type: Object,
    default: null
  },
  // 是否显示网络状态
  showNetworkStatus: {
    type: Boolean,
    default: true
  },
  // 自动关闭延时（毫秒）
  autoCloseDelay: {
    type: Number,
    default: 3000
  }
})

// Emits
const emit = defineEmits(['close', 'retry', 'success', 'error'])

// Router
const router = useRouter()

// Stores
const clerkStore = useClerkStore()
const userStore = useUserStore()

// 状态
const isVisible = ref(props.visible)
const status = ref(props.authStatus)
const statusMessage = ref(props.message)
const errorDetails = ref(null)
const userInfo = ref(props.user)
const retrying = ref(false)
const isOnline = ref(navigator.onLine)
const autoCloseTimer = ref(null)

// 计算属性
const statusTitle = computed(() => {
  switch (status.value) {
    case 'loading':
      return '正在初始化登录...'
    case 'syncing':
      return '正在同步用户数据...'
    case 'success':
      return '登录成功！'
    case 'error':
      return '登录失败'
    default:
      return '用户认证'
  }
})

// 监听 props 变化
watch(() => props.visible, (newVal) => {
  isVisible.value = newVal
  if (newVal) {
    clearAutoCloseTimer()
  }
})

watch(() => props.authStatus, (newVal) => {
  status.value = newVal
  
  // 成功状态自动关闭
  if (newVal === 'success' && props.autoCloseDelay > 0) {
    startAutoCloseTimer()
  }
})

watch(() => props.message, (newVal) => {
  statusMessage.value = newVal
})

watch(() => props.error, (newVal) => {
  if (newVal) {
    errorDetails.value = typeof newVal === 'string' ? newVal : JSON.stringify(newVal, null, 2)
  } else {
    errorDetails.value = null
  }
})

watch(() => props.user, (newVal) => {
  userInfo.value = newVal
})

// 监听 Clerk Store 状态变化
watch(() => clerkStore.isLoading, (loading) => {
  if (loading && status.value === 'idle') {
    status.value = 'loading'
    statusMessage.value = '正在初始化 Clerk 服务...'
  }
})

watch(() => clerkStore.isSyncing, (syncing) => {
  if (syncing) {
    status.value = 'syncing'
    statusMessage.value = '正在同步用户数据到服务器...'
  }
})

watch(() => clerkStore.error, (error) => {
  if (error) {
    status.value = 'error'
    statusMessage.value = error
    errorDetails.value = error
    emit('error', error)
  }
})

watch(() => clerkStore.currentUser, (user) => {
  if (user && status.value === 'syncing') {
    status.value = 'success'
    statusMessage.value = '登录成功，即将跳转...'
    userInfo.value = user
    emit('success', user)
  }
})

// 方法
const handleClose = () => {
  clearAutoCloseTimer()
  isVisible.value = false
  
  // 重置状态
  setTimeout(() => {
    status.value = 'idle'
    statusMessage.value = ''
    errorDetails.value = null
    userInfo.value = null
    retrying.value = false
  }, 300)
  
  emit('close')
  
  // 如果登录成功，跳转到仪表板
  if (status.value === 'success') {
    const redirectUrl = sessionStorage.getItem('redirectAfterLogin') || '/user-dashboard'
    sessionStorage.removeItem('redirectAfterLogin')
    router.push(redirectUrl)
  }
}

const handleRetry = async () => {
  if (retrying.value) return
  
  try {
    retrying.value = true
    status.value = 'loading'
    statusMessage.value = '正在重试登录...'
    errorDetails.value = null
    
    // 重新初始化 Clerk 并打开登录
    await clerkStore.initialize()
    await clerkStore.openSignIn()
    
    emit('retry')
  } catch (error) {
    console.error('重试登录失败:', error)
    status.value = 'error'
    statusMessage.value = error.message || '重试失败，请稍后再试'
    errorDetails.value = error.message
    emit('error', error)
  } finally {
    retrying.value = false
  }
}

const startAutoCloseTimer = () => {
  clearAutoCloseTimer()
  autoCloseTimer.value = setTimeout(() => {
    handleClose()
  }, props.autoCloseDelay)
}

const clearAutoCloseTimer = () => {
  if (autoCloseTimer.value) {
    clearTimeout(autoCloseTimer.value)
    autoCloseTimer.value = null
  }
}

// 网络状态监听
const handleOnline = () => {
  isOnline.value = true
  if (status.value === 'error' && errorDetails.value?.includes('网络')) {
    showToast('网络连接已恢复', 'success')
  }
}

const handleOffline = () => {
  isOnline.value = false
  showToast('网络连接已断开', 'warning')
}

// 键盘事件处理
const handleKeyDown = (event) => {
  if (event.key === 'Escape' && isVisible.value) {
    handleClose()
  } else if (event.key === 'Enter' && status.value === 'error') {
    handleRetry()
  }
}

// 生命周期
onMounted(() => {
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
  window.removeEventListener('keydown', handleKeyDown)
  clearAutoCloseTimer()
})

// 暴露方法给父组件
defineExpose({
  show: () => { isVisible.value = true },
  hide: () => { handleClose() },
  setStatus: (newStatus, message = '') => {
    status.value = newStatus
    statusMessage.value = message
  },
  setError: (error) => {
    status.value = 'error'
    statusMessage.value = error.message || error
    errorDetails.value = error
  },
  setUser: (user) => {
    userInfo.value = user
  }
})
</script>

<style scoped>
/* 遮罩层 */
.auth-status-overlay {
  @apply fixed inset-0 z-50;
  @apply bg-black/50 backdrop-blur-sm;
  @apply flex items-center justify-center p-4;
  animation: fadeIn 0.3s ease-out;
}

/* 模态框 */
.auth-status-modal {
  @apply relative;
  @apply bg-white dark:bg-gray-800;
  @apply rounded-2xl shadow-2xl;
  @apply border border-gray-200 dark:border-gray-600;
  @apply max-w-md w-full mx-auto;
  @apply overflow-hidden;
  animation: slideUp 0.3s ease-out;
}

/* 标题区域 */
.auth-header {
  @apply px-6 py-4;
  @apply border-b border-gray-200 dark:border-gray-600;
  @apply bg-gradient-to-r from-blue-50 to-indigo-50;
  @apply dark:from-gray-800 dark:to-gray-700;
}

.auth-logo {
  @apply flex items-center justify-center mb-3;
}

.auth-title {
  @apply text-lg font-semibold text-center;
  @apply text-gray-900 dark:text-white;
}

/* 内容区域 */
.auth-content {
  @apply p-6;
}

/* 加载状态 */
.auth-loading {
  @apply text-center;
}

.loading-spinner {
  @apply flex justify-center items-center mb-4;
  @apply space-x-1;
}

.spinner-ring {
  @apply w-3 h-3 rounded-full;
  @apply bg-blue-500;
  animation: bounce 1.4s ease-in-out infinite both;
}

.spinner-ring:nth-child(2) {
  animation-delay: 0.16s;
}

.spinner-ring:nth-child(3) {
  animation-delay: 0.32s;
}

.loading-text {
  @apply text-gray-600 dark:text-gray-300;
  @apply text-sm;
}

/* 同步状态 */
.auth-syncing {
  @apply text-center;
}

.sync-icon {
  @apply text-2xl mb-4;
}

.sync-text {
  @apply text-gray-600 dark:text-gray-300 mb-4;
}

.sync-progress {
  @apply w-full bg-gray-200 dark:bg-gray-700;
  @apply rounded-full h-2;
  @apply overflow-hidden;
}

.progress-bar {
  @apply h-full bg-gradient-to-r from-blue-500 to-indigo-500;
  @apply rounded-full;
  animation: progressSlide 2s ease-in-out infinite;
  width: 0;
}

/* 成功状态 */
.auth-success {
  @apply text-center;
}

.success-icon {
  @apply text-4xl mb-4;
}

.success-text {
  @apply text-gray-600 dark:text-gray-300 mb-4;
}

.success-details {
  @apply flex items-center justify-center;
  @apply bg-gray-50 dark:bg-gray-700;
  @apply rounded-lg p-4 mt-4;
}

.user-avatar {
  @apply flex-shrink-0 mr-3;
}

.avatar-image {
  @apply w-12 h-12 rounded-full;
  @apply border-2 border-white dark:border-gray-600;
  @apply shadow-md;
}

.avatar-placeholder {
  @apply w-12 h-12 rounded-full;
  @apply bg-gray-300 dark:bg-gray-600;
  @apply flex items-center justify-center;
  @apply text-gray-500 dark:text-gray-400;
}

.user-details {
  @apply text-left;
}

.user-name {
  @apply font-medium text-gray-900 dark:text-white;
  @apply text-sm;
}

.user-email {
  @apply text-xs text-gray-500 dark:text-gray-400;
}

/* 错误状态 */
.auth-error {
  @apply text-center;
}

.error-icon {
  @apply text-4xl mb-4;
}

.error-text {
  @apply text-red-600 dark:text-red-400 mb-4;
}

.error-details {
  @apply mt-4 text-left;
}

.error-details-collapse {
  @apply bg-gray-50 dark:bg-gray-700;
  @apply rounded-lg p-3;
}

.error-details-summary {
  @apply text-sm text-gray-600 dark:text-gray-300;
  @apply cursor-pointer;
  @apply hover:text-gray-800 dark:hover:text-gray-100;
}

.error-details-content {
  @apply text-xs text-gray-500 dark:text-gray-400;
  @apply mt-2 p-2;
  @apply bg-gray-100 dark:bg-gray-600;
  @apply rounded border;
  @apply overflow-auto max-h-32;
}

.error-actions {
  @apply flex justify-center space-x-3 mt-6;
}

.retry-button {
  @apply px-4 py-2;
  @apply bg-blue-600 hover:bg-blue-700;
  @apply text-white font-medium;
  @apply rounded-lg;
  @apply transition-colors duration-200;
  @apply flex items-center;
  @apply disabled:opacity-50 disabled:cursor-not-allowed;
}

.close-button {
  @apply px-4 py-2;
  @apply bg-gray-300 hover:bg-gray-400;
  @apply dark:bg-gray-600 dark:hover:bg-gray-500;
  @apply text-gray-700 dark:text-gray-200;
  @apply font-medium rounded-lg;
  @apply transition-colors duration-200;
}

/* 关闭按钮 */
.auth-close-button {
  @apply absolute top-4 right-4;
  @apply w-8 h-8 rounded-full;
  @apply bg-gray-100 hover:bg-gray-200;
  @apply dark:bg-gray-700 dark:hover:bg-gray-600;
  @apply text-gray-500 dark:text-gray-400;
  @apply flex items-center justify-center;
  @apply transition-colors duration-200;
}

/* 网络状态指示器 */
.network-status {
  @apply fixed bottom-4 right-4;
  @apply bg-white dark:bg-gray-800;
  @apply border border-gray-200 dark:border-gray-600;
  @apply rounded-lg px-3 py-2;
  @apply shadow-lg;
  @apply flex items-center;
  @apply z-40;
}

/* 动画 */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

@keyframes progressSlide {
  0% {
    width: 0;
  }
  50% {
    width: 70%;
  }
  100% {
    width: 100%;
  }
}

/* 响应式调整 */
@media (max-width: 640px) {
  .auth-status-modal {
    @apply mx-4;
  }
  
  .auth-header,
  .auth-content {
    @apply px-4;
  }
  
  .error-actions {
    @apply flex-col space-x-0 space-y-2;
  }
}
</style>