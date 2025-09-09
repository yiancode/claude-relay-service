import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import { clerkPlugin } from '@clerk/vue'
import App from './App.vue'
import router from './router'
import { useUserStore } from './stores/user'
import { useClerkStore } from './stores/clerk'
import CLERK_CONFIG, { validateClerkConfig } from './config/clerk'
import './assets/styles/main.css'
import './assets/styles/global.css'

// 创建Vue应用
const app = createApp(App)

// 使用Pinia状态管理
const pinia = createPinia()
app.use(pinia)

// 使用路由
app.use(router)

// 使用Element Plus
app.use(ElementPlus, {
  locale: zhCn
})

// 集成 Clerk 认证系统（渐进式集成，与现有系统并存）
console.log('Clerk Config Debug:', {
  publishableKey: CLERK_CONFIG.publishableKey,
  validation: validateClerkConfig()
})

if (validateClerkConfig()) {
  app.use(clerkPlugin, {
    publishableKey: CLERK_CONFIG.publishableKey,
    localization: CLERK_CONFIG.localization,
    appearance: CLERK_CONFIG.appearance,
    routing: CLERK_CONFIG.routing
  })
  console.log('Clerk: 已成功初始化用户认证系统')

  // 挂载应用
  app.mount('#app')

  // 初始化 Clerk Store（不直接传递实例，让组件负责）
  setTimeout(() => {
    try {
      const clerkStore = useClerkStore()
      clerkStore.initializeClerk()
      console.log('Main: Clerk Store 已初始化，等待组件传递实例')
    } catch (error) {
      console.error('Main: Clerk Store 初始化失败', error)
    }
  }, 100)
} else {
  console.warn('Clerk: 配置验证失败，社交登录功能将不可用')
  console.warn('Clerk publishableKey:', CLERK_CONFIG.publishableKey)

  // 挂载应用
  app.mount('#app')
}

// 设置axios拦截器
const userStore = useUserStore()
userStore.setupAxiosInterceptors()
