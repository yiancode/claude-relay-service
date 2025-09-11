/**
 * Clerk 用户认证服务 (优化版)
 * 处理 Clerk OAuth 用户的认证、创建和数据同步
 * 与现有的 LDAP 用户系统并存，不冲突
 *
 * 优化功能:
 * - 用户信息缓存机制
 * - 增强错误处理和重试
 * - 性能监控和指标
 * - 批量操作支持
 * - 安全性增强
 */

const { createClerkClient } = require('@clerk/clerk-sdk-node')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const userService = require('./userService')
const logger = require('../utils/logger')
const redis = require('../models/redis')
const config = require('../../config/config')

// 性能监控指标
const metrics = {
  userCacheHits: 0,
  userCacheMisses: 0,
  tokenVerifications: 0,
  sessionCreations: 0,
  errors: 0,
  lastReset: Date.now()
}

// 缓存配置
const CACHE_CONFIG = {
  USER_INFO_TTL: 15 * 60, // 用户信息缓存15分钟
  TOKEN_VERIFICATION_TTL: 5 * 60, // Token验证缓存5分钟
  SESSION_CLEANUP_INTERVAL: 60 * 60, // 会话清理间隔1小时
  METRICS_RESET_INTERVAL: 24 * 60 * 60 // 指标重置间隔24小时
}

// 错误类型定义
const ErrorTypes = {
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  CLERK_API_ERROR: 'CLERK_API_ERROR',
  TOKEN_VALIDATION_ERROR: 'TOKEN_VALIDATION_ERROR',
  USER_CREATION_ERROR: 'USER_CREATION_ERROR',
  SESSION_ERROR: 'SESSION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR'
}

// Clerk 客户端初始化
let clerkClient = null

// 从环境变量获取 Clerk 配置
const { CLERK_SECRET_KEY } = process.env
const { CLERK_PUBLISHABLE_KEY } = process.env

// 初始化 Clerk 客户端
function initializeClerkClient() {
  if (!CLERK_SECRET_KEY) {
    logger.warn('Clerk: CLERK_SECRET_KEY 环境变量未设置，Clerk 功能将不可用')
    return null
  }

  try {
    clerkClient = createClerkClient({
      secretKey: CLERK_SECRET_KEY,
      publishableKey: CLERK_PUBLISHABLE_KEY
    })

    logger.info('Clerk: 客户端初始化成功')
    return clerkClient
  } catch (error) {
    logger.error('Clerk: 客户端初始化失败:', error)
    return null
  }
}

// 确保 Clerk 客户端已初始化
function ensureClerkClient() {
  if (!clerkClient) {
    clerkClient = initializeClerkClient()
  }

  if (!clerkClient) {
    throw new Error('Clerk 服务不可用：客户端初始化失败')
  }

  return clerkClient
}

// 验证 Clerk JWT Token (优化版)
async function verifyClerkToken(token, useCache = true) {
  const startTime = Date.now()
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 16)

  try {
    metrics.tokenVerifications++

    // 尝试从缓存获取验证结果
    if (useCache) {
      const cacheKey = `clerk_token_verification:${tokenHash}`
      const redisClient = redis.getClient()
      const cachedResult = await redisClient.get(cacheKey)

      if (cachedResult) {
        const result = JSON.parse(cachedResult)
        logger.debug(`Clerk: Token验证缓存命中 ${tokenHash}`)
        return result
      }
    }

    const client = ensureClerkClient()

    // 使用 Clerk SDK 验证 JWT
    const payload = await client.verifyToken(token)

    const result = {
      valid: true,
      userId: payload.sub,
      sessionId: payload.sid,
      issuer: payload.iss,
      audience: payload.aud,
      expiresAt: payload.exp,
      issuedAt: payload.iat,
      payload
    }

    // 缓存验证结果（仅缓存有效的token）
    if (useCache && result.valid) {
      const cacheKey = `clerk_token_verification:${tokenHash}`
      const ttl = Math.min(
        CACHE_CONFIG.TOKEN_VERIFICATION_TTL,
        (result.expiresAt * 1000 - Date.now()) / 1000
      )

      if (ttl > 0) {
        const redisClient = redis.getClient()
        await redisClient.setex(cacheKey, Math.floor(ttl), JSON.stringify(result))
      }
    }

    const duration = Date.now() - startTime
    logger.debug(`Clerk: Token验证成功 ${tokenHash} (${duration}ms)`)

    return result
  } catch (error) {
    metrics.errors++
    const duration = Date.now() - startTime

    const errorType = classifyError(error)
    logger.warn(`Clerk: Token验证失败 ${tokenHash} (${duration}ms):`, {
      type: errorType,
      message: error.message,
      code: error.code
    })

    return {
      valid: false,
      error: error.message,
      errorType,
      tokenHash
    }
  }
}

