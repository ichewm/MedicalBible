/**
 * @file 敏感词过滤服务
 * @description 提供敏感词检测和过滤功能
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, Logger } from "@nestjs/common";

/**
 * 敏感词过滤服务
 * 使用 DFA (Deterministic Finite Automaton) 算法实现高效匹配
 */
@Injectable()
export class SensitiveWordService {
  private readonly logger = new Logger(SensitiveWordService.name);
  private wordTree: Map<string, any> = new Map();
  private isInitialized = false;

  // 内置敏感词库（基础违禁词）
  private readonly builtInWords: string[] = [
    // 政治敏感词
    "习近平", "江泽民", "胡锦涛", "毛泽东", "邓小平",
    "共产党", "国民党", "民进党", "台独", "藏独", "疆独",
    "六四", "天安门事件", "文化大革命", "法轮功", "全能神",
    // 色情相关
    "色情", "黄色网站", "成人网站", "裸聊", "援交",
    "卖淫", "嫖娼", "一夜情", "约炮",
    // 赌博相关
    "赌博", "博彩", "六合彩", "时时彩", "网络赌场",
    // 诈骗相关
    "诈骗", "骗子", "传销", "返利", "刷单",
    // 侮辱性词汇
    "傻逼", "操你", "去死", "白痴", "智障", "废物",
    "杂种", "狗娘", "婊子", "贱人",
    // 暴力相关
    "杀人", "砍人", "炸弹", "恐怖袭击", "枪支",
    // 毒品相关
    "毒品", "大麻", "可卡因", "冰毒", "海洛因",
  ];

  constructor() {
    this.initialize();
  }

  /**
   * 初始化敏感词树
   */
  private initialize(): void {
    if (this.isInitialized) return;

    for (const word of this.builtInWords) {
      this.addWord(word);
    }

    this.isInitialized = true;
    this.logger.log(`Sensitive word filter initialized with ${this.builtInWords.length} words`);
  }

  /**
   * 添加敏感词到词树
   */
  private addWord(word: string): void {
    if (!word || word.trim().length === 0) return;

    let currentMap = this.wordTree;
    const chars = word.trim().split("");

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      
      if (!currentMap.has(char)) {
        currentMap.set(char, new Map());
      }
      
      currentMap = currentMap.get(char);
      
      if (i === chars.length - 1) {
        currentMap.set("isEnd", true);
      }
    }
  }

  /**
   * 添加自定义敏感词
   * @param words - 敏感词数组
   */
  addWords(words: string[]): void {
    for (const word of words) {
      this.addWord(word);
    }
    this.logger.log(`Added ${words.length} custom sensitive words`);
  }

  /**
   * 检查文本是否包含敏感词
   * @param text - 待检查文本
   * @returns 是否包含敏感词
   */
  containsSensitiveWord(text: string): boolean {
    if (!text || text.trim().length === 0) return false;
    return this.findSensitiveWords(text).length > 0;
  }

  /**
   * 查找文本中的所有敏感词
   * @param text - 待检查文本
   * @returns 找到的敏感词数组
   */
  findSensitiveWords(text: string): string[] {
    if (!text || text.trim().length === 0) return [];

    const result: string[] = [];
    const chars = text.split("");

    for (let i = 0; i < chars.length; i++) {
      let currentMap = this.wordTree;
      let matchLength = 0;
      let tempWord = "";

      for (let j = i; j < chars.length; j++) {
        const char = chars[j];

        if (!currentMap.has(char)) {
          break;
        }

        tempWord += char;
        currentMap = currentMap.get(char);

        if (currentMap.get("isEnd")) {
          matchLength = tempWord.length;
        }
      }

      if (matchLength > 0) {
        const matchedWord = text.substring(i, i + matchLength);
        if (!result.includes(matchedWord)) {
          result.push(matchedWord);
        }
      }
    }

    return result;
  }

  /**
   * 替换文本中的敏感词
   * @param text - 原文本
   * @param replacement - 替换字符，默认为 *
   * @returns 替换后的文本
   */
  replaceSensitiveWords(text: string, replacement: string = "*"): string {
    if (!text || text.trim().length === 0) return text;

    const chars = text.split("");
    const result = [...chars];

    for (let i = 0; i < chars.length; i++) {
      let currentMap = this.wordTree;
      let matchLength = 0;

      for (let j = i; j < chars.length; j++) {
        const char = chars[j];

        if (!currentMap.has(char)) {
          break;
        }

        currentMap = currentMap.get(char);

        if (currentMap.get("isEnd")) {
          matchLength = j - i + 1;
        }
      }

      if (matchLength > 0) {
        for (let k = i; k < i + matchLength; k++) {
          result[k] = replacement;
        }
        i += matchLength - 1;
      }
    }

    return result.join("");
  }

  /**
   * 验证用户昵称
   * @param nickname - 用户昵称
   * @returns 验证结果 { valid: boolean, message?: string, sensitiveWords?: string[] }
   */
  validateNickname(nickname: string): {
    valid: boolean;
    message?: string;
    sensitiveWords?: string[];
  } {
    if (!nickname || nickname.trim().length === 0) {
      return { valid: false, message: "昵称不能为空" };
    }

    if (nickname.length < 2) {
      return { valid: false, message: "昵称长度不能少于2个字符" };
    }

    if (nickname.length > 20) {
      return { valid: false, message: "昵称长度不能超过20个字符" };
    }

    const sensitiveWords = this.findSensitiveWords(nickname);
    if (sensitiveWords.length > 0) {
      return {
        valid: false,
        message: "昵称包含违禁词汇",
        sensitiveWords,
      };
    }

    return { valid: true };
  }
}
