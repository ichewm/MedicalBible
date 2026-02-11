/**
 * @file 文件上传模块
 * @description 处理文件上传，支持 PDF 页数识别和安全验证
 * @version 2.1.0
 */

import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { UploadController } from "./upload.controller";
import { UploadService } from "./upload.service";
import { AuthModule } from "../auth/auth.module";
import { FileValidator } from "./file-validation";
import { VirusScanService } from "../virus-scan/virus-scan.service";

@Module({
  imports: [
    AuthModule,
    // 配置 Multer 使用内存存储，并设置文件大小限制
    MulterModule.register({
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    }),
  ],
  controllers: [UploadController],
  providers: [UploadService, FileValidator, VirusScanService],
  exports: [UploadService, FileValidator],
})
export class UploadModule {}
