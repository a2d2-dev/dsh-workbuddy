/** Locale-owned strings for the WorkBuddy settings section. */
export const en = {
  nav: 'WorkBuddy', title: 'WorkBuddy', connect: 'Connect WorkBuddy', disconnect: 'Sign out',
  refresh: 'Refresh', checking: 'Checking connection', connected: 'Connected', disconnected: 'Not connected',
  waiting: 'Waiting for browser authorization', open: 'Open sign-in page', models: 'Available models',
  error: 'WorkBuddy request failed', expired: 'Authorization timed out', account: 'Account',
  quota: 'Credits', remaining: 'Remaining', used: 'Used', total: 'Total', unavailable: 'Not provided',
  packages: 'Credit packages', expires: 'Expires', free: 'Free', freeModels: 'Free models',
  search: 'Search models', onlyFree: 'Free only', model: 'Model / ID', billing: 'Credit multiplier',
  context: 'Context', output: 'Max output', capabilities: 'Capabilities', vision: 'Images', reasoning: 'Reasoning',
  text: 'Text', promotionUntil: 'Promotion ends', noModels: 'No matching models', updated: 'Updated',
  website: 'WorkBuddy account', modelList: 'Model catalog',
}
export const zh: Record<keyof typeof en, string> = {
  nav: 'WorkBuddy', title: 'WorkBuddy', connect: '\u767b\u5f55 WorkBuddy', disconnect: '\u9000\u51fa\u767b\u5f55',
  refresh: '\u5237\u65b0', checking: '\u6b63\u5728\u68c0\u67e5\u8fde\u63a5', connected: '\u5df2\u8fde\u63a5', disconnected: '\u5c1a\u672a\u8fde\u63a5',
  waiting: '\u7b49\u5f85\u6d4f\u89c8\u5668\u5b8c\u6210\u6388\u6743', open: '\u6253\u5f00\u767b\u5f55\u9875', models: '\u53ef\u7528\u6a21\u578b',
  error: 'WorkBuddy \u8bf7\u6c42\u5931\u8d25', expired: '\u6388\u6743\u5df2\u8d85\u65f6', account: '\u8d26\u53f7',
  quota: 'Credits 额度', remaining: '剩余额度', used: '已用', total: '总额度', unavailable: '未提供',
  packages: '额度明细', expires: '到期时间', free: '免费', freeModels: '免费模型',
  search: '搜索模型名称或 ID', onlyFree: '仅看免费', model: '模型 / ID', billing: 'Credits 倍率',
  context: '上下文', output: '最大输出', capabilities: '能力', vision: '图像', reasoning: '推理',
  text: '文本', promotionUntil: '活动截止', noModels: '没有匹配的模型', updated: '更新于',
  website: 'WorkBuddy 账户', modelList: '模型清单',
}
export type CopyKey = keyof typeof en
