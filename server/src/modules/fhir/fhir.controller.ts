/**
 * @file FHIR控制器
 * @description 提供FHIR R4标准RESTful API端点
 * @author Medical Bible Team
 * @version 1.0.0
 * @see https://hl7.org/fhir/R4/http.html
 */

import {
  Controller,
  Get,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  ValidationPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";

import { FhirService } from "./fhir.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../../common/guards/jwt-auth.guard";
import { Public } from "../../common/decorators/public.decorator";
import {
  FhirPatient,
  FhirObservation,
  FhirCondition,
  FhirDocumentReference,
  FhirEncounter,
  FhirOrganization,
  FhirCoverage,
  FhirBundle,
  FhirResourceType,
} from "./dto/fhir-resources.dto";
import {
  FhirPatientQueryDto,
  FhirObservationQueryDto,
  FhirConditionQueryDto,
  FhirDocumentReferenceQueryDto,
  FhirEncounterQueryDto,
} from "./dto/fhir-query.dto";

/**
 * FHIR控制器
 * @description 提供FHIR R4标准资源端点，所有端点位于 /fhir 路径下
 *
 * 路径约定：
 * - GET /fhir/{resourceType} - 搜索资源类型
 * - GET /fhir/{resourceType}/{id} - 读取单个资源
 * - GET /fhir/Patient/{id}/$everything - 获取患者的所有相关资源
 */
@ApiTags("FHIR")
@ApiBearerAuth("JWT-auth")
@Controller({ path: "fhir", version: "1" })
export class FhirController {
  constructor(private readonly fhirService: FhirService) {}

  /**
   * 搜索Patient资源
   * @see https://hl7.org/fhir/R4/patient.html#search
   */
  @Get("Patient")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "搜索Patient资源",
    description:
      "根据查询参数搜索Patient资源，支持分页和标识符查询",
  })
  @ApiResponse({
    status: 200,
    description: "搜索成功",
    type: Object,
  })
  async searchPatients(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: FhirPatientQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{
    resourceType: "Bundle";
    type: "searchset";
    entry: Array<{ resource: FhirPatient }>;
    total: number;
  }> {
    // 如果提供了identifier，按手机号或邮箱查询
    if (query.identifier) {
      const patients = await this.fhirService.findPatientByIdentifier(
        query.identifier,
      );
      return {
        resourceType: FhirResourceType.BUNDLE,
        type: "searchset",
        entry: patients.map((p) => ({ resource: p })),
        total: patients.length,
      };
    }

    // 默认分页查询
    const { resources, total } = await this.fhirService.getPatientResources(
      query._offset || 0,
      query._count || 50,
    );

    return {
      resourceType: FhirResourceType.BUNDLE,
      type: "searchset",
      entry: resources.map((r) => ({ resource: r })),
      total,
    };
  }

  /**
   * 读取单个Patient资源
   * @see https://hl7.org/fhir/R4/patient.html#read
   */
  @Get("Patient/:id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "读取Patient资源",
    description: "根据ID获取单个Patient资源",
  })
  @ApiResponse({
    status: 200,
    description: "读取成功",
    type: Object,
  })
  @ApiResponse({ status: 404, description: "资源不存在" })
  async getPatient(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<FhirPatient> {
    return this.fhirService.getPatientResource(id);
  }

  /**
   * 获取患者的所有相关资源（$everything操作）
   * @see https://hl7.org/fhir/R4/patient-operation-everything.html
   */
  @Get("Patient/:id/$everything")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "获取患者的所有资源",
    description:
      "返回指定患者的所有相关FHIR资源，包括Observations、Conditions等",
  })
  @ApiResponse({
    status: 200,
    description: "操作成功",
    type: Object,
  })
  async getPatientEverything(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<FhirBundle> {
    return this.fhirService.getPatientBundle(id);
  }

  /**
   * 搜索Observation资源
   * @see https://hl7.org/fhir/R4/observation.html#search
   */
  @Get("Observation")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "搜索Observation资源",
    description: "根据查询参数搜索Observation资源（考试结果和答题记录）",
  })
  @ApiResponse({
    status: 200,
    description: "搜索成功",
    type: Object,
  })
  async searchObservations(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: FhirObservationQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{
    resourceType: "Bundle";
    type: "searchset";
    entry: Array<{ resource: FhirObservation }>;
    total: number;
  }> {
    // 提取subject中的用户ID
    let userId = user.sub;
    if (query.subject) {
      const match = query.subject.match(/Patient\/(\d+)/);
      if (match) {
        userId = parseInt(match[1], 10);
      }
    }

    const { resources, total } = await this.fhirService.getObservationResources(
      userId,
      query._offset || 0,
      query._count || 50,
    );

    return {
      resourceType: FhirResourceType.BUNDLE,
      type: "searchset",
      entry: resources.map((r) => ({ resource: r })),
      total,
    };
  }

  /**
   * 读取单个Observation资源
   * @see https://hl7.org/fhir/R4/observation.html#read
   */
  @Get("Observation/:id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "读取Observation资源",
    description: "根据ID获取单个Observation资源（考试会话）",
  })
  @ApiResponse({
    status: 200,
    description: "读取成功",
    type: Object,
  })
  @ApiResponse({ status: 404, description: "资源不存在" })
  async getObservation(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<FhirObservation> {
    return this.fhirService.getObservationResource(id, user.sub);
  }

  /**
   * 搜索Condition资源
   * @see https://hl7.org/fhir/R4/condition.html#search
   */
  @Get("Condition")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "搜索Condition资源",
    description: "根据查询参数搜索Condition资源（错题记录/学习差距）",
  })
  @ApiResponse({
    status: 200,
    description: "搜索成功",
    type: Object,
  })
  async searchConditions(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: FhirConditionQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{
    resourceType: "Bundle";
    type: "searchset";
    entry: Array<{ resource: FhirCondition }>;
    total: number;
  }> {
    // 提取subject中的用户ID
    let userId = user.sub;
    if (query.subject) {
      const match = query.subject.match(/Patient\/(\d+)/);
      if (match) {
        userId = parseInt(match[1], 10);
      }
    }

    const { resources, total } = await this.fhirService.getConditionResources(
      userId,
      query._offset || 0,
      query._count || 50,
    );

    return {
      resourceType: FhirResourceType.BUNDLE,
      type: "searchset",
      entry: resources.map((r) => ({ resource: r })),
      total,
    };
  }

  /**
   * 读取单个Condition资源
   */
  @Get("Condition/:id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "读取Condition资源",
    description: "根据ID获取单个Condition资源（错题记录）",
  })
  @ApiResponse({
    status: 200,
    description: "读取成功",
    type: Object,
  })
  @ApiResponse({ status: 404, description: "资源不存在" })
  async getCondition(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<FhirCondition> {
    const { resources } = await this.fhirService.getConditionResources(
      user.sub,
    );
    const condition = resources.find((r) => r.id === `wrong-question-${id}`);

    if (!condition) {
      throw new Error("Condition not found");
    }

    return condition;
  }

  /**
   * 搜索DocumentReference资源
   * @see https://hl7.org/fhir/R4/documentreference.html#search
   */
  @Get("DocumentReference")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "搜索DocumentReference资源",
    description: "根据查询参数搜索DocumentReference资源（讲义资料）",
  })
  @ApiResponse({
    status: 200,
    description: "搜索成功",
    type: Object,
  })
  async searchDocumentReferences(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: FhirDocumentReferenceQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{
    resourceType: "Bundle";
    type: "searchset";
    entry: Array<{ resource: FhirDocumentReference }>;
    total: number;
  }> {
    // 提取subject中的用户ID
    let userId = user.sub;
    if (query.subject) {
      const match = query.subject.match(/Patient\/(\d+)/);
      if (match) {
        userId = parseInt(match[1], 10);
      }
    }

    const { resources, total } =
      await this.fhirService.getDocumentReferenceResources(
        userId,
        query._offset || 0,
        query._count || 50,
      );

    return {
      resourceType: FhirResourceType.BUNDLE,
      type: "searchset",
      entry: resources.map((r) => ({ resource: r })),
      total,
    };
  }

  /**
   * 读取单个DocumentReference资源
   */
  @Get("DocumentReference/:id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "读取DocumentReference资源",
    description: "根据ID获取单个DocumentReference资源（讲义）",
  })
  @ApiResponse({
    status: 200,
    description: "读取成功",
    type: Object,
  })
  @ApiResponse({ status: 404, description: "资源不存在" })
  async getDocumentReference(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<FhirDocumentReference> {
    const { resources } =
      await this.fhirService.getDocumentReferenceResources(user.sub);
    const docRef = resources.find((r) => r.id === `lecture-${id}`);

    if (!docRef) {
      throw new Error("DocumentReference not found");
    }

    return docRef;
  }

  /**
   * 搜索Encounter资源
   * @see https://hl7.org/fhir/R4/encounter.html#search
   */
  @Get("Encounter")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "搜索Encounter资源",
    description: "根据查询参数搜索Encounter资源（考试会话）",
  })
  @ApiResponse({
    status: 200,
    description: "搜索成功",
    type: Object,
  })
  async searchEncounters(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: FhirEncounterQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{
    resourceType: "Bundle";
    type: "searchset";
    entry: Array<{ resource: FhirEncounter }>;
    total: number;
  }> {
    // 提取subject中的用户ID
    let userId = user.sub;
    if (query.subject) {
      const match = query.subject.match(/Patient\/(\d+)/);
      if (match) {
        userId = parseInt(match[1], 10);
      }
    }

    const { resources, total } = await this.fhirService.getEncounterResources(
      userId,
      query._offset || 0,
      query._count || 50,
    );

    return {
      resourceType: FhirResourceType.BUNDLE,
      type: "searchset",
      entry: resources.map((r) => ({ resource: r })),
      total,
    };
  }

  /**
   * 读取单个Encounter资源
   * @see https://hl7.org/fhir/R4/encounter.html#read
   */
  @Get("Encounter/:id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "读取Encounter资源",
    description: "根据ID获取单个Encounter资源（考试会话）",
  })
  @ApiResponse({
    status: 200,
    description: "读取成功",
    type: Object,
  })
  @ApiResponse({ status: 404, description: "资源不存在" })
  async getEncounter(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<FhirEncounter> {
    return this.fhirService.getEncounterResource(id, user.sub);
  }

  /**
   * 搜索Coverage资源
   */
  @Get("Coverage")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "搜索Coverage资源",
    description: "获取当前用户的Coverage资源（订阅信息）",
  })
  @ApiResponse({
    status: 200,
    description: "搜索成功",
    type: Object,
  })
  async searchCoverages(
    @CurrentUser() user: JwtPayload,
  ): Promise<{
    resourceType: "Bundle";
    type: "searchset";
    entry: Array<{ resource: FhirCoverage }>;
    total: number;
  }> {
    const resources = await this.fhirService.getCoverageResources(user.sub);

    return {
      resourceType: FhirResourceType.BUNDLE,
      type: "searchset",
      entry: resources.map((r) => ({ resource: r })),
      total: resources.length,
    };
  }

  /**
   * 读取单个Coverage资源
   */
  @Get("Coverage/:id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "读取Coverage资源",
    description: "根据ID获取单个Coverage资源（订阅）",
  })
  @ApiResponse({
    status: 200,
    description: "读取成功",
    type: Object,
  })
  @ApiResponse({ status: 404, description: "资源不存在" })
  async getCoverage(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<FhirCoverage> {
    const resources = await this.fhirService.getCoverageResources(user.sub);
    const coverage = resources.find((r) => r.id === `subscription-${id}`);

    if (!coverage) {
      throw new Error("Coverage not found");
    }

    return coverage;
  }

  /**
   * 读取Organization资源（平台信息）
   * @see https://hl7.org/fhir/R4/organization.html#read
   */
  @Get("Organization/:id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "读取Organization资源",
    description: "获取平台信息作为Organization资源",
  })
  @ApiResponse({
    status: 200,
    description: "读取成功",
    type: Object,
  })
  @Public()
  async getOrganization(
    @Param("id") id: string,
  ): Promise<FhirOrganization> {
    // 目前只支持一个固定的organization ID
    if (id !== "medicalbible-platform") {
      throw new Error("Organization not found");
    }

    return this.fhirService.getOrganizationResource();
  }

  /**
   * FHIR元数据端点（Capability Statement）
   * @see https://hl7.org/fhir/R4/conformance.html
   * @see https://hl7.org/fhir/R4/operation-derive-metadata.html
   */
  @Get("metadata")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "FHIR服务器元数据",
    description: "返回FHIR服务器的Capability Statement，描述服务器的能力",
  })
  @ApiResponse({
    status: 200,
    description: "元数据获取成功",
    type: Object,
  })
  @Public()
  async getMetadata(): Promise<{
    resourceType: "CapabilityStatement";
    status: "active";
    date: string;
    mode: "server";
    fhirVersion: string;
    format: string[];
    rest: Array<{
      mode: string;
      resource: Array<{
        type: string;
        interaction: Array<{ code: string }>;
        searchParam?: Array<{ name: string; type: string }>;
        operation?: Array<{ name: string; definition: string }>;
      }>;
    }>;
  }> {
    return {
      resourceType: "CapabilityStatement",
      status: "active",
      date: new Date().toISOString(),
      mode: "server",
      fhirVersion: "4.0.1",
      format: ["application/fhir+json", "application/fhir+xml"],
      rest: [
        {
          mode: "server",
          resource: [
            {
              type: "Patient",
              interaction: [
                { code: "read" },
                { code: "search-type" },
                { code: "history-type" },
              ],
              searchParam: [
                { name: "identifier", type: "token" },
                { name: "_id", type: "token" },
                { name: "_count", type: "number" },
                { name: "_offset", type: "number" },
              ],
              operation: [
                {
                  name: "everything",
                  definition:
                    "https://hl7.org/fhir/OperationDefinition/Patient-everything",
                },
              ],
            },
            {
              type: "Observation",
              interaction: [
                { code: "read" },
                { code: "search-type" },
              ],
              searchParam: [
                { name: "subject", type: "reference" },
                { name: "code", type: "token" },
                { name: "date", type: "date" },
                { name: "encounter", type: "reference" },
              ],
            },
            {
              type: "Condition",
              interaction: [
                { code: "read" },
                { code: "search-type" },
              ],
              searchParam: [
                { name: "subject", type: "reference" },
                { name: "clinical-status", type: "token" },
              ],
            },
            {
              type: "DocumentReference",
              interaction: [
                { code: "read" },
                { code: "search-type" },
              ],
              searchParam: [
                { name: "subject", type: "reference" },
                { name: "type", type: "token" },
              ],
            },
            {
              type: "Encounter",
              interaction: [
                { code: "read" },
                { code: "search-type" },
              ],
              searchParam: [
                { name: "subject", type: "reference" },
                { name: "status", type: "token" },
                { name: "date", type: "date" },
              ],
            },
            {
              type: "Coverage",
              interaction: [
                { code: "read" },
                { code: "search-type" },
              ],
            },
            {
              type: "Organization",
              interaction: [{ code: "read" }],
            },
          ],
        },
      ],
    };
  }

  /**
   * 健康检查端点
   */
  @Public()
  @Get("health")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "FHIR服务健康检查",
    description: "检查FHIR服务是否正常运行",
  })
  @ApiResponse({ status: 200, description: "服务正常" })
  healthCheck() {
    return {
      status: "ok",
      service: "FHIR R4 Server",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    };
  }
}
