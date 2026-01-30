/**
 * @file 存储模块
 */

import { Module, Global } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SystemConfig } from "@entities/system-config.entity";
import { StorageService } from "./storage.service";

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SystemConfig])],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
