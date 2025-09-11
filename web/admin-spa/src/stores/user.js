import { defineStore } from 'pinia'
import axios from 'axios'
import { showToast } from '@/utils/toast'

const API_BASE = '/users'

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null,
    isAuthenticated: false,
    sessionToken: null,
    loading: false,
    config: null,
    // Clerk 集成相关状态
    authProvider: 'local', // 'local', 'ldap', 'clerk'
    clerkIntegration: {
      isEnabled: false,
      clerkUserId: null,
      oauthProvider: null
    }
  }),

  getters: {
    isLoggedIn: (state) => state.isAuthenticated && state.user,
    userName: (state) => state.user?.displayName || state.user?.username,
    userRole: (state) => state.user?.role,
    // Clerk 集成相关计算属性
    isClerkUser: (state) => state.authProvider === 'clerk',
    isLocalUser: (state) => state.authProvider === 'local' || state.authProvider === 'ldap',
    authProviderDisplay: (state) => {
      const providers = {
        local: '本地账户',
        ldap: 'LDAP账户',
        clerk: 'Clerk社交账户'
      }
      return providers[state.authProvider] || '未知'
    },
    oauthProviderDisplay: (state) => {
      if (!state.clerkIntegration.oauthProvider) return null
      const providers = {
        google: 'Google',
        github: 'GitHub'
      }
      return providers[state.clerkIntegration.oauthProvider] || state.clerkIntegration.oauthProvider
    }
  },

  actions: {
    // 🔐 用户登录
    async login(credentials) {
      this.loading = true
      try {
        const response = await axios.post(`${API_BASE}/login`, credentials)

        if (response.data.success) {
          this.user = response.data.user
          this.sessionToken = response.data.sessionToken
          this.isAuthenticated = true

          // 保存到 localStorage
          localStorage.setItem('userToken', this.sessionToken)
          localStorage.setItem('userData', JSON.stringify(this.user))

          // 设置 axios 默认头部
          this.setAuthHeader()

          return response.data
        } else {
          throw new Error(response.data.message || 'Login failed')
        }
      } catch (error) {
        this.clearAuth()
        throw error
      } finally {
        this.loading = false
      }
    },

    // 🚪 用户登出
    async logout() {
      try {
        if (this.sessionToken) {
          await axios.post(
            `${API_BASE}/logout`,
            {},
            {
              headers: { 'x-user-token': this.sessionToken }
            }
          )
        }
      } catch (error) {
        console.error('Logout request failed:', error)
      } finally {
        this.clearAuth()
      }
    },

    // 🔄 检查认证状态（扩展支持 Clerk）
    async checkAuth() {
      const token = localStorage.getItem('userToken')
      const userData = localStorage.getItem('userData')
      const userConfig = localStorage.getItem('userConfig')
      const authProvider = localStorage.getItem('authProvider') || 'local'
      const clerkIntegration = localStorage.getItem('clerkIntegration')

      if (!token || !userData) {
        this.clearAuth()
        return false
      }

      try {
        this.sessionToken = token
        this.user = JSON.parse(userData)
        this.config = userConfig ? JSON.parse(userConfig) : null
        this.authProvider = authProvider
        this.isAuthenticated = true

        // 恢复 Clerk 集成状态
        if (clerkIntegration && authProvider === 'clerk') {
          this.clerkIntegration = JSON.parse(clerkIntegration)
        }

        this.setAuthHeader()

        // 验证 token 是否仍然有效
        await this.getUserProfile()
        return true
      } catch (error) {
        console.error('Auth check failed:', error)
        this.clearAuth()
        return false
      }
    },

    // 👤 获取用户资料
    async getUserProfile() {
      try {
        const response = await axios.get(`${API_BASE}/profile`)

        if (response.data.success) {
          this.user = response.data.user
          this.config = response.data.config
          localStorage.setItem('userData', JSON.stringify(this.user))
          localStorage.setItem('userConfig', JSON.stringify(this.config))
          return response.data.user
        }
      } catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          // 401: Invalid/expired session, 403: Account disabled
          this.clearAuth()
          // If it's a disabled account error, throw a specific error
          if (error.response?.status === 403) {
            throw new Error(error.response.data?.message || 'Your account has been disabled')
          }
        }
        throw error
      }
    },

    // 🔑 获取用户API Keys
    async getUserApiKeys(includeDeleted = false) {
      try {
        const params = {}
        if (includeDeleted) {
          params.includeDeleted = 'true'
        }
        const response = await axios.get(`${API_BASE}/api-keys`, { params })
        return response.data.success ? response.data.apiKeys : []
      } catch (error) {
        console.error('Failed to fetch API keys:', error)
        throw error
      }
    },

    // 🔑 创建API Key
    async createApiKey(keyData) {
      try {
        const response = await axios.post(`${API_BASE}/api-keys`, keyData)
        return response.data
      } catch (error) {
        console.error('Failed to create API key:', error)
        throw error
      }
    },

    // 🗑️ 删除API Key
    async deleteApiKey(keyId) {
      try {
        const response = await axios.delete(`${API_BASE}/api-keys/${keyId}`)
        return response.data
      } catch (error) {
        console.error('Failed to delete API key:', error)
        throw error
      }
    },

    // 📊 获取使用统计
    async getUserUsageStats(params = {}) {
      try {
        const response = await axios.get(`${API_BASE}/usage-stats`, { params })
        return response.data.success ? response.data.stats : null
      } catch (error) {
        console.error('Failed to fetch usage stats:', error)
        throw error
      }
    },

    // 🎯 Clerk 用户数据设置（新增方法）
    async setUserData(userData) {
      try {
        this.user = userData
        this.sessionToken = userData.sessionToken
        this.isAuthenticated = true
        this.authProvider = userData.authProvider || 'clerk'

        // 设置 Clerk 集成信息
        if (userData.authProvider === 'clerk') {
          this.clerkIntegration = {
            isEnabled: true,
            clerkUserId: userData.clerkUserId,
            oauthProvider: userData.provider
          }
        }

        // 保存到 localStorage
        localStorage.setItem('userToken', this.sessionToken)
        localStorage.setItem('userData', JSON.stringify(this.user))
        localStorage.setItem('authProvider', this.authProvider)

        if (this.clerkIntegration.isEnabled) {
          localStorage.setItem('clerkIntegration', JSON.stringify(this.clerkIntegration))
        }

        // 设置认证头部
        this.setAuthHeader()

        return true
      } catch (error) {
        console.error('设置用户数据失败:', error)
        throw error
      }
    },

    // 🔐 Clerk 用户登录（新增方法）
    async loginWithClerk(clerkData) {
      this.loading = true
      try {
        const loginData = {
          provider: 'clerk',
          clerkUserId: clerkData.clerkUserId,
          email: clerkData.email,
          firstName: clerkData.firstName,
          lastName: clerkData.lastName,
          fullName: clerkData.fullName,
          avatar: clerkData.avatar,
          oauthProvider: clerkData.provider,
          clerkToken: clerkData.clerkToken
        }

        const response = await axios.post(`${API_BASE}/clerk/auth`, loginData)

        if (response.data.success) {
          await this.setUserData({
            ...response.data.user,
            authProvider: 'clerk',
            sessionToken: response.data.sessionToken,
            clerkUserId: clerkData.clerkUserId,
            provider: clerkData.provider
          })

          return response.data
        } else {
          throw new Error(response.data.message || 'Clerk 登录失败')
        }
      } catch (error) {
        this.clearAuth()
        throw error
      } finally {
        this.loading = false
      }
    },

    // 🔐 Clerk 认证（用于 clerk.js store）
    async authenticateWithClerk(clerkData) {
      this.loading = true
      try {
        const response = await axios.post(`${API_BASE}/users/clerk/auth`, clerkData)

        if (response.data.success) {
          await this.setClerkUserData(response.data.user, response.data.sessionToken)
          return response.data
        } else {
          throw new Error(response.data.message || 'Clerk 认证失败')
        }
      } catch (error) {
        this.clearAuth()
        throw error
      } finally {
        this.loading = false
      }
    },

    // 🎯 设置 Clerk 用户数据（用于 clerk.js store）
    async setClerkUserData(userData, sessionToken) {
      try {
        this.user = userData
        this.sessionToken = sessionToken
        this.isAuthenticated = true
        this.authProvider = 'clerk'

        // 设置 Clerk 集成信息
        this.clerkIntegration = {
          isEnabled: true,
          clerkUserId: userData.clerkUserId,
          oauthProvider: userData.provider
        }

        // 保存到 localStorage
        localStorage.setItem('userToken', this.sessionToken)
        localStorage.setItem('userData', JSON.stringify(this.user))
        localStorage.setItem('authProvider', this.authProvider)
        localStorage.setItem('clerkIntegration', JSON.stringify(this.clerkIntegration))

        // 设置认证头部
        this.setAuthHeader()

        return true
      } catch (error) {
        console.error('设置 Clerk 用户数据失败:', error)
        throw error
      }
    },

    // 🧹 清除认证信息（扩展支持 Clerk）
    clearAuth() {
      this.user = null
      this.sessionToken = null
      this.isAuthenticated = false
      this.config = null
      this.authProvider = 'local'
      this.clerkIntegration = {
        isEnabled: false,
        clerkUserId: null,
        oauthProvider: null
      }

      localStorage.removeItem('userToken')
      localStorage.removeItem('userData')
      localStorage.removeItem('userConfig')
      localStorage.removeItem('authProvider')
      localStorage.removeItem('clerkIntegration')

      // 清除 axios 默认头部
      delete axios.defaults.headers.common['x-user-token']
    },

    // 🔧 设置认证头部
    setAuthHeader() {
      if (this.sessionToken) {
        axios.defaults.headers.common['x-user-token'] = this.sessionToken
      }
    },

    // 🔧 设置axios拦截器
    setupAxiosInterceptors() {
      // Response interceptor to handle disabled user responses globally
      axios.interceptors.response.use(
        (response) => response,
        (error) => {
          if (error.response?.status === 403) {
            const message = error.response.data?.message
            if (message && (message.includes('disabled') || message.includes('Account disabled'))) {
              this.clearAuth()
              showToast(message, 'error')
              // Redirect to login page
              if (window.location.pathname !== '/user-login') {
                window.location.href = '/user-login'
              }
            }
          }
          return Promise.reject(error)
        }
      )
    }
  }
})