// 从 Clerk 获取用户信息 (优化版，支持缓存)
async function getClerkUser(clerkUserId, useCache = true) {
  const startTime = Date.now()

  try {
    // 尝试从缓存获取用户信息
    if (useCache) {
      const cacheKey = `clerk_user_info:${clerkUserId}`
      const redisClient = redis.getClient()
      const cachedUser = await redisClient.get(cacheKey)

      if (cachedUser) {
        metrics.userCacheHits++
        const user = JSON.parse(cachedUser)
        logger.debug(`Clerk: 用户信息缓存命中 ${clerkUserId}`)
        return user
      }
      metrics.userCacheMisses++
    }

    const client = ensureClerkClient()
    const user = await client.users.getUser(clerkUserId)

    const userInfo = {
      id: user.id,
      email: user.emailAddresses?.[0]?.emailAddress,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      imageUrl: user.imageUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastSignInAt: user.lastSignInAt,
      externalAccounts:
        user.externalAccounts?.map((account) => ({
          provider: account.provider,
          externalId: account.externalId,
          emailAddress: account.emailAddress,
          username: account.username
        })) || [],
      // 添加安全标识
      hasPassword: !!user.passwordEnabled,
      twoFactorEnabled: !!user.twoFactorEnabled,
      emailVerified: user.emailAddresses?.[0]?.verification?.status === 'verified'
    }

    // 缓存用户信息
    if (useCache) {
      const cacheKey = `clerk_user_info:${clerkUserId}`
      const redisClient = redis.getClient()
      await redisClient.setex(cacheKey, CACHE_CONFIG.USER_INFO_TTL, JSON.stringify(userInfo))
    }

    const duration = Date.now() - startTime
    logger.debug(`Clerk: 获取用户信息成功 ${clerkUserId} (${duration}ms)`)

    return userInfo
  } catch (error) {
    metrics.errors++
    const duration = Date.now() - startTime
    const errorType = classifyError(error)

    logger.error(`Clerk: 获取用户信息失败 ${clerkUserId} (${duration}ms):`, {
      type: errorType,
      message: error.message,
      code: error.code
    })

    // 根据错误类型决定是否抛出异常
    if (errorType === ErrorTypes.RATE_LIMIT_ERROR) {
      throw new Error('Clerk API 请求频率过高，请稍后重试')
    } else if (errorType === ErrorTypes.NETWORK_ERROR) {
      throw new Error('网络连接异常，无法获取用户信息')
    } else {
      throw new Error('无法获取 Clerk 用户信息')
    }
  }
}

// 生成本地用户名（基于邮箱）
function generateUsernameFromEmail(email) {
  if (!email) {
    return null
  }

  // 从邮箱地址生成用户名
  const localPart = email.split('@')[0]

  // 清理特殊字符，只保留字母、数字和下划线
  const cleanUsername = localPart.replace(/[^a-zA-Z0-9_]/g, '_')

  // 确保用户名不为空且不超过32个字符
  return cleanUsername.substring(0, 32) || 'user'
}

// 生成唯一用户名
async function generateUniqueUsername(baseUsername) {
  let username = baseUsername
  let counter = 1

  // 检查用户名是否已存在，如果存在则添加数字后缀
  while (await userService.getUserByUsername(username)) {
    username = `${baseUsername}_${counter}`
    counter++

    // 防止无限循环
    if (counter > 1000) {
      throw new Error('无法生成唯一用户名')
    }
  }

  return username
}

