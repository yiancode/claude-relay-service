/**
 * Clerk 用户认证系统配置
 * 集成 Clerk 提供现代化的 OAuth 社交登录体验
 */

// Clerk 配置常量
export const CLERK_CONFIG = {
  // Clerk 应用公钥 (从环境变量获取)
  publishableKey: import.meta.env.CLERK_PUBLISHABLE_KEY,

  // 本地化配置 - 中文支持
  localization: {
    locale: 'zh-CN'
  },

  // 主题和外观配置 - 与现有 Element Plus 风格保持一致
  appearance: {
    baseTheme: 'modern',
    variables: {
      // Element Plus 默认蓝色主题
      colorPrimary: '#1677ff',
      colorSuccess: '#67c23a',
      colorWarning: '#e6a23c',
      colorDanger: '#f56c6c',
      colorInfo: '#909399',

      // 字体配置
      fontFamily:
        '"Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", SimSun, sans-serif',
      fontSize: '14px',

      // 圆角配置 - 与 Element Plus 保持一致
      borderRadius: '4px',

      // 间距配置
      spacingUnit: '8px'
    },

    // 元素样式配置
    elements: {
      // 表单容器
      formButtonPrimary: {
        fontSize: '14px',
        padding: '12px 20px',
        borderRadius: '4px'
      },

      // 输入框
      formFieldInput: {
        borderRadius: '4px',
        fontSize: '14px'
      },

      // 社交登录按钮
      socialButtonsBlockButton: {
        borderRadius: '4px',
        fontSize: '14px',
        padding: '12px 20px'
      },

      // 卡片容器
      card: {
        borderRadius: '8px',
        boxShadow: '0 2px 12px 0 rgba(0, 0, 0, 0.1)'
      }
    }
  },

  // 路由配置
  routing: {
    // 登录成功后的重定向路径
    afterSignInUrl: '/user-dashboard',
    afterSignUpUrl: '/user-dashboard',

    // 登录和注册页面路径
    signInUrl: '/user-login-social',
    signUpUrl: '/user-login-social'
  },

  // 允许的重定向URL列表 (安全考虑)
  allowedRedirectOrigins: [
    'http://localhost:5173', // 开发环境
    'http://localhost:3000', // 本地后端
    window?.location?.origin // 当前域名
  ].filter(Boolean)
}

// 支持的 OAuth 提供商配置
export const OAUTH_PROVIDERS = {
  google: {
    name: 'Google',
    displayName: '谷歌账号',
    icon: 'google',
    buttonText: '使用 Google 账号登录'
  }
  // 未来可以扩展更多提供商
  // github: {
  //   name: 'GitHub',
  //   displayName: 'GitHub 账号',
  //   icon: 'github',
  //   buttonText: '使用 GitHub 账号登录'
  // }
}

// Clerk 错误消息本地化
export const CLERK_ERROR_MESSAGES = {
  clerk_error_generic: '登录过程中出现错误，请重试',
  clerk_error_network: '网络连接错误，请检查网络后重试',
  clerk_error_oauth_cancelled: '用户取消了授权登录',
  clerk_error_oauth_failed: 'OAuth 授权失败，请重试',
  clerk_error_session_expired: '登录会话已过期，请重新登录',
  clerk_error_user_not_found: '用户不存在',
  clerk_error_invalid_token: '无效的认证令牌'
}

// Clerk 功能开关配置
export const CLERK_FEATURES = {
  // 是否启用社交登录
  enableSocialLogin: true,

  // 是否启用邮箱密码登录 (通过 Clerk)
  enableEmailPassword: true,

  // 是否启用用户注册
  enableSignUp: true,

  // 是否启用用户资料编辑
  enableProfileEdit: true,

  // 是否启用多因素认证 (未来扩展)
  enableMFA: false
}

// 验证配置是否完整
export function validateClerkConfig() {
  if (!CLERK_CONFIG.publishableKey) {
    console.warn('Clerk: 缺少 CLERK_PUBLISHABLE_KEY 环境变量')
    return false
  }

  if (!CLERK_CONFIG.publishableKey.startsWith('pk_')) {
    console.error('Clerk: 无效的 publishableKey 格式')
    return false
  }

  return true
}

// 默认导出配置对象
export default CLERK_CONFIG
