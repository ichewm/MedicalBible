/**
 * @file 考试相关 DTO
 * @description 考试功能的请求和响应参数
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsString,
  IsArray,
  IsInt,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { BatchSubmitAnswerDto } from "./question.dto";

/**
 * 开始考试请求 DTO
 */
export class StartExamDto {
  @ApiProperty({ description: "试卷ID" })
  @IsNotEmpty({ message: "试卷ID不能为空" })
  @Type(() => Number)
  @IsInt({ message: "试卷ID必须是整数" })
  paperId: number;
}

/**
 * 开始考试响应 DTO
 */
export class StartExamResponseDto {
  @ApiProperty({ description: "考试会话ID" })
  sessionId: string;

  @ApiProperty({ description: "试卷ID" })
  paperId: number;

  @ApiProperty({ description: "试卷名称" })
  paperName: string;

  @ApiProperty({ description: "考试时长（分钟）" })
  duration: number;

  @ApiProperty({ description: "题目数量" })
  questionCount: number;

  @ApiProperty({ description: "开始时间" })
  startAt: Date;
}

/**
 * 提交考试 DTO
 */
export class SubmitExamDto {
  @ApiProperty({ description: "答案列表", type: [BatchSubmitAnswerDto] })
  @IsNotEmpty({ message: "答案列表不能为空" })
  @IsArray({ message: "答案列表必须是数组" })
  @ValidateNested({ each: true })
  @Type(() => BatchSubmitAnswerDto)
  answers: BatchSubmitAnswerDto[];
}

/**
 * 考试结果 DTO
 */
export class ExamResultDto {
  @ApiProperty({ description: "会话ID" })
  sessionId: string;

  @ApiProperty({ description: "得分" })
  score: number;

  @ApiProperty({ description: "正确题目数" })
  correctCount: number;

  @ApiProperty({ description: "错误题目数" })
  wrongCount: number;

  @ApiProperty({ description: "总题目数" })
  totalCount: number;

  @ApiProperty({ description: "总分" })
  totalScore: number;

  @ApiProperty({ description: "及格分" })
  passScore: number;

  @ApiProperty({ description: "正确率" })
  correctRate: number;

  @ApiProperty({ description: "用时（分钟）" })
  duration: number;

  @ApiProperty({ description: "提交时间" })
  submittedAt: string;

  @ApiProperty({ description: "排名（可选）" })
  rank?: number;

  @ApiProperty({ description: "答题详情" })
  details: ExamAnswerDetailDto[];

  @ApiPropertyOptional({ description: "错题列表" })
  wrongQuestions?: WrongQuestionDto[];
}

/**
 * 考试答题详情 DTO
 */
export class ExamAnswerDetailDto {
  @ApiProperty({ description: "题目ID" })
  questionId: number;

  @ApiProperty({ description: "用户答案" })
  userAnswer: string;

  @ApiProperty({ description: "正确答案" })
  correctAnswer: string;

  @ApiProperty({ description: "是否正确" })
  isCorrect: boolean;

  @ApiPropertyOptional({ description: "解析" })
  analysis?: string;
}

/**
 * 错题简要信息 DTO
 */
export class WrongQuestionDto {
  @ApiProperty({ description: "题目ID" })
  questionId: number;

  @ApiProperty({ description: "题号" })
  questionNo: number;

  @ApiProperty({ description: "题目内容" })
  content: string;

  @ApiProperty({ description: "用户答案" })
  userAnswer: string;

  @ApiProperty({ description: "正确答案" })
  correctAnswer: string;
}

/**
 * 用户练习统计 DTO
 */
export class UserPracticeStatsDto {
  @ApiProperty({ description: "总答题数" })
  totalAnswered: number;

  @ApiProperty({ description: "正确数" })
  correctCount: number;

  @ApiProperty({ description: "正确率" })
  correctRate: number;

  @ApiProperty({ description: "错题本数量" })
  wrongBookCount: number;

  @ApiProperty({ description: "今日答题数" })
  todayAnswered: number;

  @ApiProperty({ description: "连续学习天数" })
  streakDays: number;
}

/**
 * 考试进度 DTO
 */
export class ExamProgressDto {
  @ApiProperty({ description: "会话ID" })
  sessionId: string;

  @ApiProperty({ description: "试卷ID" })
  paperId: number;

  @ApiProperty({ description: "试卷名称" })
  paperName: string;

  @ApiProperty({ description: "总题目数" })
  totalQuestions: number;

  @ApiProperty({ description: "已答题数" })
  answeredCount: number;

  @ApiProperty({ description: "剩余时间（秒）" })
  remainingTime: number;

  @ApiProperty({ description: "开始时间" })
  startAt: Date;

  @ApiProperty({ description: "状态：0-进行中，1-已提交" })
  status: number;
}

/**
 * 题目列表项 DTO (别名，兼容性)
 */
export class QuestionListItemDto {
  @ApiProperty({ description: "题目ID" })
  id: number;

  @ApiProperty({ description: "题目内容" })
  content: string;

  @ApiProperty({ description: "选项" })
  options: any[];

  @ApiProperty({ description: "题目类型" })
  type: number;

  @ApiProperty({ description: "排序" })
  sortOrder: number;
}

/**
 * 考试记录 DTO
 */
export class ExamHistoryDto {
  @ApiProperty({ description: "会话ID" })
  sessionId: string;

  @ApiProperty({ description: "试卷ID" })
  paperId: number;

  @ApiProperty({ description: "试卷名称" })
  paperName: string;

  @ApiProperty({ description: "得分" })
  score: number;

  @ApiProperty({ description: "总分" })
  totalScore: number;

  @ApiProperty({ description: "用时（秒）" })
  duration: number;

  @ApiProperty({ description: "开始时间" })
  startAt: Date;

  @ApiProperty({ description: "提交时间" })
  submitAt: Date;

  @ApiProperty({ description: "状态：0-进行中，1-已提交" })
  status: number;
}
