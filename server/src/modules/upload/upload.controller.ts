/**
 * @file 文件上传控制器
 * @description 处理文件上传 API
 */

import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import { UploadService } from "./upload.service";
import { JwtAuthGuard, RolesGuard } from "@common/guards";
import { Roles, Public } from "@common/decorators";

@ApiTags("文件上传")
@Controller({ path: "upload", version: "1" })
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post("pdf")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "teacher")
  @UseInterceptors(FileInterceptor("file"))
  @ApiBearerAuth()
  @ApiOperation({ summary: "上传 PDF 文件（自动解析页数）" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "PDF 文件",
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: "上传成功",
    schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "文件 URL" },
        pageCount: { type: "number", description: "PDF 页数" },
        fileName: { type: "string", description: "原始文件名" },
        fileSize: { type: "number", description: "文件大小（字节）" },
      },
    },
  })
  @ApiResponse({ status: 400, description: "文件格式错误或解析失败" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  async uploadPdf(@UploadedFile() file: Express.Multer.File) {
    return this.uploadService.uploadPdf(file);
  }

  @Post("pdf/parse")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "teacher")
  @UseInterceptors(FileInterceptor("file"))
  @ApiBearerAuth()
  @ApiOperation({ summary: "解析 PDF 页数（不保存文件）" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "PDF 文件",
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: "解析成功",
    schema: {
      type: "object",
      properties: {
        pageCount: { type: "number", description: "PDF 页数" },
      },
    },
  })
  async parsePdfPageCount(@UploadedFile() file: Express.Multer.File) {
    const pageCount = await this.uploadService.parsePdfPageCount(file);
    return { pageCount };
  }

  @Post("avatar")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file"))
  @ApiBearerAuth()
  @ApiOperation({ summary: "上传头像（自动压缩为200x200）" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "头像图片（支持 jpg, png, gif, webp，最大5MB）",
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: "上传成功",
    schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "头像 URL" },
        fileName: { type: "string", description: "文件名" },
        fileSize: { type: "number", description: "压缩后大小（字节）" },
      },
    },
  })
  @ApiResponse({ status: 400, description: "文件格式错误或处理失败" })
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    return this.uploadService.uploadAvatar(file);
  }

  @Post("image")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file"))
  @ApiBearerAuth()
  @ApiOperation({ summary: "上传图片" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "图片文件（支持 jpg, png, gif）",
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: "上传成功" })
  @ApiResponse({ status: 400, description: "文件格式错误" })
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    return this.uploadService.uploadFile(file);
  }
}