// 认证或创建 Clerk 用户
async function authenticateOrCreateUser(clerkUserData) {
  try {
    const { clerkUserId, email, firstName, lastName, fullName, avatar, provider } = clerkUserData

    logger.info(`Clerk: 尝试认证用户 ${email} (ID: ${clerkUserId})`)

    // 首先检查是否已存在 Clerk 用户
    let user = await userService.getUserByClerkId(clerkUserId)

    if (user) {
      // 用户已存在，更新最后登录时间和基本信息
      logger.info(`Clerk: 用户已存在，更新信息 ${user.email}`)

      const updateData = {
        lastLoginAt: new Date(),
        firstName: firstName || user.firstName,
        lastName: lastName || user.lastName,
        avatar: avatar || user.avatar
      }

      // 如果显示名称改变了，也更新
      const newDisplayName = fullName || `${firstName || ''} ${lastName || ''}`.trim()
      if (newDisplayName && newDisplayName !== user.displayName) {
        updateData.displayName = newDisplayName
      }

      user = await userService.updateUser(user.id, updateData)
    } else {
      // 检查是否有相同邮箱的用户（可能是通过其他方式创建的）
      const existingEmailUser = await userService.getUserByEmail(email)

      if (existingEmailUser) {
        // 如果用户通过其他方式（LDAP）已存在，不允许关联 Clerk
        logger.warn(`Clerk: 邮箱 ${email} 已被其他认证方式使用`)
        return {
          success: false,
          message: '该邮箱已被其他账户使用，无法使用社交登录'
        }
      }

      // 创建新的 Clerk 用户
      logger.info(`Clerk: 创建新用户 ${email}`)

      // 生成用户名
      const baseUsername = generateUsernameFromEmail(email)
      const uniqueUsername = await generateUniqueUsername(baseUsername)

      const newUserData = {
        username: uniqueUsername,
        email: email.toLowerCase(),
        firstName: firstName || '',
        lastName: lastName || '',
        displayName: fullName || `${firstName || ''} ${lastName || ''}`.trim() || email,
        avatar: avatar || null,
        role: 'user', // 默认角色
        provider: 'clerk',
        clerkUserId,
        lastLoginAt: new Date(),
        isActive: true
      }

      user = await userService.createClerkUser(newUserData)
    }

    // 生成会话 token
    const sessionToken = generateSessionToken(user)

    // 将会话信息存储到 Redis
    await storeUserSession(user.id, sessionToken)

    logger.info(`Clerk: 用户认证成功 ${user.email} (${provider})`)

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        role: user.role,
        provider: user.provider,
        clerkUserId: user.clerkUserId,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      },
      sessionToken
    }
  } catch (error) {
    logger.error('Clerk: 认证或创建用户失败:', error)

    return {
      success: false,
      message: error.message || '用户认证失败'
    }
  }
}

// 同步用户数据
async function syncUserData(clerkUserId, updateData) {
  try {
    logger.info(`Clerk: 同步用户数据 (ID: ${clerkUserId})`)

    // 获取现有用户
    const user = await userService.getUserByClerkId(clerkUserId)

    if (!user) {
      return {
        success: false,
        message: '用户不存在，无法同步数据'
      }
    }

    // 准备更新数据
    const syncData = {
      firstName: updateData.firstName || user.firstName,
      lastName: updateData.lastName || user.lastName,
      avatar: updateData.avatar || user.avatar,
      updatedAt: new Date()
    }

    // 如果显示名称改变了，也更新
    const newDisplayName =
      updateData.fullName || `${updateData.firstName || ''} ${updateData.lastName || ''}`.trim()
    if (newDisplayName && newDisplayName !== user.displayName) {
      syncData.displayName = newDisplayName
    }

    // 更新用户信息
    const updatedUser = await userService.updateUser(user.id, syncData)

    // 生成新的会话 token
    const sessionToken = generateSessionToken(updatedUser)

    // 更新会话信息
    await storeUserSession(updatedUser.id, sessionToken)

    logger.info(`Clerk: 用户数据同步成功 ${updatedUser.email}`)

    return {
      success: true,
      user: updatedUser,
      sessionToken
    }
  } catch (error) {
    logger.error('Clerk: 同步用户数据失败:', error)

    return {
      success: false,
      message: error.message || '数据同步失败'
    }
  }
}

