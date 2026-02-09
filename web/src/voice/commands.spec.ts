/**
 * @file 语音命令单元测试
 */

import { describe, it, expect } from 'vitest'
import {
  navigationCommands,
  questionCommands,
  lectureCommands,
  controlCommands,
  getAllCommands,
  matchCommand,
  getCommandHelp,
} from './commands'

describe('Voice Commands - 命令匹配', () => {
  describe('导航命令', () => {
    it('应该匹配"首页"', () => {
      const result = matchCommand('首页', navigationCommands)
      expect(result.command).toBeTruthy()
      expect(result.command?.action).toBe('navigate-home')
    })

    it('应该匹配"去题库"', () => {
      const result = matchCommand('去题库', navigationCommands)
      expect(result.command).toBeTruthy()
      expect(result.command?.action).toBe('navigate-questions')
    })

    it('应该匹配"打开讲义"', () => {
      const result = matchCommand('打开讲义', navigationCommands)
      expect(result.command).toBeTruthy()
      expect(result.command?.action).toBe('navigate-lectures')
    })

    it('应该匹配"错题本"', () => {
      const result = matchCommand('错题本', navigationCommands)
      expect(result.command).toBeTruthy()
      expect(result.command?.action).toBe('navigate-wrong')
    })

    it('应该匹配"考试记录"', () => {
      const result = matchCommand('考试记录', navigationCommands)
      expect(result.command).toBeTruthy()
      expect(result.command?.action).toBe('navigate-history')
    })

    it('应该匹配"个人中心"', () => {
      const result = matchCommand('个人中心', navigationCommands)
      expect(result.command).toBeTruthy()
      expect(result.command?.action).toBe('navigate-profile')
    })

    it('应该匹配"订阅"', () => {
      const result = matchCommand('订阅', navigationCommands)
      expect(result.command).toBeTruthy()
      expect(result.command?.action).toBe('navigate-subscription')
    })
  })

  describe('答题命令', () => {
    it('应该匹配"选择A"', () => {
      const result = matchCommand('选择A', questionCommands)
      expect(result.command).toBeTruthy()
      expect(result.command?.action).toBe('select-answer')
      expect(result.matches?.[2]).toBe('A')
    })

    it('应该匹配"选B"', () => {
      const result = matchCommand('选B', questionCommands)
      expect(result.command).toBeTruthy()
      expect(result.command?.action).toBe('select-answer')
      expect(result.matches?.[2]).toBe('B')
    })

    it('应该匹配"选择C选项"', () => {
      const result = matchCommand('选择C选项', questionCommands)
      expect(result.command).toBeTruthy()
      expect(result.command?.action).toBe('select-answer')
      expect(result.matches?.[2]).toBe('C')
    })

    it('应该匹配"下一题"', () => {
      const result = matchCommand('下一题', questionCommands)
      expect(result.command).toBeTruthy()
      expect(result.command?.action).toBe('next-question')
    })

    it('应该匹配"上一题"', () => {
      const result = matchCommand('上一题', questionCommands)
      expect(result.command).toBeTruthy()
      expect(result.command?.action).toBe('prev-question')
    })

    it('应该匹配"标记"', () => {
      const result = matchCommand('标记', questionCommands)
      expect(result.command).toBeTruthy()
      expect(result.command?.action).toBe('mark-question')
    })

    it('应该匹配"收藏"', () => {
      const result = matchCommand('收藏', questionCommands)
      expect(result.command).toBeTruthy()
      expect(result.command?.action).toBe('mark-question')
    })

    it('应该匹配"交卷"', () => {
      const result = matchCommand('交卷', questionCommands)
      expect(result.command).toBeTruthy()
      expect(result.command?.action).toBe('submit-exam')
    })
  })

  describe('讲义命令', () => {
    it('应该匹配"下一页"', () => {
      const result = matchCommand('下一页', lectureCommands)
      expect(result.command).toBeTruthy()
      expect(result.command?.action).toBe('next-page')
    })

    it('应该匹配"放大"', () => {
      const result = matchCommand('放大', lectureCommands)
      expect(result.command).toBeTruthy()
      expect(result.command?.action).toBe('zoom-in')
    })

    it('应该匹配"缩小"', () => {
      const result = matchCommand('缩小', lectureCommands)
      expect(result.command).toBeTruthy()
      expect(result.command?.action).toBe('zoom-out')
    })

    it('应该匹配"重置"', () => {
      const result = matchCommand('重置', lectureCommands)
      expect(result.command).toBeTruthy()
      expect(result.command?.action).toBe('zoom-reset')
    })
  })

  describe('控制命令', () => {
    it('应该匹配"返回"', () => {
      const result = matchCommand('返回', controlCommands)
      expect(result.command).toBeTruthy()
      expect(result.command?.action).toBe('go-back')
    })

    it('应该匹配"刷新"', () => {
      const result = matchCommand('刷新', controlCommands)
      expect(result.command).toBeTruthy()
      expect(result.command?.action).toBe('reload')
    })

    it('应该匹配"搜索 XXX"', () => {
      const result = matchCommand('搜索 心理学', controlCommands)
      expect(result.command).toBeTruthy()
      expect(result.command?.action).toBe('search')
      expect(result.matches?.[2]).toBe(' 心理学')
    })
  })

  describe('无效命令', () => {
    it('不应该匹配无效文本', () => {
      const result = matchCommand('这是一段无关的文本', navigationCommands)
      expect(result.command).toBeNull()
    })

    it('应该忽略空格', () => {
      const result = matchCommand('  首页  ', navigationCommands)
      expect(result.command).toBeTruthy()
      expect(result.command?.action).toBe('navigate-home')
    })

    it('不应该匹配空字符串', () => {
      const result = matchCommand('', navigationCommands)
      expect(result.command).toBeNull()
    })
  })
})

