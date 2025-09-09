<template>
  <div
    class="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-12"
  >
    <!-- 背景装饰 -->
    <div
      class="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.1),rgba(255,255,255,0))]"
    ></div>

    <!-- 主题切换按钮 -->
    <div class="fixed right-4 top-4 z-10">
      <ThemeToggle mode="dropdown" />
    </div>

    <div class="relative z-10 w-full max-w-md space-y-8">
      <!-- 头部logo和标题 -->
      <div class="text-center">
        <div
          class="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500"
        >
          <svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-white">ViliCode</h1>
      </div>

      <!-- 主登录卡片 -->
      <div
        class="glass-morphism rounded-2xl border border-white/10 p-8 shadow-2xl backdrop-blur-xl"
      >
        <!-- 欢迎标题 -->
        <div class="mb-8 text-center">
          <h2 class="mb-2 text-3xl font-bold text-white">欢迎回来</h2>
          <p class="text-slate-400">登录您的账户，继续 AI 编程之旅</p>
        </div>

        <!-- Clerk 加载状态 -->
        <div v-if="clerkStore.isClerkLoading" class="space-y-6">
          <div class="text-center">
            <div
              class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"
            ></div>
            <p class="text-slate-400">正在初始化登录系统...</p>
          </div>
        </div>

        <!-- Clerk 网络连接错误 -->
        <div v-else-if="clerkStore.isNetworkError" class="space-y-6">
          <div class="text-center">
            <div
              class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20"
            >
              <svg
                class="h-6 w-6 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M18.364 5.636l-12.728 12.728m0-12.728l12.728 12.728"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <h3 class="mb-2 font-medium text-white">网络连接问题</h3>
            <p class="mb-4 text-slate-400">无法连接到社交登录服务器，这可能是网络环境导致的</p>
            <div class="mb-6 space-y-2">
              <p class="text-sm text-slate-500">建议解决方案：</p>
              <ul class="space-y-1 text-sm text-slate-400">
                <li>• 检查网络连接是否正常</li>
                <li>• 更换网络环境或节点</li>
                <li>• 使用 VPN 或代理服务</li>
                <li>• 或直接使用传统登录方式</li>
              </ul>
            </div>
            <div class="flex flex-col space-y-3">
              <button
                class="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700"
                @click="retryClerkConnection"
              >
                <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                </svg>
                重试连接
              </button>
              <RouterLink
                class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
                to="/user-login"
              >
                使用传统登录
              </RouterLink>
            </div>
          </div>
        </div>

        <!-- Clerk 初始化失败 -->
        <div v-else-if="!clerkStore.isClerkReady" class="space-y-6">
          <div class="text-center">
            <div
              class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/20"
            >
              <svg
                class="h-6 w-6 text-yellow-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <h3 class="mb-2 font-medium text-white">社交登录暂时不可用</h3>
            <p class="mb-6 text-slate-400">登录系统正在初始化中，请稍后重试或使用传统登录</p>
            <RouterLink
              class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
              to="/user-login"
            >
              使用传统登录
            </RouterLink>
          </div>
        </div>

        <!-- Clerk 就绪时显示可用的登录选项 -->
        <div v-else class="space-y-6">
          <!-- 错误信息 -->
          <div v-if="error" class="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
            <p class="text-sm text-red-400">{{ error }}</p>
          </div>

          <!-- 社交登录按钮（Google）- 可用状态 -->
          <button
            class="social-btn google-btn flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 px-6 py-4 font-medium text-white transition-all duration-200 hover:scale-105 hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="clerkStore.isSigningIn"
            @click="signInWithGoogle"
          >
            <div v-if="clerkStore.isSigningIn" class="mr-3 h-5 w-5">
              <div
                class="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"
              ></div>
            </div>
            <svg v-else class="mr-3 h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {{ clerkStore.isSigningIn ? '正在登录...' : '使用 Google 账号登录' }}
          </button>

          <!-- 返回传统登录 -->
          <div class="border-t border-slate-600 pt-6 text-center">
            <p class="text-slate-400">
              或者
              <RouterLink class="font-medium text-blue-400 hover:text-blue-300" to="/user-login"
                >使用用户名密码登录</RouterLink
              >
            </p>
          </div>
        </div>
      </div>

      <!-- 底部信息 -->
      <div class="text-center">
        <p class="text-xs text-slate-500">
          登录即表示您同意我们的
          <a class="text-blue-400 hover:text-blue-300" href="#">服务条款</a>
          和
          <a class="text-blue-400 hover:text-blue-300" href="#">隐私政策</a>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useClerk, useUser } from '@clerk/vue'
import { useClerkStore } from '@/stores/clerk'
import { useUserStore } from '@/stores/user'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import { showToast } from '@/utils/toast'

const router = useRouter()
const clerkStore = useClerkStore()
const userStore = useUserStore()

// 获取 Clerk 实例
const clerk = useClerk()
const user = useUser()

// 响应式数据
const error = ref('')
const retryCount = ref(0)
const maxRetries = 3

// 清除错误信息
function clearError() {
  error.value = ''
  clerkStore.clearError()
}

// 显示错误信息
function showError(message) {
  error.value = message
  console.error('UserLoginSocial: 登录错误', message)
}

