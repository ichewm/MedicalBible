/**
 * @file 加密模块
 * @description 加密服务模块导出
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Global, Module } from "@nestjs/common";
import { CryptoService } from "./crypto.service";

@Global()
@Module({
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