describe('Voice Commands - 工具函数', () => {
  describe('getAllCommands', () => {
    it('应该返回所有命令', () => {
      const allCommands = getAllCommands()
      const expectedLength =
        navigationCommands.length +
        questionCommands.length +
        lectureCommands.length +
        controlCommands.length
      expect(allCommands).toHaveLength(expectedLength)
    })

    it('应该包含所有命令类型', () => {
      const allCommands = getAllCommands()
      const actions = allCommands.map((c) => c.action)
      expect(actions).toContain('navigate-home')
      expect(actions).toContain('select-answer')
      expect(actions).toContain('next-page')
      expect(actions).toContain('go-back')
    })
  })

  describe('getCommandHelp', () => {
    it('应该返回帮助文本', () => {
      const help = getCommandHelp()
      expect(typeof help).toBe('string')
      expect(help.length).toBeGreaterThan(0)
    })

    it('应该包含命令分组标题', () => {
      const help = getCommandHelp()
      expect(help).toContain('【导航命令】')
      expect(help).toContain('【答题命令】')
      expect(help).toContain('【讲义命令】')
      expect(help).toContain('【通用命令】')
    })

    it('应该包含命令描述', () => {
      const help = getCommandHelp()
      expect(help).toContain('首页')
      expect(help).toContain('选择答案')
      expect(help).toContain('下一页')
    })
  })
})

describe('Voice Commands - 边界情况', () => {
  it('应该正确处理特殊字符', () => {
    const result = matchCommand('选择A！', questionCommands)
    // "选择A！"不应该匹配，因为模式要求精确匹配
    expect(result.command).toBeNull()
  })

  it('应该正确处理大小写（中文无大小写）', () => {
    const result = matchCommand('选择a', questionCommands)
    expect(result.command).toBeNull()
  })

  it('应该只匹配有效选项（A-D）', () => {
    const resultE = matchCommand('选择E', questionCommands)
    expect(resultE.command).toBeNull()

    const resultA = matchCommand('选择A', questionCommands)
    expect(resultA.command?.action).toBe('select-answer')
  })

  it('应该处理带标点的命令', () => {
    const result = matchCommand('下一题。', questionCommands)
    expect(result.command).toBeNull()
  })
})
