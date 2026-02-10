/**
 * @file FHIR查询参数DTO
 * @description FHIR标准查询参数的验证DTO
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { IsEnum, IsOptional, IsString, IsInt } from "class-validator";
import { Type } from "class-transformer";
import { FhirResourceType } from "./fhir-resources.dto";

/**
 * FHIR资源查询参数
 */
export class FhirResourceQueryDto {
  @IsOptional()
  @IsString()
  /** 资源类型 */
  _id?: string;

  @IsOptional()
  @IsString()
  /** 资源ID列表（逗号分隔） */
  _idList?: string;

  @IsOptional()
  @IsString()
  /** 资源的最后更新时间（格式：ge2024-01-01） */
  _lastUpdated?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  /** 分页：每页数量 */
  _count?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  /** 分页：偏移量 */
  _offset?: number;

  @IsOptional()
  @IsString()
  /** 分页：从特定元素开始 */
  _pageToken?: string;

  @IsOptional()
  @IsString()
  /** 资源格式（json或xml） */
  _format?: string;

  @IsOptional()
  @IsEnum(["summary", "text", "data", "count", "false"])
  /** 返回内容摘要级别 */
  _summary?: "summary" | "text" | "data" | "count" | "false";
}

/**
 * FHIR Patient资源查询参数
 */
export class FhirPatientQueryDto extends FhirResourceQueryDto {
  @IsOptional()
  @IsString()
  /** 患者标识符 */
  identifier?: string;

  @IsOptional()
  @IsString()
  /** 手机号 */
  phone?: string;

  @IsOptional()
  @IsString()
  /** 邮箱 */
  email?: string;
}

/**
 * FHIR Observation资源查询参数
 */
export class FhirObservationQueryDto extends FhirResourceQueryDto {
  @IsOptional()
  @IsString()
  /** 患者引用（Patient/{id}） */
  subject?: string;

  @IsOptional()
  @IsString()
  /** 观察类型代码 */
  code?: string;

  @IsOptional()
  @IsString()
  /** 观察日期（格式：ge2024-01-01） */
  date?: string;

  @IsOptional()
  @IsString()
  /** 就诊引用（Encounter/{id}） */
  encounter?: string;
}

/**
 * FHIR Condition资源查询参数
 */
export class FhirConditionQueryDto extends FhirResourceQueryDto {
  @IsOptional()
  @IsString()
  /** 患者引用（Patient/{id}） */
  subject?: string;

  @IsOptional()
  @IsString()
  /** 临床状态 */
  clinicalStatus?: string;
}

/**
 * FHIR DocumentReference资源查询参数
 */
export class FhirDocumentReferenceQueryDto extends FhirResourceQueryDto {
  @IsOptional()
  @IsString()
  /** 患者引用（Patient/{id}） */
  subject?: string;

  @IsOptional()
  @IsString()
  /** 文档类型 */
  type?: string;
}

/**
 * FHIR Encounter资源查询参数
 */
export class FhirEncounterQueryDto extends FhirResourceQueryDto {
  @IsOptional()
  @IsString()
  /** 患者引用（Patient/{id}） */
  subject?: string;

  @IsOptional()
  @IsString()
  /** 就诊状态 */
  status?: string;

  @IsOptional()
  @IsString()
  /** 就诊日期（格式：ge2024-01-01） */
  date?: string;
}
