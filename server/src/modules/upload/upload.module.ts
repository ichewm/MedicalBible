/**
 * @file 文件上传模块
 * @description 处理文件上传，支持 PDF 页数识别
 */

import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { UploadController } from "./upload.controller";
import { UploadService } from "./upload.service";
import { AuthModule } from "../auth/auth.module";

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
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
