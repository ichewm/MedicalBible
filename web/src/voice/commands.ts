/**
 * @file 语音命令定义
 * @description 定义语音命令模式和处理器
 */

/**
 * 语音命令接口
 */
export interface VoiceCommand {
  /** 匹配模式（正则表达式） */
  pattern: RegExp
  /** 动作类型标识 */
  action: string
  /** 命令描述（用于帮助和调试） */
  description: string
  /** 是否为临时命令（只执行一次） */
  once?: boolean
}

/**
 * 导航命令
 * 用于页面跳转
 */
export const navigationCommands: VoiceCommand[] = [
  {
    pattern: /^(去|跳转|打开)?(首页|主页)$/,
    action: 'navigate-home',
    description: '跳转到首页：说"首页"、"去首页"、"打开主页"',
  },
  {
    pattern: /^(去|跳转|打开)?题库$/,
    action: 'navigate-questions',
    description: '跳转到题库：说"题库"、"去题库"、"打开题库"',
  },
  {
    pattern: /^(去|跳转|打开)?讲义$/,
    action: 'navigate-lectures',
    description: '跳转到讲义：说"讲义"、"去讲义"、"打开讲义"',
  },
  {
    pattern: /^(去|跳转|打开)?(错题本|错题)$/,
    action: 'navigate-wrong',
    description: '跳转到错题本：说"错题本"、"去错题本"',
  },
  {
    pattern: /^(去|跳转|打开)?(考试记录|历史记录)$/,
    action: 'navigate-history',
    description: '跳转到考试记录：说"考试记录"、"查看历史"',
  },
  {
    pattern: /^(去|跳转|打开)?(个人中心|我的|设置)$/,
    action: 'navigate-profile',
    description: '跳转到个人中心：说"个人中心"、"我的"、"设置"',
  },
  {
    pattern: /^(去|跳转|打开)?订阅$/,
    action: 'navigate-subscription',
    description: '跳转到订阅页面：说"订阅"',
  },
]

/**
 * 答题命令
 * 用于答题页面
 */
export const questionCommands: VoiceCommand[] = [
  {
    pattern: /^(选择|选)([A-D])(选项|号?)?$/,
    action: 'select-answer',
    description: '选择答案：说"选择A"、"选B"、"选择C选项"',
  },
  {
    pattern: /^(下一题|继续|下一个)$/,
    action: 'next-question',
    description: '下一题：说"下一题"、"继续"',
  },
  {
    pattern: /^(上一题|返回|上一个)$/,
    action: 'prev-question',
    description: '上一题：说"上一题"、"返回"',
  },
  {
    pattern: /^(标记|收藏|加星)$/,
    action: 'mark-question',
    description: '标记题目：说"标记"、"收藏"',
  },
  {
    pattern: /^(取消标记|取消收藏|去星)$/,
    action: 'unmark-question',
    description: '取消标记：说"取消标记"、"取消收藏"',
  },
  {
    pattern: /^(提交|交卷|完成)$/,
    action: 'submit-exam',
    description: '提交试卷：说"提交"、"交卷"',
  },
]

/**
 * 讲义阅读命令
 * 用于讲义阅读页面
 */
export const lectureCommands: VoiceCommand[] = [
  {
    pattern: /^(下一页|向下|继续)$/,
    action: 'next-page',
    description: '下一页：说"下一页"、"向下"',
  },
  {
    pattern: /^(上一页|向上|返回)$/,
    action: 'prev-page',
    description: '上一页：说"上一页"、"向上"',
  },
  {
    pattern: /^(放大|变大|zoom in)$/,
    action: 'zoom-in',
    description: '放大：说"放大"',
  },
  {
    pattern: /^(缩小|变小|zoom out)$/,
    action: 'zoom-out',
    description: '缩小：说"缩小"',
  },
  {
    pattern: /^(重置|恢复|原始大小)$/,
    action: 'zoom-reset',
    description: '重置缩放：说"重置"',
  },
]

/**
 * 通用控制命令
 */
export const controlCommands: VoiceCommand[] = [
  {
    pattern: /^(返回|后退|back)$/,
    action: 'go-back',
    description: '返回上一页：说"返回"',
  },
  {
    pattern: /^(刷新|reload)$/,
    action: 'reload',
    description: '刷新页面：说"刷新"',
  },
  {
    pattern: /^(搜索|查找|search)(.*)$/,
    action: 'search',
    description: '搜索：说"搜索 XXX"',
  },
]

/**
 * 获取所有命令
 */
export const getAllCommands = (): VoiceCommand[] => {
  return [
    ...navigationCommands,
    ...questionCommands,
    ...lectureCommands,
    ...controlCommands,
  ]
}

/**
 * 根据文本匹配命令
 * @param transcript 语音识别文本
 * @param commands 可用命令列表
 * @returns 匹配的命令和匹配结果
 */
export const matchCommand = (
  transcript: string,
  commands: VoiceCommand[] = getAllCommands()
): { command: VoiceCommand | null; matches: RegExpMatchArray | null } => {
  const trimmedText = transcript.trim()

  for (const command of commands) {
    const matches = trimmedText.match(command.pattern)
    if (matches) {
      return { command, matches }
    }
  }

  return { command: null, matches: null }
}

/**
 * 获取命令的帮助文本
 */
export const getCommandHelp = (commands: VoiceCommand[] = getAllCommands()): string => {
  const grouped = {
    navigation: commands.filter(c => c.action.startsWith('navigate')),
    question: commands.filter(c => c.action.includes('question') || c.action.includes('answer') || c.action.includes('exam')),
    lecture: commands.filter(c => c.action.includes('page') || c.action.includes('zoom')),
    control: commands.filter(c => ['go-back', 'reload', 'search'].includes(c.action)),
  }

  let help = '语音命令帮助：\n\n'

  if (grouped.navigation.length > 0) {
    help += '【导航命令】\n'
    grouped.navigation.forEach(c => {
      help += `  ${c.description}\n`
    })
    help += '\n'
  }

  if (grouped.question.length > 0) {
    help += '【答题命令】\n'
    grouped.question.forEach(c => {
      help += `  ${c.description}\n`
    })
    help += '\n'
  }

  if (grouped.lecture.length > 0) {
    help += '【讲义命令】\n'
    grouped.lecture.forEach(c => {
      help += `  ${c.description}\n`
    })
    help += '\n'
  }

  if (grouped.control.length > 0) {
    help += '【通用命令】\n'
    grouped.control.forEach(c => {
      help += `  ${c.description}\n`
    })
  }

  return help
}
