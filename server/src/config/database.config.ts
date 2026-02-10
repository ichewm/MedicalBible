/**
 * @file 数据库配置
 * @description MySQL 数据库连接配置，从环境变量读取
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { registerAs } from "@nestjs/config";
import { databaseConfigSchema } from "./config.schema";

/**
 * 数据库配置对象
 * @description 使用 registerAs 注册命名配置，可通过 configService.get('database.xxx') 访问
 */
export const databaseConfig = registerAs("database", () => {
  const rawConfig = {
    /** 数据库主机地址 */
    host: process.env.DB_HOST,
    /** 数据库端口 */
    port: process.env.DB_PORT,
    /** 数据库用户名 */
    username: process.env.DB_USERNAME,
    /** 数据库密码 */
    password: process.env.DB_PASSWORD,
    /** 数据库名称 */
    database: process.env.DB_DATABASE,
  };

  return databaseConfigSchema.parse(rawConfig);
});