// 获取 Clerk 用户资料
async function getClerkUserProfile(clerkUserId) {
  if (!clerkUserId) {
    return null
  }

  try {
    const clerkUser = await getClerkUser(clerkUserId)

    return {
      clerkId: clerkUser.id,
      createdAt: clerkUser.createdAt,
      updatedAt: clerkUser.updatedAt,
      lastSignInAt: clerkUser.lastSignInAt,
      externalAccounts:
        clerkUser.externalAccounts?.map((account) => ({
          provider: account.provider,
          externalId: account.externalId,
          emailAddress: account.emailAddress
        })) || []
    }
  } catch (error) {
    logger.warn(`Clerk: 无法获取用户资料 (ID: ${clerkUserId}):`, error.message)
    return null
  }
}

// 生成会话 token
function generateSessionToken(user) {
  try {
    const payload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      provider: user.provider,
      clerkUserId: user.clerkUserId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60 // 24小时过期
    }

    const jwtSecret = config.auth?.jwtSecret || process.env.JWT_SECRET
    if (!jwtSecret) {
      throw new Error('JWT密钥未配置')
    }

    return jwt.sign(payload, jwtSecret)
  } catch (error) {
    logger.error('Clerk: 生成会话 token 失败:', error)
    throw error
  }
}

// 存储用户会话
async function storeUserSession(userId, sessionToken) {
  try {
    const redisClient = redis.getClient()

    // 会话信息
    const sessionData = {
      userId,
      provider: 'clerk',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24小时
    }

    // 存储会话（24小时过期）
    await redisClient.setex(
      `user_session:${sessionToken}`,
      24 * 60 * 60,
      JSON.stringify(sessionData)
    )

    // 存储用户的活跃会话列表（方便管理）
    await redisClient.sadd(`user_sessions:${userId}`, sessionToken)
    await redisClient.expire(`user_sessions:${userId}`, 24 * 60 * 60)

    logger.debug(`Clerk: 会话已存储 (User: ${userId})`)
  } catch (error) {
    logger.error('Clerk: 存储用户会话失败:', error)
    // 不抛出错误，避免影响登录流程
  }
}

// 验证用户会话
async function validateUserSession(sessionToken) {
  try {
    const redisClient = redis.getClient()

    const sessionData = await redisClient.get(`user_session:${sessionToken}`)

    if (!sessionData) {
      return { valid: false, reason: 'Session not found' }
    }

    const session = JSON.parse(sessionData)

    // 检查过期时间
    if (new Date(session.expiresAt) < new Date()) {
      await redisClient.del(`user_session:${sessionToken}`)
      return { valid: false, reason: 'Session expired' }
    }

    return {
      valid: true,
      session: {
        userId: session.userId,
        provider: session.provider,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt
      }
    }
  } catch (error) {
    logger.error('Clerk: 验证用户会话失败:', error)
    return { valid: false, reason: 'Validation error' }
  }
}

// 撤销用户会话
async function revokeUserSession(sessionToken) {
  try {
    const redisClient = redis.getClient()

    // 获取会话数据以获取用户ID
    const sessionData = await redisClient.get(`user_session:${sessionToken}`)

    if (sessionData) {
      const session = JSON.parse(sessionData)

      // 从用户会话列表中移除
      await redisClient.srem(`user_sessions:${session.userId}`, sessionToken)
    }

    // 删除会话
    await redisClient.del(`user_session:${sessionToken}`)

    logger.info(`Clerk: 会话已撤销 ${sessionToken.substring(0, 20)}...`)

    return { success: true }
  } catch (error) {
    logger.error('Clerk: 撤销用户会话失败:', error)
    return { success: false, error: error.message }
  }
}

// 检查 Clerk 服务状态
function getServiceStatus() {
  return {
    available: !!clerkClient,
    configured: !!(CLERK_SECRET_KEY && CLERK_PUBLISHABLE_KEY),
    secretKeySet: !!CLERK_SECRET_KEY,
    publishableKeySet: !!CLERK_PUBLISHABLE_KEY
  }
}

