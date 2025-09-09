<template>
  <div
    class="relative flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-900 sm:px-6 lg:px-8"
  >
    <!-- 主题切换按钮 -->
    <div class="fixed right-4 top-4 z-10">
      <ThemeToggle mode="dropdown" />
    </div>

    <div class="w-full max-w-md space-y-8">
      <div class="text-center">
        <div class="mx-auto flex h-12 w-auto items-center justify-center">
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
      </div>

      <div class="rounded-lg bg-white px-6 py-8 shadow dark:bg-gray-800 dark:shadow-xl">
        <!-- 处理中状态 -->
        <div v-if="status === 'processing'" class="space-y-6 text-center">
          <!-- 加载动画 -->
          <div class="flex items-center justify-center">
            <div
              class="relative h-16 w-16 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"
            >
              <div
                class="absolute inset-2 animate-pulse rounded-full bg-blue-500/20 dark:bg-blue-400/20"
              />
            </div>
          </div>

          <div class="space-y-2">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
              {{ processingMessage }}
            </h2>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              请稍候，我们正在安全地处理您的登录信息...
            </p>
          </div>

          <!-- 进度指示器 -->
          <div class="space-y-2">
            <div class="flex justify-center space-x-2">
              <div
                v-for="(step, index) in processingSteps"
                :key="index"
                class="flex items-center space-x-2"
              >
                <div
                  class="h-2 w-2 rounded-full transition-colors duration-300"
                  :class="
                    index <= currentStep
                      ? 'bg-blue-500 dark:bg-blue-400'
                      : 'bg-gray-300 dark:bg-gray-600'
                  "
                />
                <span
                  v-if="index < processingSteps.length - 1"
                  class="h-px w-8 transition-colors duration-300"
                  :class="
                    index < currentStep
                      ? 'bg-blue-500 dark:bg-blue-400'
                      : 'bg-gray-300 dark:bg-gray-600'
                  "
                />
              </div>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-500">
              {{ processingSteps[currentStep] }}
            </p>
          </div>
        </div>

        <!-- 成功状态 -->
        <div v-else-if="status === 'success'" class="space-y-6 text-center">
          <div class="flex items-center justify-center">
            <div
              class="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20"
            >
              <svg
                class="h-8 w-8 text-green-600 dark:text-green-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  clip-rule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  fill-rule="evenodd"
                />
              </svg>
            </div>
          </div>

          <div class="space-y-2">
            <h2 class="text-xl font-semibold text-green-600 dark:text-green-400">登录成功！</h2>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              欢迎回来，{{ userInfo?.fullName || userInfo?.email }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-500">正在跳转到您的仪表板...</p>
          </div>

          <div class="flex justify-center">
            <div class="h-1 w-32 overflow-hidden rounded bg-gray-200 dark:bg-gray-700">
              <div class="h-full w-full origin-left animate-pulse bg-blue-500 dark:bg-blue-400" />
            </div>
          </div>
        </div>

        <!-- 错误状态 -->
        <div v-else-if="status === 'error'" class="space-y-6 text-center">
          <div class="flex items-center justify-center">
            <div
              class="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20"
            >
              <svg
                class="h-8 w-8 text-red-600 dark:text-red-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  clip-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  fill-rule="evenodd"
                />
              </svg>
            </div>
          </div>

          <div class="space-y-2">
            <h2 class="text-xl font-semibold text-red-600 dark:text-red-400">登录失败</h2>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ errorMessage }}
            </p>
          </div>

          <!-- 错误处理选项 -->
          <div class="space-y-3">
            <button
              class="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-blue-400"
              :disabled="retryCount >= maxRetries"
              @click="retryLogin"
            >
              {{
                retryCount >= maxRetries
                  ? '重试次数已达上限'
                  : `重试登录 (${retryCount}/${maxRetries})`
              }}
            </button>

            <div class="flex space-x-2">
              <RouterLink
                class="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                to="/user-login-social"
              >
                重新选择登录方式
              </RouterLink>
              <RouterLink
                class="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                to="/user-login"
              >
                传统登录
              </RouterLink>
            </div>
          </div>
        </div>
      </div>

      <!-- 调试信息 (仅在开发环境显示) -->
      <div
        v-if="isDevelopment && debugInfo"
        class="mt-4 rounded-lg bg-gray-100 p-4 dark:bg-gray-800"
      >
        <details>
          <summary class="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
            调试信息 (开发环境)
          </summary>
          <pre class="mt-2 overflow-auto text-xs text-gray-600 dark:text-gray-400">{{
            debugInfo
          }}</pre>
        </details>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useClerkStore } from '@/stores/clerk'
import { useUserStore } from '@/stores/user'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import { showToast } from '@/utils/toast'

const router = useRouter()
const clerkStore = useClerkStore()
const userStore = useUserStore()

// 响应式数据
const status = ref('processing') // 'processing' | 'success' | 'error'
const processingMessage = ref('正在处理您的登录...')
const errorMessage = ref('')
const userInfo = ref(null)
const retryCount = ref(0)
const maxRetries = 3
const currentStep = ref(0)

// 开发环境标志
const isDevelopment = import.meta.env.DEV

// 调试信息
const debugInfo = ref(null)

// 处理步骤
const processingSteps = ['验证OAuth回调', '获取用户信息', '同步到后端', '完成登录']

// 定时器引用
let progressTimer = null
let redirectTimer = null

// 更新处理进度
function updateProgress(step, message) {
  currentStep.value = step
  processingMessage.value = message

  if (isDevelopment) {
    debugInfo.value = {
      step,
      message,
      timestamp: new Date().toISOString(),
      clerkStatus: {
        isReady: clerkStore.isClerkReady,
        isAuthenticated: clerkStore.isAuthenticated,
        isSigningIn: clerkStore.isSigningIn
      }
    }
  }
}

