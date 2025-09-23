/**
 * 客户端定义配置
 * 定义所有支持的客户端类型和它们的属性
 */

const CLIENT_DEFINITIONS = {
  CLAUDE_CODE: {
    id: 'claude_code',
    name: 'Claude Code',
    displayName: 'Claude Code CLI',
    description: 'Claude Code command-line interface',
    userAgentPattern: /^claude-cli\/[\d.]+([-\w]*)?\s+\(external,\s*cli\)$/i,
    requiredHeaders: ['x-app', 'anthropic-beta', 'anthropic-version'],
    restrictedPaths: ['/api/v1/messages', '/claude/v1/messages'],
    icon: '🤖'
  },

  GEMINI_CLI: {
    id: 'gemini_cli',
    name: 'Gemini CLI',
    displayName: 'Gemini Command Line Tool',
    description: 'Google Gemini API command-line interface',
    userAgentPattern: /^GeminiCLI\/v?[\d.]+/i,
    requiredPaths: ['/gemini'],
    validatePaths: ['generateContent'],
    icon: '💎'
  },

  CODEX_CLI: {
    id: 'codex_cli',
    name: 'Codex CLI',
    displayName: 'Codex Command Line Tool',
    description: 'Cursor/Codex command-line interface',
    userAgentPattern: /^(codex_vscode|codex_cli_rs)\/[\d.]+/i,
    requiredHeaders: ['originator', 'session_id'],
    restrictedPaths: ['/openai', '/azure'],
    icon: '🔷'
  }
}

// 导出客户端ID枚举
const CLIENT_IDS = {
  CLAUDE_CODE: 'claude_code',
  GEMINI_CLI: 'gemini_cli',
  CODEX_CLI: 'codex_cli'
}

// 获取所有客户端定义
function getAllClientDefinitions() {
  return Object.values(CLIENT_DEFINITIONS)
}

// 根据ID获取客户端定义
function getClientDefinitionById(clientId) {
  return Object.values(CLIENT_DEFINITIONS).find((client) => client.id === clientId)
}

// 检查客户端ID是否有效
function isValidClientId(clientId) {
  return Object.values(CLIENT_IDS).includes(clientId)
}

module.exports = {
  CLIENT_DEFINITIONS,
  CLIENT_IDS,
  getAllClientDefinitions,
  getClientDefinitionById,
  isValidClientId
}