// 初始化服务
function initializeService() {
  const status = getServiceStatus()

  if (status.configured) {
    initializeClerkClient()
    logger.info('Clerk Service: 服务已初始化')
  } else {
    logger.warn('Clerk Service: 配置不完整，服务不可用')
    logger.warn('Clerk Service: 请设置 CLERK_SECRET_KEY 和 CLERK_PUBLISHABLE_KEY 环境变量')
  }

  return status
}

module.exports = {
  // 初始化和状态
  initializeService,
  getServiceStatus,
  healthCheck,

  // Token 验证
  verifyClerkToken,

  // 用户管理
  authenticateOrCreateUser,
  syncUserData,
  getClerkUser,
  getClerkUserProfile,

  // 会话管理
  validateUserSession,
  revokeUserSession,

  // 性能和监控
  getMetrics,
  resetMetrics,
  cleanupExpiredCache,
  warmupCache,

  // 工具函数
  withRetry,
  classifyError,

  // 内部工具函数（供测试使用）
  generateSessionToken,
  storeUserSession
}

// ========== 新增工具函数 ==========

// 错误分类器
function classifyError(error) {
  const message = error.message?.toLowerCase() || ''
  const code = error.code?.toLowerCase() || ''

  if (message.includes('rate limit') || code.includes('rate_limit')) {
    return ErrorTypes.RATE_LIMIT_ERROR
  } else if (
    message.includes('network') ||
    message.includes('timeout') ||
    code.includes('network') ||
    code.includes('timeout')
  ) {
    return ErrorTypes.NETWORK_ERROR
  } else if (
    message.includes('token') ||
    message.includes('jwt') ||
    code.includes('token') ||
    code.includes('unauthorized')
  ) {
    return ErrorTypes.TOKEN_VALIDATION_ERROR
  } else if (message.includes('configuration') || message.includes('key')) {
    return ErrorTypes.CONFIGURATION_ERROR
  } else if (message.includes('user') && message.includes('create')) {
    return ErrorTypes.USER_CREATION_ERROR
  } else if (message.includes('session')) {
    return ErrorTypes.SESSION_ERROR
  } else {
    return ErrorTypes.CLERK_API_ERROR
  }
}

// 重试机制包装器
async function withRetry(operation, maxRetries = 3, delay = 1000) {
  let lastError = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      const errorType = classifyError(error)

      // 某些错误类型不值得重试
      if (
        errorType === ErrorTypes.CONFIGURATION_ERROR ||
        errorType === ErrorTypes.TOKEN_VALIDATION_ERROR ||
        errorType === ErrorTypes.USER_CREATION_ERROR
      ) {
        throw error
      }

      if (attempt < maxRetries) {
        const backoffDelay = delay * Math.pow(2, attempt - 1)
        logger.warn(
          `Clerk: 操作失败，${backoffDelay}ms后重试 (${attempt}/${maxRetries}):`,
          error.message
        )
        await new Promise((resolve) => setTimeout(resolve, backoffDelay))
      }
    }
  }

  throw lastError
}

// 批量清理过期缓存
async function cleanupExpiredCache() {
  try {
    const redisClient = redis.getClient()
    const patterns = ['clerk_user_info:*', 'clerk_token_verification:*', 'user_session:*']

    let totalCleaned = 0

    for (const pattern of patterns) {
      const keys = await redisClient.keys(pattern)
      if (keys.length > 0) {
        // 批量检查TTL，删除已过期的key
        const pipeline = redisClient.pipeline()
        for (const key of keys) {
          pipeline.ttl(key)
        }
        const ttls = await pipeline.exec()

        const expiredKeys = keys.filter((key, index) => ttls[index][1] === -1)
        if (expiredKeys.length > 0) {
          await redisClient.del(...expiredKeys)
          totalCleaned += expiredKeys.length
        }
      }
    }

    if (totalCleaned > 0) {
      logger.info(`Clerk: 清理了 ${totalCleaned} 个过期缓存`)
    }

    return totalCleaned
  } catch (error) {
    logger.error('Clerk: 缓存清理失败:', error)
    return 0
  }
}

