/**
 * @file 文件上传模块导出
 * @description 统一导出文件上传相关的类、接口和装饰器
 * @version 2.0.0
 */

export { UploadModule } from "./upload.module";
export { UploadService } from "./upload.service";
export { UploadController } from "./upload.controller";

// 文件验证相关
export {
  FileValidator,
  FileValidationPipe,
  FileValidationOptions,
  FileValidationResult,
  CreateFileValidationDecorator,
  getFileValidationOptions,
} from "./file-validation";

// 文件上传拦截器相关
export {
  FileUploadInterceptor,
  FileUploadOptions,
  FileUpload,
} from "./file-upload.interceptor";
