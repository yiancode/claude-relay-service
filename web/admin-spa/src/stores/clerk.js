/**
 * Clerk 认证状态管理 Store
 * 专门处理 Clerk OAuth 社交登录相关的状态和逻辑
 * 与现有的 user store 协作，提供统一的用户认证体验
 */

import { defineStore } from 'pinia'
import { ref, computed, readonly, watch } from 'vue'
import { ElMessage, ElLoading } from 'element-plus'
import { useUserStore } from './user'
import { OAUTH_PROVIDERS, CLERK_ERROR_MESSAGES } from '@/config/clerk'
import axios from 'axios'

export const useClerkStore = defineStore('clerk', () => {
  // ========== 响应式数据 ==========

  // Clerk 初始化状态
  const isClerkReady = ref(false)
  const isClerkLoading = ref(true)

  // 用户认证状态
  const isAuthenticated = ref(false)
  const isSigningIn = ref(false)
  const isSigningOut = ref(false)

  // Clerk 用户信息
  const clerkUser = ref(null)
  const clerkSession = ref(null)
  const clerkToken = ref(null)

  // OAuth 提供商状态
  const availableProviders = ref(Object.keys(OAUTH_PROVIDERS))
  const activeProvider = ref(null)

  // 错误状态管理
  const lastError = ref(null)
  const errorCount = ref(0)
  const connectionError = ref(null)
  const isNetworkError = ref(false)

  // ========== Clerk 实例管理 ==========

  let clerkInstance = null
  let userInstance = null

  // 设置 Clerk 实例（由组件调用）
  function setClerkInstance(clerk, user) {
    // 防止重复设置
    if (clerkInstance && clerkInstance === clerk) {
      console.log('Clerk Store: 实例已设置，跳过重复设置')
      return
    }

    clerkInstance = clerk
    userInstance = user
    console.log('Clerk Store: 接收到实例', {
      hasClerkInstance: !!clerkInstance,
      hasUserInstance: !!userInstance,
      clerkLoaded: clerkInstance?.loaded
    })

    // 检查是否需要使用全局 Clerk 实例作为回退
    if (!clerkInstance || typeof clerkInstance.loaded === 'undefined') {
      console.log('Clerk Store: Vue实例不可用，尝试使用全局 window.Clerk')
      if (typeof window !== 'undefined' && window.Clerk) {
        clerkInstance = window.Clerk
        console.log('Clerk Store: 已回退到全局 Clerk 实例', {
          loaded: clerkInstance.loaded,
          hasOpenSignIn: typeof clerkInstance.openSignIn === 'function'
        })
      }
    }

    if (clerkInstance && userInstance) {
      console.log('Clerk Store: 检查Clerk加载状态', {
        loaded: clerkInstance.loaded,
        hasAddOnLoaded: typeof clerkInstance.addOnLoaded === 'function',
        availableMethods: Object.getOwnPropertyNames(clerkInstance)
          .filter((name) => typeof clerkInstance[name] === 'function')
          .slice(0, 10)
      })

      // 修改检测逻辑：如果 loaded 是 undefined，等待初始化
      if (clerkInstance.loaded === true) {
        isClerkReady.value = true
        isClerkLoading.value = false
        setupWatchers()
        console.log('Clerk Store: 成功初始化（已加载）')
      } else if (typeof clerkInstance.addOnLoaded === 'function') {
        console.log('Clerk Store: 等待 Clerk 加载完成...')
        clerkInstance.addOnLoaded(() => {
          isClerkReady.value = true
          isClerkLoading.value = false
          setupWatchers()
          console.log('Clerk Store: 成功初始化（加载完成）')
        })
      } else {
        // 如果 loaded 是 undefined 或没有 addOnLoaded 方法，延迟初始化
        console.log('Clerk Store: 延迟初始化等待 Clerk 完全加载')

        // 轮询检查 Clerk 是否完全加载
        let attempts = 0
        const maxAttempts = 50 // 10秒内轮询

        const waitForClerkReady = () => {
          attempts++
          console.log(`Clerk Store: 等待加载完成 (${attempts}/${maxAttempts})`, {
            loaded: clerkInstance?.loaded,
            user: userInstance?.user
          })

          // 检查是否有网络连接错误（从第5次尝试开始检测）
          if (attempts >= 5) {
            const hasNetworkError = checkNetworkErrors()
            if (hasNetworkError) {
              console.error('Clerk Store: 检测到网络连接错误', {
                attempts,
                failedRequests: performance
                  .getEntries()
                  .filter(
                    (entry) =>
                      entry.name &&
                      (entry.name.includes('clerk') || entry.name.includes('accounts.dev')) &&
                      (entry.transferSize === 0 || entry.responseEnd === 0)
                  ).length
              })
              isClerkLoading.value = false
              isNetworkError.value = true
              isClerkReady.value = false
              connectionError.value = new Error('无法连接到Clerk服务器，请检查网络连接')
              return
            }
          }

          // 检查 Clerk 是否完全初始化（通过检查是否有用户数据或loaded状态为true）
          if (clerkInstance?.loaded === true || userInstance?.user !== undefined) {
            // 延迟检查网络错误，给网络请求一些时间完成
            setTimeout(() => {
              // 重新检查全局 Clerk 状态，它可能现在已经加载完成了
              if (typeof window !== 'undefined' && window.Clerk && window.Clerk.loaded) {
                console.log('Clerk Store: 延迟检查发现全局 Clerk 已加载完成，取消网络错误状态')
                isClerkLoading.value = false
                isNetworkError.value = false
                connectionError.value = null
                isClerkReady.value = true

                // 更新实例引用
                if (!clerkInstance || typeof clerkInstance.loaded === 'undefined') {
                  clerkInstance = window.Clerk
                }
                return
              }

              const hasNetworkError = checkNetworkErrors()
              if (hasNetworkError && (isClerkReady.value || isClerkLoading.value)) {
                console.error(
                  'Clerk Store: 虽然有用户数据，但检测到网络连接错误，将状态设置为网络错误'
                )
                isClerkLoading.value = false
                isNetworkError.value = true
                isClerkReady.value = false
                connectionError.value = new Error('网络连接异常，社交登录功能不可用')
              }
            }, 2000) // 2秒后检查网络状态

            isClerkReady.value = true
            isClerkLoading.value = false
            isNetworkError.value = false
            connectionError.value = null
            setupWatchers()
            console.log('Clerk Store: 延迟初始化成功，将在2秒后检查网络状态')
            return
          }

          if (attempts >= maxAttempts) {
            console.error('Clerk Store: 初始化超时')
            isClerkLoading.value = false
            lastError.value = new Error('Clerk 初始化超时')
            return
          }

          setTimeout(waitForClerkReady, 200)
        }

        waitForClerkReady()
      }
    }
  }

  // 初始化 Clerk 实例（现在仅设置加载状态）
  function initializeClerk() {
    // 如果已经成功初始化，不要重置状态
    if (isClerkReady.value) {
      console.log('Clerk Store: 已成功初始化，跳过重复初始化')
      return
    }

    // 检查全局 Clerk 是否已经可用
    if (typeof window !== 'undefined' && window.Clerk && window.Clerk.loaded) {
      console.log('Clerk Store: 检测到全局 Clerk 已加载，直接使用')
      clerkInstance = window.Clerk
      isClerkReady.value = true
      isClerkLoading.value = false
      isNetworkError.value = false
      connectionError.value = null
      console.log('Clerk Store: 全局 Clerk 实例初始化成功')
      return
    }

    console.log('Clerk Store: 开始初始化，等待组件传递实例')
    isClerkLoading.value = true
    isClerkReady.value = false
  }

  // ========== 计算属性 ==========

  // 当前用户信息（格式化后）
  const currentUser = computed(() => {
    if (!clerkUser.value) return null

    return {
      id: clerkUser.value.id,
      email: clerkUser.value.primaryEmailAddress?.emailAddress,
      firstName: clerkUser.value.firstName,
      lastName: clerkUser.value.lastName,
      fullName: `${clerkUser.value.firstName || ''} ${clerkUser.value.lastName || ''}`.trim(),
      avatar: clerkUser.value.imageUrl,
      provider: getAuthProvider(clerkUser.value),
      createdAt: clerkUser.value.createdAt,
      lastActiveAt: clerkUser.value.lastActiveAt
    }
  })

  // 是否有有效的会话
  const hasValidSession = computed(() => {
    return isAuthenticated.value && clerkSession.value && clerkToken.value
  })

  // 认证提供商信息
  const authProviderInfo = computed(() => {
    if (!activeProvider.value || !OAUTH_PROVIDERS[activeProvider.value]) {
      return null
    }
    return OAUTH_PROVIDERS[activeProvider.value]
  })

  // ========== 监听器设置 ==========

  function setupWatchers() {
    // 监听用户状态变化
    watch(
      () => userInstance?.user,
      (newUser) => {
        console.log('Clerk Store: 用户状态变化', {
          newUser,
          hasEmail: newUser?.primaryEmailAddress?.emailAddress
        })
        clerkUser.value = newUser
        isAuthenticated.value = !!newUser

        if (newUser && newUser.primaryEmailAddress?.emailAddress) {
          // 只有在用户有完整信息时才同步
          console.log('Clerk Store: 检测到完整用户信息，开始同步')
          updateSessionInfo()
          syncWithUserStore()
        } else if (newUser) {
          // 用户对象存在但信息不完整，仅更新会话
          console.log('Clerk Store: 用户信息不完整，仅更新会话')
          updateSessionInfo()
        } else {
          clearSessionInfo()
        }
      },
      { immediate: true }
    )

    // 监听会话变化
    watch(
      () => clerkInstance?.session,
      (newSession) => {
        clerkSession.value = newSession
        if (newSession) {
          updateTokenInfo()
        }
      },
      { immediate: true }
    )
  }

  // ========== 核心认证方法 ==========

  /**
   * 使用指定提供商登录
   * @param {string} provider - OAuth 提供商 (google, github 等)
   * @param {Object} options - 登录选项
   */
  async function signInWithProvider(provider = 'google', options = {}) {
    if (!isClerkReady.value) {
      throw new Error('Clerk 尚未初始化完成')
    }

    if (!OAUTH_PROVIDERS[provider]) {
      throw new Error(`不支持的 OAuth 提供商: ${provider}`)
    }

    isSigningIn.value = true
    activeProvider.value = provider
    lastError.value = null

    // 显示加载提示
    const loading = ElLoading.service({
      lock: true,
      text: `正在使用 ${OAUTH_PROVIDERS[provider].displayName} 登录...`,
      spinner: 'el-icon-loading'
    })

    try {
      // 调用 Clerk 的 OAuth 登录 - 使用 openSignIn 方法
      console.log(`Clerk Store: 准备启动 ${provider} OAuth 登录`)
      console.log('Clerk实例方法检查:', {
        hasOpenSignIn: typeof clerkInstance.openSignIn,
        hasRedirectToSignIn: typeof clerkInstance.redirectToSignIn
      })

      if (typeof clerkInstance.openSignIn === 'function') {
        // 使用 openSignIn 方法打开登录弹窗
        console.log(`Clerk Store: 使用 openSignIn 方法启动 ${provider} 登录`)
        clerkInstance.openSignIn({
          redirectUrl: options.afterSignInUrl || '/user-dashboard',
          routing: 'path'
        })
      } else if (typeof clerkInstance.redirectToSignIn === 'function') {
        // 使用 redirectToSignIn 方法
        console.log(`Clerk Store: 使用 redirectToSignIn 方法启动 ${provider} 登录`)
        clerkInstance.redirectToSignIn({
          redirectUrl: options.afterSignInUrl || '/user-dashboard'
        })
      } else {
        throw new Error(`Clerk 实例没有可用的登录方法`)
      }

      console.log(`Clerk Store: ${provider} OAuth 登录流程已启动`)
    } catch (error) {
      console.error(`Clerk Store: ${provider} 登录失败`, error)

      isSigningIn.value = false
      activeProvider.value = null
      lastError.value = error
      errorCount.value++

      // 显示用户友好的错误消息
      const errorMessage = getErrorMessage(error)
      ElMessage.error(errorMessage)

      throw error
    } finally {
      loading.close()
    }
  }

  /**
   * 处理 OAuth 回调
   * 在回调页面中调用此方法来完成认证流程
   */
  async function handleOAuthCallback() {
    if (!isClerkReady.value) {
      throw new Error('Clerk 尚未初始化完成')
    }

    try {
      // Clerk 会自动处理 OAuth 回调
      // 我们只需要等待用户状态更新
      await new Promise((resolve) => {
        const unwatch = watch(
          () => isAuthenticated.value,
          (newValue) => {
            if (newValue) {
              unwatch()
              resolve()
            }
          }
        )

        // 设置超时防止无限等待
        setTimeout(() => {
          unwatch()
          resolve()
        }, 10000)
      })

      if (isAuthenticated.value) {
        console.log('Clerk Store: OAuth 回调处理成功')
        await syncWithUserStore()
        return true
      } else {
        throw new Error('OAuth 回调处理超时')
      }
    } catch (error) {
      console.error('Clerk Store: OAuth 回调处理失败', error)
      lastError.value = error
      throw error
    }
  }

  /**
   * 登出用户
   */
  async function signOut() {
    if (!isClerkReady.value || !isAuthenticated.value) {
      return
    }

    isSigningOut.value = true

    try {
      // 调用 Clerk 登出
      await clerkInstance.signOut()

      // 清理本地状态
      clearSessionInfo()

      // 同步到用户 store
      const userStore = useUserStore()
      await userStore.logout()

      ElMessage.success('已成功退出登录')
      console.log('Clerk Store: 用户已成功登出')
    } catch (error) {
      console.error('Clerk Store: 登出失败', error)
      ElMessage.error('登出时发生错误')
      throw error
    } finally {
      isSigningOut.value = false
    }
  }

  // ========== 数据同步方法 ==========

  /**
   * 将 Clerk 用户数据同步到后端和用户 store
   */
  async function syncWithUserStore() {
    if (!currentUser.value) {
      console.warn('Clerk Store: 无用户数据需要同步')
      return
    }

    try {
      // 获取最新的认证 Token
      await updateTokenInfo()

      if (!clerkToken.value) {
        throw new Error('无法获取 Clerk 认证 Token')
      }

      // 准备同步到后端的用户数据
      const syncData = {
        clerkUserId: currentUser.value.id,
        email: currentUser.value.email,
        firstName: currentUser.value.firstName,
        lastName: currentUser.value.lastName,
        fullName: currentUser.value.fullName,
        avatar: currentUser.value.avatar,
        provider: currentUser.value.provider,
        clerkToken: clerkToken.value
      }

      // 调用后端 API 同步用户数据
      const response = await axios.post('/webapi/users/clerk/sync', syncData)

      if (response.data.success) {
        // 更新用户 store 的数据
        const userStore = useUserStore()
        await userStore.setUserData({
          ...response.data.user,
          authProvider: 'clerk',
          sessionToken: response.data.sessionToken
        })

        console.log('Clerk Store: 用户数据同步成功')
        ElMessage.success('登录成功，欢迎回来！')
      } else {
        throw new Error(response.data.message || '用户数据同步失败')
      }
    } catch (error) {
      console.error('Clerk Store: 用户数据同步失败', error)

      // 如果是网络错误，提示用户重试
      if (error.code === 'NETWORK_ERROR') {
        ElMessage.error('网络连接错误，请稍后重试')
      } else {
        ElMessage.error('用户数据同步失败，请联系管理员')
      }

      throw error
    }
  }

  /**
   * 获取当前 Clerk Token
   */
  async function getClerkToken() {
    if (!isAuthenticated.value || !clerkSession.value) {
      return null
    }

    try {
      const token = await clerkSession.value.getToken()
      return token
    } catch (error) {
      console.error('Clerk Store: 获取 Token 失败', error)
      return null
    }
  }

  // ========== 网络连接检查 ==========

  /**
   * 检查是否有网络连接错误
   */
  function checkNetworkErrors() {
    // 首先检查全局 Clerk 是否可用并已加载
    if (typeof window !== 'undefined' && window.Clerk && window.Clerk.loaded) {
      console.log('Clerk Store: 全局 Clerk 已加载，跳过网络错误检查')
      return false
    }

    // 检查性能条目中是否有 Clerk 相关的失败请求
    const performanceEntries = performance.getEntries()
    const failedRequests = performanceEntries.filter(
      (entry) =>
        entry.name &&
        (entry.name.includes('clerk') ||
          entry.name.includes('accounts.dev') ||
          entry.name.includes('js.clerk.dev')) &&
        (entry.transferSize === 0 || entry.responseEnd === 0 || entry.duration === 0)
    )

    // 检查是否有 JavaScript 错误（通过检查 window.onerror 或其他方式）
    const hasJSErrors = window.hasClerkErrors || false

    // 尝试检查网络状态
    const isOnline = navigator.onLine

    console.log('Clerk Store: 网络错误检查', {
      windowClerkLoaded: window.Clerk?.loaded,
      failedRequestsCount: failedRequests.length,
      failedRequests: failedRequests.map((r) => ({
        name: r.name,
        transferSize: r.transferSize,
        responseEnd: r.responseEnd
      })),
      hasJSErrors,
      isOnline
    })

    return failedRequests.length > 0 || !isOnline
  }

  /**
   * 测试网络连接到 Clerk 服务
   */
  async function testClerkConnectivity() {
    try {
      // 尝试连接 Clerk CDN
      // eslint-disable-next-line no-unused-vars
      const _response = await fetch('https://js.clerk.dev/v4/clerk.browser.js', {
        method: 'HEAD',
        mode: 'no-cors',
        timeout: 5000
      })
      return true
    } catch (error) {
      console.error('Clerk connectivity test failed:', error)
      return false
    }
  }

  // ========== 辅助方法 ==========

  /**
   * 更新会话信息
   */
  async function updateSessionInfo() {
    try {
      clerkSession.value = clerkInstance?.session || null
      await updateTokenInfo()
    } catch (error) {
      console.error('Clerk Store: 更新会话信息失败', error)
    }
  }

  /**
   * 更新 Token 信息
   */
  async function updateTokenInfo() {
    try {
      if (clerkSession.value) {
        clerkToken.value = await clerkSession.value.getToken()
      }
    } catch (error) {
      console.error('Clerk Store: 更新 Token 失败', error)
      clerkToken.value = null
    }
  }

  /**
   * 清理会话信息
   */
  function clearSessionInfo() {
    isAuthenticated.value = false
    clerkUser.value = null
    clerkSession.value = null
    clerkToken.value = null
    activeProvider.value = null
  }

  /**
   * 获取用户的认证提供商
   */
  function getAuthProvider(user) {
    if (!user || !user.externalAccounts || user.externalAccounts.length === 0) {
      return 'email'
    }

    return user.externalAccounts[0].provider || 'unknown'
  }

  /**
   * 获取友好的错误消息
   */
  function getErrorMessage(error) {
    const errorCode = error?.code || error?.type || 'clerk_error_generic'
    return CLERK_ERROR_MESSAGES[errorCode] || CLERK_ERROR_MESSAGES['clerk_error_generic']
  }

  /**
   * 重置错误状态
   */
  function clearError() {
    lastError.value = null
  }

  // ========== 返回 Store 接口 ==========

  return {
    // 状态
    isClerkReady: readonly(isClerkReady),
    isClerkLoading: readonly(isClerkLoading),
    isAuthenticated: readonly(isAuthenticated),
    isSigningIn: readonly(isSigningIn),
    isSigningOut: readonly(isSigningOut),
    currentUser,
    hasValidSession,
    authProviderInfo,
    availableProviders: readonly(availableProviders),
    lastError: readonly(lastError),
    errorCount: readonly(errorCount),
    connectionError: readonly(connectionError),
    isNetworkError: readonly(isNetworkError),

    // 方法
    initializeClerk,
    setClerkInstance,
    signInWithProvider,
    handleOAuthCallback,
    signOut,
    syncWithUserStore,
    getClerkToken,
    clearError,
    testClerkConnectivity
  }
})

// 导出一个初始化函数，供 main.js 使用
export function initializeClerkStore() {
  const clerkStore = useClerkStore()

  // 延迟初始化，确保 Clerk 插件已经加载
  setTimeout(() => {
    clerkStore.initializeClerk()
  }, 100)

  return clerkStore
}