// 获取性能指标
function getMetrics() {
  const uptime = Date.now() - metrics.lastReset
  const cacheHitRate =
    metrics.userCacheHits + metrics.userCacheMisses > 0
      ? ((metrics.userCacheHits / (metrics.userCacheHits + metrics.userCacheMisses)) * 100).toFixed(
          2
        )
      : '0.00'

  return {
    ...metrics,
    cacheHitRate: `${cacheHitRate}%`,
    uptimeHours: (uptime / (1000 * 60 * 60)).toFixed(2),
    errorRate:
      metrics.tokenVerifications > 0
        ? `${((metrics.errors / metrics.tokenVerifications) * 100).toFixed(2)}%`
        : '0.00%'
  }
}

// 重置性能指标
function resetMetrics() {
  Object.keys(metrics).forEach((key) => {
    if (key !== 'lastReset') {
      metrics[key] = 0
    }
  })
  metrics.lastReset = Date.now()
  logger.info('Clerk: 性能指标已重置')
}

// 缓存预热
async function warmupCache(clerkUserIds) {
  if (!Array.isArray(clerkUserIds) || clerkUserIds.length === 0) {
    return { success: 0, errors: 0 }
  }

  logger.info(`Clerk: 开始缓存预热，目标用户数: ${clerkUserIds.length}`)

  let success = 0
  let errors = 0

  const batchSize = 10 // 批量处理，避免过载
  for (let i = 0; i < clerkUserIds.length; i += batchSize) {
    const batch = clerkUserIds.slice(i, i + batchSize)

    await Promise.all(
      batch.map(async (userId) => {
        try {
          await getClerkUser(userId, true) // 强制缓存
          success++
        } catch (error) {
          logger.warn(`Clerk: 预热缓存失败 ${userId}:`, error.message)
          errors++
        }
      })
    )

    // 批次间短暂延迟，避免API限流
    if (i + batchSize < clerkUserIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  logger.info(`Clerk: 缓存预热完成，成功: ${success}, 失败: ${errors}`)
  return { success, errors }
}

// 健康检查
async function healthCheck() {
  const startTime = Date.now()
  const status = {
    healthy: false,
    timestamp: new Date().toISOString(),
    checks: {}
  }

  try {
    // 检查 Clerk 客户端
    status.checks.clerkClient = !!clerkClient

    // 检查配置
    status.checks.configuration = !!(CLERK_SECRET_KEY && CLERK_PUBLISHABLE_KEY)

    // 检查 Redis 连接
    const redisClient = redis.getClient()
    await redisClient.ping()
    status.checks.redis = true

    // 检查 Clerk API 连通性（如果配置正确）
    if (status.checks.configuration && status.checks.clerkClient) {
      try {
        const client = ensureClerkClient()
        // 尝试获取一个不存在的用户，检查API是否响应
        await client.users.getUser('health_check_dummy_id')
      } catch (error) {
        // 预期会失败，只要不是网络错误就OK
        status.checks.clerkApi =
          !error.message.includes('network') && !error.message.includes('timeout')
      }
    } else {
      status.checks.clerkApi = false
    }

    status.healthy = Object.values(status.checks).every((check) => check === true)
    status.responseTime = Date.now() - startTime

    return status
  } catch (error) {
    status.checks.error = error.message
    status.responseTime = Date.now() - startTime
    return status
  }
}

// ========== 定时任务 ==========

// 启动后台清理任务
function startBackgroundTasks() {
  // 缓存清理任务
  setInterval(async () => {
    try {
      await cleanupExpiredCache()
    } catch (error) {
      logger.error('Clerk: 后台缓存清理任务失败:', error)
    }
  }, CACHE_CONFIG.SESSION_CLEANUP_INTERVAL * 1000)

  // 指标重置任务
  setInterval(() => {
    try {
      resetMetrics()
    } catch (error) {
      logger.error('Clerk: 后台指标重置任务失败:', error)
    }
  }, CACHE_CONFIG.METRICS_RESET_INTERVAL * 1000)

  logger.info('Clerk: 后台任务已启动')
}

// 服务启动时自动初始化
if (require.main !== module) {
  // 延迟初始化，确保其他服务已加载
  setTimeout(() => {
    initializeService()
    startBackgroundTasks()
  }, 1000)
}
