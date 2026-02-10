/**
 * @file FHIR资源DTO定义
 * @description FHIR R4标准资源类型的TypeScript接口定义
 * @author Medical Bible Team
 * @version 1.0.0
 * @see https://hl7.org/fhir/R4/
 */

/**
 * FHIR资源类型枚举
 */
export enum FhirResourceType {
  PATIENT = "Patient",
  OBSERVATION = "Observation",
  CONDITION = "Condition",
  DOCUMENT_REFERENCE = "DocumentReference",
  ENCOUNTER = "Encounter",
  ORGANIZATION = "Organization",
  COVERAGE = "Coverage",
  BUNDLE = "Bundle",
}

/**
 * FHIR标识符
 */
export interface FhirIdentifier {
  system: string;
  value: string;
}

/**
 * FHIR编码
 */
export interface FhirCoding {
  system?: string;
  code: string;
  display?: string;
}

/**
 * FHIR代码able概念
 */
export interface FhirCodeableConcept {
  coding: FhirCoding[];
  text?: string;
}

/**
 * FHIR参考
 */
export interface FhirReference {
  reference: string;
  display?: string;
}

/**
 * FHIR人名
 */
export interface FhirHumanName {
  use?: string;
  text: string;
}

/**
 * FHIR联系方式
 */
export interface FhirContactPoint {
  system: string;
  value: string;
  use?: string;
}

/**
 * FHIR附件
 */
export interface FhirAttachment {
  contentType?: string;
  url?: string;
  title?: string;
  pages?: number;
}

/**
 * FHR扩展
 */
export interface FhirExtension {
  url: string;
  valueCode?: string;
  valueInteger?: number;
  valueString?: string;
  valueBoolean?: boolean;
  valueDecimal?: number;
  valueDateTime?: string;
  extension?: FhirExtension[];
}

/**
 * FHIR时间段
 */
export interface FhirPeriod {
  start?: string;
  end?: string;
}

/**
 * FHIR Patient资源
 * @see https://hl7.org/fhir/R4/patient.html
 */
export interface FhirPatient {
  resourceType: FhirResourceType.PATIENT;
  id: string;
  identifier: FhirIdentifier[];
  name?: FhirHumanName[];
  telecom?: FhirContactPoint[];
  photo?: FhirAttachment[];
  extension?: FhirExtension[];
}

/**
 * FHIR Observation资源
 * @see https://hl7.org/fhir/R4/observation.html
 */
export interface FhirObservation {
  resourceType: FhirResourceType.OBSERVATION;
  id: string;
  status: string;
  category: FhirCodeableConcept[];
  code: FhirCodeableConcept;
  subject?: FhirReference;
  encounter?: FhirReference;
  effectiveDateTime?: string;
  valueInteger?: number;
  valueBoolean?: boolean;
  interpretation?: FhirCodeableConcept[];
  partOf?: FhirReference[];
  extension?: FhirExtension[];
}

/**
 * FHIR Condition资源
 * @see https://hl7.org/fhir/R4/condition.html
 */
export interface FhirCondition {
  resourceType: FhirResourceType.CONDITION;
  id: string;
  clinicalStatus: FhirCodeableConcept;
  verificationStatus: FhirCodeableConcept;
  category?: FhirCodeableConcept[];
  code: FhirCodeableConcept;
  subject: FhirReference;
  note?: Array<{ text: string }>;
  recordedDate?: string;
  extension?: FhirExtension[];
}

/**
 * FHIR DocumentReference资源
 * @see https://hl7.org/fhir/R4/documentreference.html
 */
export interface FhirDocumentReference {
  resourceType: FhirResourceType.DOCUMENT_REFERENCE;
  id: string;
  status: string;
  type: FhirCodeableConcept;
  subject?: FhirReference;
  content: Array<{ attachment: FhirAttachment }>;
  extension?: FhirExtension[];
}

/**
 * FHIR Encounter资源
 * @see https://hl7.org/fhir/R4/encounter.html
 */
export interface FhirEncounter {
  resourceType: FhirResourceType.ENCOUNTER;
  id: string;
  status: string;
  class: FhirCoding;
  subject: FhirReference;
  period?: FhirPeriod;
  length?: number;
  extension?: FhirExtension[];
}

/**
 * FHIR Organization资源
 * @see https://hl7.org/fhir/R4/organization.html
 */
export interface FhirOrganization {
  resourceType: FhirResourceType.ORGANIZATION;
  id: string;
  name: string;
  alias?: string[];
  telecom?: FhirContactPoint[];
  type?: FhirCodeableConcept[];
}

/**
 * FHIR Coverage资源
 * @see https://hl7.org/fhir/R4/coverage.html
 */
export interface FhirCoverage {
  resourceType: FhirResourceType.COVERAGE;
  id: string;
  status: string;
  type?: FhirCodeableConcept;
  beneficiary: FhirReference;
  period?: FhirPeriod;
  extension?: FhirExtension[];
}

/**
 * FHIR Bundle资源
 * @see https://hl7.org/fhir/R4/bundle.html
 */
export interface FhirBundle {
  resourceType: FhirResourceType.BUNDLE;
  type: string;
  entry: Array<{
    resource: FhirResource;
  }>;
}

/**
 * FHIR资源联合类型
 */
export type FhirResource =
  | FhirPatient
  | FhirObservation
  | FhirCondition
  | FhirDocumentReference
  | FhirEncounter
  | FhirOrganization
  | FhirCoverage
  | FhirBundle;

/**
 * FHIR系统常量
 */
export const FHIR_SYSTEM_URLS = {
  BASE: "https://medicalbible.example.com",
  IDENTIFIER_USER: "https://medicalbible.example.com/identifiers/user",
  IDENTIFIER_PHONE: "https://medicalbible.example.com/identifiers/phone",
  IDENTIFIER_EMAIL: "https://medicalbible.example.com/identifiers/email",
  IDENTIFIER_INVITE_CODE: "https://medicalbible.example.com/identifiers/invite-code",
  OBSERVATION_TYPE: "https://medicalbible.example.com/CodeSystem/observation-type",
  CONDITION_CATEGORY: "https://medicalbible.example.com/CodeSystem/condition-category",
  DOCUMENT_TYPE: "https://medicalbible.example.com/CodeSystem/document-type",
  COVERAGE_TYPE: "https://medicalbible.example.com/CodeSystem/coverage-type",
  ORGANIZATION_TYPE: "https://medicalbible.example.com/CodeSystem/organization-type",
  STRUCTURE_DEFINITION_PROFESSION_LEVEL:
    "https://medicalbible.example.com/StructureDefinition/profession-level",
  STRUCTURE_DEFINITION_EXAM_DETAILS:
    "https://medicalbible.example.com/StructureDefinition/exam-details",
  STRUCTURE_DEFINITION_QUESTION_DETAILS:
    "https://medicalbible.example.com/StructureDefinition/question-details",
  STRUCTURE_DEFINITION_WRONG_QUESTION_DETAILS:
    "https://medicalbible.example.com/StructureDefinition/wrong-question-details",
  STRUCTURE_DEFINITION_LECTURE_DETAILS:
    "https://medicalbible.example.com/StructureDefinition/lecture-details",
  STRUCTURE_DEFINITION_READING_PROGRESS:
    "https://medicalbible.example.com/StructureDefinition/reading-progress",
  STRUCTURE_DEFINITION_EXAM_SESSION_DETAILS:
    "https://medicalbible.example.com/StructureDefinition/exam-session-details",
  STRUCTURE_DEFINITION_SUBSCRIPTION_DETAILS:
    "https://medicalbible.example.com/StructureDefinition/subscription-details",
} as const;
