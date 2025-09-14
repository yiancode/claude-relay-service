<template>
  <div
    class="relative flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-900 sm:px-6 lg:px-8"
  >
    <!-- 主题切换按钮 -->
    <div class="fixed right-4 top-4 z-10">
      <ThemeToggle mode="dropdown" />
    </div>

    <div class="w-full max-w-md space-y-8">
      <div>
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
        <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          用户登录
        </h2>
        <p class="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          登录您的账户来管理 API 密钥
        </p>
      </div>

      <div class="rounded-lg bg-white px-6 py-8 shadow dark:bg-gray-800 dark:shadow-xl">
        <!-- 社交登录区域 -->
        <div v-if="isClerkEnabled" class="mb-6">
          <button
            class="flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            :disabled="loading || clerkLoading"
            type="button"
            @click="openClerkSignIn"
          >
            <svg v-if="!clerkLoading" class="mr-3 h-5 w-5" viewBox="0 0 24 24">
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
            <div
              v-else
              class="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"
            ></div>
            {{ clerkLoading ? '正在加载...' : '使用 Google 账号快速登录' }}
          </button>

          <!-- 分隔线 -->
          <div class="mt-6 flex items-center">
            <div class="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
            <div class="px-3 text-sm text-gray-500 dark:text-gray-400">或</div>
            <div class="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
          </div>
        </div>

        <!-- 传统登录表单 -->
        <form class="space-y-6" @submit.prevent="handleLogin">
          <div>
            <label
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
              for="username"
            >
              Username
            </label>
            <div class="mt-1">
              <input
                id="username"
                v-model="form.username"
                class="relative block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-400 dark:focus:ring-blue-400 sm:text-sm"
                :disabled="loading"
                name="username"
                placeholder="Enter your username"
                required
                type="text"
              />
            </div>
          </div>

          <div>
            <label
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
              for="password"
            >
              Password
            </label>
            <div class="mt-1">
              <input
                id="password"
                v-model="form.password"
                class="relative block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-400 dark:focus:ring-blue-400 sm:text-sm"
                :disabled="loading"
                name="password"
                placeholder="Enter your password"
                required
                type="password"
              />
            </div>
          </div>

          <div
            v-if="error"
            class="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
          >
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    clip-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    fill-rule="evenodd"
                  />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-red-700 dark:text-red-400">{{ error }}</p>
              </div>
            </div>
          </div>

          <div>
            <button
              class="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-blue-400 dark:focus:ring-offset-gray-800"
              :disabled="loading || !form.username || !form.password"
              type="submit"
            >
              <span v-if="loading" class="absolute inset-y-0 left-0 flex items-center pl-3">
                <svg
                  class="h-5 w-5 animate-spin text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  ></circle>
                  <path
                    class="opacity-75"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    fill="currentColor"
                  ></path>
                </svg>
              </span>
              {{ loading ? 'Signing In...' : 'Sign In' }}
            </button>
          </div>

          <div class="flex justify-center space-x-4 text-center">
            <router-link
              class="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              to="/admin-login"
            >
              管理员登录
            </router-link>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useThemeStore } from '@/stores/theme'
import { showToast } from '@/utils/toast'
import ThemeToggle from '@/components/common/ThemeToggle.vue'

const router = useRouter()
const userStore = useUserStore()
const themeStore = useThemeStore()

const loading = ref(false)
const error = ref('')
const clerkLoading = ref(false)

// Clerk 相关状态
let clerkClient = null
let isClerkInitialized = ref(false)

const form = reactive({
  username: '',
  password: ''
})

// 检查 Clerk 是否启用
const isClerkEnabled = computed(() => {
  return import.meta.env.VITE_CLERK_PUBLISHABLE_KEY && isClerkInitialized.value
})

// 按需加载 Clerk SDK
const loadClerkSDK = async () => {
  if (clerkClient) return clerkClient

  try {
    clerkLoading.value = true

    // 动态导入 Clerk SDK
    const { Clerk } = await import('@clerk/clerk-js')

    const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
    if (!publishableKey) {
      throw new Error('Clerk 配置未找到')
    }

    clerkClient = new Clerk(publishableKey)
    await clerkClient.load()

    isClerkInitialized.value = true
    return clerkClient
  } catch (error) {
    console.error('Clerk SDK 加载失败:', error)
    showToast('社交登录服务暂时不可用', 'warning')
    return null
  } finally {
    clerkLoading.value = false
  }
}