// Google OAuth 登录
async function signInWithGoogle() {
  clearError()

  try {
    console.log('UserLoginSocial: 开始 Google OAuth 登录')

    // 检查 Clerk 是否已准备就绪
    if (!clerkStore.isClerkReady) {
      throw new Error('社交登录系统尚未准备就绪，请稍后重试')
    }

    // 调用 Clerk store 的登录方法
    await clerkStore.signInWithProvider('google', {
      afterSignInUrl: '/user-dashboard',
      redirectUrl: '/sso-callback'
    })

    console.log('UserLoginSocial: Google OAuth 登录流程已启动')
  } catch (err) {
    console.error('UserLoginSocial: Google 登录失败', err)

    // 处理不同类型的错误
    if (err.message.includes('网络')) {
      showError('网络连接错误，请检查网络后重试')
    } else if (err.message.includes('初始化') || err.message.includes('准备')) {
      showError('社交登录系统初始化中，请稍后重试')
    } else if (err.message.includes('取消') || err.message.includes('cancelled')) {
      showError('登录已取消')
    } else {
      showError('登录失败，请重试或使用传统登录方式')
    }

    // 记录重试次数
    retryCount.value++

    // 如果重试次数过多，建议用户使用其他方式
    if (retryCount.value >= maxRetries) {
      setTimeout(() => {
        showToast('多次登录失败，建议使用传统登录方式', 'warning')
        router.push('/user-login')
      }, 2000)
    }
  }
}

// 页面挂载时的初始化
onMounted(async () => {
  console.log('UserLoginSocial: 页面挂载')

  // 如果用户已经登录，重定向到仪表板
  if (userStore.isAuthenticated) {
    console.log('UserLoginSocial: 用户已登录，重定向到仪表板')
    router.replace('/user-dashboard')
    return
  }

  // 检查是否存在 URL 参数中的错误信息
  const urlParams = new URLSearchParams(window.location.search)
  const urlError = urlParams.get('error')
  if (urlError) {
    showError(decodeURIComponent(urlError))

    // 清理 URL 参数
    const cleanUrl = window.location.pathname
    window.history.replaceState({}, document.title, cleanUrl)
  }

  // 重置重试计数
  retryCount.value = 0

  // 等待 Clerk 初始化（延迟确保插件已加载）
  setTimeout(() => {
    try {
      console.log('UserLoginSocial: 尝试初始化 Clerk')

      // 传递 Clerk 实例到 Store
      if (clerk && user) {
        console.log('UserLoginSocial: 传递 Clerk 实例到 Store')
        clerkStore.setClerkInstance(clerk, user)
      } else {
        console.error('UserLoginSocial: 无法获取 Clerk 实例')
        throw new Error('无法获取 Clerk 实例')
      }

      clerkStore.initializeClerk()

      // 等待最多5秒来检查Clerk是否成功初始化
      let checkCount = 0
      const maxChecks = 25 // 5秒，每200ms检查一次

      const checkClerkReady = () => {
        checkCount++
        console.log(`UserLoginSocial: 检查 Clerk 状态 (${checkCount}/${maxChecks})`, {
          isClerkReady: clerkStore.isClerkReady,
          isClerkLoading: clerkStore.isClerkLoading
        })

        if (clerkStore.isClerkReady) {
          console.log('UserLoginSocial: Clerk 已成功初始化')
          return
        }

        if (checkCount >= maxChecks) {
          console.warn('UserLoginSocial: Clerk 初始化超时')
          showError('社交登录系统初始化超时，请刷新页面重试或使用传统登录方式')
          return
        }

        // 继续检查
        setTimeout(checkClerkReady, 200)
      }

      checkClerkReady()
    } catch (error) {
      console.error('UserLoginSocial: Clerk 初始化失败', error)
      showError('社交登录系统初始化失败，请使用传统登录方式')
    }
  }, 500) // 延迟500ms确保Vue应用完全初始化
})

// 重试Clerk连接
async function retryClerkConnection() {
  console.log('UserLoginSocial: 重试Clerk连接')
  clearError()

  // 重置Store状态
  clerkStore.clearError()

  // 测试网络连接
  const connectivity = await clerkStore.testClerkConnectivity()
  if (!connectivity) {
    showError('网络连接测试失败，请检查网络环境或使用VPN')
    return
  }

  // 重新初始化Clerk
  try {
    // 清理之前的实例
    clerkStore.initializeClerk()

    // 重新传递实例
    setTimeout(() => {
      if (clerk && user) {
        console.log('UserLoginSocial: 重新传递 Clerk 实例到 Store')
        clerkStore.setClerkInstance(clerk, user)
      }
    }, 500)

    showToast('正在重新连接社交登录服务...', 'info')
  } catch (error) {
    console.error('UserLoginSocial: 重试连接失败', error)
    showError('重试连接失败，建议使用传统登录方式')
  }
}

// 页面卸载时的清理
onUnmounted(() => {
  clearError()
})
</script>

<style scoped>
/* 玻璃态效果 */
.glass-morphism {
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* 社交登录按钮样式 */
.social-btn {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.social-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

.social-btn:active:not(:disabled) {
  transform: translateY(0);
}

/* Google 按钮特殊样式 */
.google-btn:hover:not(:disabled) {
  box-shadow: 0 10px 25px rgba(66, 133, 244, 0.2);
}

/* 输入框样式 */
input:focus {
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* 渐变背景动画 */
@keyframes gradient-shift {
  0%,
  100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

/* 背景渐变动画 */
.bg-gradient-to-br {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
  background-size: 200% 200%;
  animation: gradient-shift 10s ease infinite;
}

/* Loading 动画 */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* 响应式设计 */
@media (max-width: 640px) {
  .glass-morphism {
    margin: 0 1rem;
    padding: 2rem;
  }

  .social-btn {
    font-size: 0.9rem;
    padding: 1rem;
  }
}

/* 链接悬停效果 */
a:hover {
  transition: color 0.2s ease;
}

/* 按钮禁用状态 */
button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* 自定义滚动条 */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.5);
}

::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.3);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.5);
}
</style>
