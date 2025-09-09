/**
 * Clerk 用户认证服务
 * 处理 Clerk OAuth 用户的认证、创建和数据同步
 * 与现有的 LDAP 用户系统并存，不冲突
 */

const { createClerkClient } = require('@clerk/clerk-sdk-node')
const jwt = require('jsonwebtoken')
const userService = require('./userService')
const logger = require('../utils/logger')
const redis = require('../models/redis')
const config = require('../../config/config')

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

// 验证 Clerk JWT Token
async function verifyClerkToken(token) {
  try {
    const client = ensureClerkClient()

    // 使用 Clerk SDK 验证 JWT
    const payload = await client.verifyToken(token)

    return {
      valid: true,
      userId: payload.sub,
      sessionId: payload.sid,
      payload
    }
  } catch (error) {
    logger.warn('Clerk: Token 验证失败:', error.message)

    return {
      valid: false,
      error: error.message
    }
  }
}

// 从 Clerk 获取用户信息
async function getClerkUser(clerkUserId) {
  try {
    const client = ensureClerkClient()

    const user = await client.users.getUser(clerkUserId)

    return {
      id: user.id,
      email: user.emailAddresses?.[0]?.emailAddress,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastSignInAt: user.lastSignInAt,
      externalAccounts: user.externalAccounts
    }
  } catch (error) {
    logger.error('Clerk: 获取用户信息失败:', error)
    throw new Error('无法获取 Clerk 用户信息')
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

  // 内部工具函数（供测试使用）
  generateSessionToken,
  storeUserSession
}

// 服务启动时自动初始化
if (require.main !== module) {
  // 延迟初始化，确保其他服务已加载
  setTimeout(() => {
    initializeService()
  }, 1000)
}