// 处理OAuth回调
async function handleCallback() {
  try {
    console.log('SSOCallback: 开始处理OAuth回调')

    // 步骤1: 验证OAuth回调
    updateProgress(0, '正在验证OAuth回调...')

    if (!clerkStore.isClerkReady) {
      throw new Error('Clerk 系统尚未初始化完成')
    }

    await new Promise((resolve) => setTimeout(resolve, 1000)) // 模拟处理时间

    // 步骤2: 处理Clerk回调
    updateProgress(1, '正在获取用户信息...')

    const success = await clerkStore.handleOAuthCallback()
    if (!success) {
      throw new Error('OAuth回调处理失败')
    }

    await new Promise((resolve) => setTimeout(resolve, 800))

    // 步骤3: 获取用户信息
    updateProgress(2, '正在同步用户数据到后端...')

    if (!clerkStore.currentUser) {
      throw new Error('无法获取用户信息')
    }

    userInfo.value = clerkStore.currentUser

    // 同步用户数据到后端
    await clerkStore.syncWithUserStore()

    await new Promise((resolve) => setTimeout(resolve, 800))

    // 步骤4: 完成登录
    updateProgress(3, '正在完成登录...')

    await new Promise((resolve) => setTimeout(resolve, 500))

    // 登录成功
    status.value = 'success'

    console.log('SSOCallback: OAuth回调处理成功')
    showToast(`欢迎回来，${userInfo.value.fullName || userInfo.value.email}！`, 'success')

    // 延迟跳转到仪表板
    redirectTimer = setTimeout(() => {
      router.replace('/user-dashboard')
    }, 2000)
  } catch (error) {
    console.error('SSOCallback: OAuth回调处理失败', error)

    status.value = 'error'

    // 处理不同类型的错误
    if (error.message.includes('取消') || error.message.includes('cancelled')) {
      errorMessage.value = '用户取消了登录授权'
    } else if (error.message.includes('网络') || error.message.includes('timeout')) {
      errorMessage.value = '网络连接超时，请检查网络后重试'
    } else if (error.message.includes('初始化') || error.message.includes('准备')) {
      errorMessage.value = '社交登录系统初始化失败，请稍后重试'
    } else if (error.message.includes('同步')) {
      errorMessage.value = '用户数据同步失败，请重试或联系管理员'
    } else {
      errorMessage.value = error.message || '登录处理过程中发生未知错误'
    }

    // 在开发环境显示详细错误信息
    if (isDevelopment) {
      debugInfo.value = {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      }
    }

    showToast('登录失败：' + errorMessage.value, 'error')
  }
}

// 重试登录
async function retryLogin() {
  if (retryCount.value >= maxRetries) {
    return
  }

  retryCount.value++
  status.value = 'processing'
  currentStep.value = 0
  errorMessage.value = ''

  console.log(`SSOCallback: 第 ${retryCount.value} 次重试登录`)

  await handleCallback()
}

// 模拟进度更新
function startProgressTimer() {
  progressTimer = setInterval(() => {
    if (status.value === 'processing' && currentStep.value < processingSteps.length - 1) {
      // 这里只是视觉效果，实际进度由 handleCallback 控制
    }
  }, 1000)
}

// 清理定时器
function clearTimers() {
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }
  if (redirectTimer) {
    clearTimeout(redirectTimer)
    redirectTimer = null
  }
}

// 页面挂载
onMounted(async () => {
  console.log('SSOCallback: 页面挂载')

  // 检查URL中是否有错误参数
  const urlParams = new URLSearchParams(window.location.search)
  const urlError = urlParams.get('error')
  const errorDescription = urlParams.get('error_description')

  if (urlError) {
    console.error('SSOCallback: URL中包含错误参数', { urlError, errorDescription })
    status.value = 'error'
    errorMessage.value = errorDescription || `OAuth错误: ${urlError}`
    return
  }

  // 如果用户已经通过其他方式登录，直接重定向
  if (userStore.isAuthenticated) {
    console.log('SSOCallback: 用户已登录，重定向到仪表板')
    router.replace('/user-dashboard')
    return
  }

  // 开始处理OAuth回调
  startProgressTimer()

  // 给Clerk一些时间来处理回调
  await new Promise((resolve) => setTimeout(resolve, 500))

  await handleCallback()
})

// 页面卸载
onUnmounted(() => {
  clearTimers()
})

// 监听浏览器返回事件
window.addEventListener('beforeunload', (event) => {
  if (status.value === 'processing') {
    event.preventDefault()
    event.returnValue = '登录正在处理中，确定要离开吗？'
  }
})
</script>

<style scoped>
/* 自定义动画 */
@keyframes pulse-ring {
  0% {
    transform: scale(0.8);
    opacity: 1;
  }
  100% {
    transform: scale(2);
    opacity: 0;
  }
}

.animate-pulse-ring {
  animation: pulse-ring 2s ease-out infinite;
}

/* 进度条动画 */
@keyframes progress-bar {
  0% {
    transform: scaleX(0);
  }
  100% {
    transform: scaleX(1);
  }
}

.animate-progress {
  animation: progress-bar 2s ease-out;
}

/* 加载动画增强 */
.animate-spin {
  animation: spin 1s linear infinite;
}

/* 响应式设计 */
@media (max-width: 640px) {
  .space-x-2 > * + * {
    margin-left: 0.25rem;
  }

  .max-w-md {
    max-width: 95%;
  }
}
</style>
