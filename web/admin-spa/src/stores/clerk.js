/**
 * Clerk 认证状态管理 Store (优化版)
 * 专门处理 Clerk OAuth 社交登录相关的状态和逻辑
 * 与现有的 user store 协作，提供统一的用户认证体验
 * 支持 Modal 方式登录，无需页面跳转
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { showToast } from '@/utils/toast'
import { useUserStore } from './user'
import axios from 'axios'

const API_BASE = '/webapi'

export const useClerkStore = defineStore('clerk', () => {
  // ========== 核心状态 ==========

  // 初始化状态
  const isInitialized = ref(false)
  const isLoading = ref(false)
  const error = ref(null)

  // Clerk 客户端实例
  let clerkInstance = null

  // 用户状态
  const clerkUser = ref(null)
  const isSignedIn = ref(false)
  const sessionToken = ref(null)

  // 同步状态
  const isSyncing = ref(false)
  const syncError = ref(null)
  const lastSyncTime = ref(null)

  // 配置状态
  const config = ref({
    publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
    enabled: !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
  })

  // ========== 计算属性 ==========

  const isAuthenticated = computed(() => isSignedIn.value && !!clerkUser.value)

  const currentUser = computed(() => {
    if (!clerkUser.value) return null

    return {
      id: clerkUser.value.id,
      email: clerkUser.value.primaryEmailAddress?.emailAddress,
      firstName: clerkUser.value.firstName,
      lastName: clerkUser.value.lastName,
      fullName: clerkUser.value.fullName,
      avatar: clerkUser.value.imageUrl,
      createdAt: clerkUser.value.createdAt,
      updatedAt: clerkUser.value.updatedAt,
      lastSignInAt: clerkUser.value.lastSignInAt
    }
  })

  const authProvider = computed(() => {
    if (!clerkUser.value?.externalAccounts?.length) return null
    return clerkUser.value.externalAccounts[0]?.provider || 'unknown'
  })

  // ========== 核心方法 ==========

  // 初始化 Clerk
  const initialize = async () => {
    if (!config.value.enabled) {
      console.warn('Clerk: 配置未启用')
      return false
    }

    if (isInitialized.value) {
      return clerkInstance
    }

    try {
      isLoading.value = true
      error.value = null

      // 动态导入 Clerk SDK
      const { Clerk } = await import('@clerk/clerk-js')

      clerkInstance = new Clerk(config.value.publishableKey)

      // 加载 Clerk
      await clerkInstance.load({
        // 优化配置
        appearance: {
          elements: {
            modalBackdrop: 'backdrop-blur-sm bg-black/50',
            card: 'shadow-2xl rounded-xl border-0',
            headerTitle: 'text-xl font-semibold text-gray-900 dark:text-white',
            headerSubtitle: 'text-sm text-gray-600 dark:text-gray-400 mt-1',
            socialButtonsBlockButton:
              'h-11 font-medium transition-all duration-200 rounded-lg border border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500',
            socialButtonsBlockButtonText: 'font-medium text-sm',
            formButtonPrimary:
              'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 transition-colors duration-200 rounded-lg',
            footer: 'hidden',
            footerAction: 'hidden'
          },
          variables: {
            colorPrimary: '#1677ff',
            colorSuccess: '#67c23a',
            colorWarning: '#e6a23c',
            colorDanger: '#f56c6c',
            borderRadius: '8px',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
          },
          layout: {
            socialButtonsPlacement: 'top',
            socialButtonsVariant: 'blockButton',
            showOptionalFields: false
          }
        },
        localization: {
          signIn: {
            start: {
              title: '登录到 ViliCode',
              subtitle: '使用您的账号登录'
            }
          }
        }
      })

      // 设置状态
      isInitialized.value = true
      clerkUser.value = clerkInstance.user
      isSignedIn.value = !!clerkInstance.user
      sessionToken.value = await clerkInstance.session?.getToken()

      // 设置事件监听器
      setupEventListeners()

      console.log('Clerk: 初始化成功')
      return clerkInstance
    } catch (err) {
      console.error('Clerk: 初始化失败:', err)
      error.value = err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // 设置事件监听器
  const setupEventListeners = () => {
    if (!clerkInstance) return

    // 监听用户状态变化
    clerkInstance.addListener(({ user, session }) => {
      console.log('Clerk: 状态变化', { user: !!user, session: !!session })

      clerkUser.value = user
      isSignedIn.value = !!user && !!session

      if (session) {
        session
          .getToken()
          .then((token) => {
            sessionToken.value = token
          })
          .catch((err) => {
            console.error('Clerk: 获取 token 失败:', err)
          })
      } else {
        sessionToken.value = null
      }

      // 如果用户登录且未同步，自动同步
      if (user && session && !isSyncing.value) {
        syncUserToBackend()
      }
    })
  }

  // 打开登录 Modal
  const openSignIn = async (options = {}) => {
    try {
      if (!isInitialized.value) {
        await initialize()
      }

      if (!clerkInstance) {
        throw new Error('Clerk 未初始化')
      }

      // 检查是否已登录
      if (clerkInstance.user) {
        console.log('Clerk: 用户已登录，直接同步')
        await syncUserToBackend()
        return
      }

      isLoading.value = true

      // 打开登录 Modal
      await clerkInstance.openSignIn({
        routing: 'virtual',
        redirectUrl: window.location.origin + '/user-dashboard',
        ...options
      })
    } catch (err) {
      console.error('Clerk: 打开登录失败:', err)
      error.value = err.message
      showToast('登录失败，请重试', 'error')
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // 同步用户数据到后端
  const syncUserToBackend = async (forceSync = false) => {
    if (!isSignedIn.value || !clerkUser.value) {
      console.warn('Clerk: 无有效用户，跳过同步')
      return null
    }

    if (isSyncing.value && !forceSync) {
      console.log('Clerk: 同步正在进行中')
      return null
    }

    try {
      isSyncing.value = true
      syncError.value = null

      // 获取最新的 session token
      if (!sessionToken.value && clerkInstance?.session) {
        sessionToken.value = await clerkInstance.session.getToken()
      }

      if (!sessionToken.value) {
        throw new Error('无法获取认证令牌')
      }

      // 准备用户数据
      const userData = {
        clerkUserId: clerkUser.value.id,
        clerkToken: sessionToken.value,
        email: clerkUser.value.primaryEmailAddress?.emailAddress,
        firstName: clerkUser.value.firstName,
        lastName: clerkUser.value.lastName,
        fullName: clerkUser.value.fullName,
        avatar: clerkUser.value.imageUrl,
        provider: authProvider.value,
        lastSignInAt: clerkUser.value.lastSignInAt
      }

      console.log('Clerk: 开始同步用户数据')

      // 调用后端同步接口
      const response = await axios.post(`${API_BASE}/users/clerk/auth`, userData)

      if (response.data.success) {
        // 更新本地用户状态
        const userStore = useUserStore()
        await userStore.setClerkUserData(response.data.user, response.data.sessionToken)

        lastSyncTime.value = new Date()

        console.log('Clerk: 用户同步成功')
        showToast('登录成功！', 'success')

        return response.data
      } else {
        throw new Error(response.data.message || '同步失败')
      }
    } catch (err) {
      console.error('Clerk: 用户同步失败:', err)
      syncError.value = err.message

      // 同步失败时显示错误，但不自动登出
      showToast(err.response?.data?.message || err.message || '登录失败，请重试', 'error')

      throw err
    } finally {
      isSyncing.value = false
    }
  }

  // 登出
  const signOut = async (redirectUrl = '/user-login') => {
    try {
      isLoading.value = true

      // Clerk 登出
      if (clerkInstance?.user) {
        await clerkInstance.signOut()
      }

      // 清理状态
      clerkUser.value = null
      isSignedIn.value = false
      sessionToken.value = null
      syncError.value = null
      lastSyncTime.value = null

      // 清理本地用户状态
      const userStore = useUserStore()
      await userStore.logout()

      showToast('已成功退出登录', 'success')

      // 重定向
      if (redirectUrl) {
        window.location.href = redirectUrl
      }
    } catch (err) {
      console.error('Clerk: 登出失败:', err)
      showToast('登出失败，请重试', 'error')
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // 刷新用户数据
  const refreshUser = async () => {
    if (!clerkInstance?.user) {
      return null
    }

    try {
      // 重新加载用户数据
      await clerkInstance.user.reload()
      clerkUser.value = clerkInstance.user

      // 重新同步到后端
      return await syncUserToBackend(true)
    } catch (err) {
      console.error('Clerk: 刷新用户数据失败:', err)
      throw err
    }
  }

  // 获取服务状态
  const getServiceStatus = () => {
    return {
      enabled: config.value.enabled,
      initialized: isInitialized.value,
      authenticated: isAuthenticated.value,
      loading: isLoading.value,
      syncing: isSyncing.value,
      lastSync: lastSyncTime.value,
      error: error.value || syncError.value
    }
  }

  // 检查网络状态
  const checkNetworkStatus = async () => {
    try {
      await fetch('https://api.clerk.dev/health', {
        method: 'HEAD',
        mode: 'no-cors'
      })
      return true
    } catch {
      return false
    }
  }

  // 重试机制
  const retryOperation = async (operation, maxRetries = 3, delay = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation()
      } catch (err) {
        if (i === maxRetries - 1) throw err

        console.warn(`Clerk: 操作失败，${delay}ms 后重试 (${i + 1}/${maxRetries})`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        delay *= 2 // 指数退避
      }
    }
  }

  // 监听网络状态
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      if (isSignedIn.value && !isSyncing.value) {
        console.log('Clerk: 网络重连，重新同步用户数据')
        syncUserToBackend()
      }
    })
  }

  return {
    // 状态
    isInitialized,
    isLoading,
    error,
    clerkUser,
    isSignedIn,
    sessionToken,
    isSyncing,
    syncError,
    lastSyncTime,
    config,

    // 计算属性
    isAuthenticated,
    currentUser,
    authProvider,

    // 方法
    initialize,
    openSignIn,
    syncUserToBackend,
    signOut,
    refreshUser,
    getServiceStatus,
    checkNetworkStatus,
    retryOperation
  }
})