// 打开 Clerk 登录 Modal
const openClerkSignIn = async () => {
  if (clerkLoading.value) return

  try {
    const clerk = await loadClerkSDK()
    if (!clerk) return

    clerkLoading.value = true

    // 检查是否已登录
    if (clerk.user) {
      await handleClerkSignInSuccess(clerk.user)
      return
    }

    // 打开登录 Modal
    await clerk.openSignIn({
      appearance: {
        elements: {
          modalBackdrop: 'backdrop-blur-sm bg-black/50',
          card: 'shadow-2xl rounded-xl',
          headerTitle: 'text-xl font-semibold text-gray-900 dark:text-white',
          headerSubtitle: 'text-sm text-gray-600 dark:text-gray-400 mt-1',
          socialButtonsBlockButton: 'h-11 font-medium transition-all duration-200 rounded-lg',
          socialButtonsBlockButtonText: 'font-medium text-sm',
          formButtonPrimary: 'bg-blue-600 hover:bg-blue-700 transition-colors duration-200',
          footer: 'hidden'
        },
        variables: {
          colorPrimary: '#1677ff',
          colorSuccess: '#67c23a',
          colorWarning: '#e6a23c',
          colorDanger: '#f56c6c',
          borderRadius: '8px'
        },
        layout: {
          socialButtonsPlacement: 'top',
          socialButtonsVariant: 'blockButton'
        }
      },
      routing: 'virtual',
      redirectUrl: window.location.origin + '/user-dashboard'
    })
  } catch (error) {
    console.error('Clerk 登录失败:', error)
    showToast('登录失败，请重试', 'error')
  } finally {
    clerkLoading.value = false
  }
}

// 处理 Clerk 登录成功
const handleClerkSignInSuccess = async (clerkUser) => {
  try {
    loading.value = true

    // 获取 Clerk session token
    const sessionToken = await clerkClient.session?.getToken()

    if (!sessionToken) {
      throw new Error('无法获取认证令牌')
    }

    // 调用后端同步接口
    const response = await userStore.authenticateWithClerk({
      clerkUserId: clerkUser.id,
      clerkToken: sessionToken,
      email: clerkUser.primaryEmailAddress?.emailAddress,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      fullName: clerkUser.fullName,
      avatar: clerkUser.imageUrl,
      provider: clerkUser.externalAccounts?.[0]?.provider || 'google'
    })

    if (response.success) {
      showToast('登录成功！', 'success')

      // 检查是否有重定向URL
      const redirectUrl = sessionStorage.getItem('redirectAfterLogin') || '/user-dashboard'
      sessionStorage.removeItem('redirectAfterLogin')

      router.push(redirectUrl)
    }
  } catch (error) {
    console.error('Clerk 用户同步失败:', error)
    showToast(error.message || '登录失败，请重试', 'error')

    // 登录失败，清理 Clerk 会话
    if (clerkClient?.user) {
      await clerkClient.signOut()
    }
  } finally {
    loading.value = false
  }
}

// 监听 Clerk 登录状态变化
const setupClerkListener = () => {
  if (!clerkClient) return

  clerkClient.addListener(({ session, user }) => {
    if (session && user && !loading.value) {
      // 用户登录成功
      handleClerkSignInSuccess(user)
    }
  })
}

// 传统登录处理
const handleLogin = async () => {
  if (!form.username || !form.password) {
    error.value = '请输入用户名和密码'
    return
  }

  loading.value = true
  error.value = ''

  try {
    await userStore.login({
      username: form.username,
      password: form.password
    })

    showToast('登录成功!', 'success')
    router.push('/user-dashboard')
  } catch (err) {
    console.error('Login error:', err)
    error.value = err.response?.data?.message || err.message || '登录失败'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  // 初始化主题（因为该页面不在 MainLayout 内）
  themeStore.initTheme()

  // 预加载 Clerk SDK（如果配置了）
  if (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) {
    try {
      await loadClerkSDK()
      setupClerkListener()
    } catch (error) {
      console.warn('Clerk 预加载失败:', error)
    }
  }
})
</script>

<style scoped>
/* 组件特定样式 */
</style>
