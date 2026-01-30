/**
 * @file 响应转换拦截器
 * @description 统一响应格式
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

/**
 * 统一响应格式接口
 */
export interface ApiResponse<T> {
  /** 状态码 */
  code: number;
  /** 响应消息 */
  message: string;
  /** 响应数据 */
  data: T;
  /** 时间戳 */
  timestamp: string;
}

/**
 * 响应转换拦截器
 * @description 将控制器返回的数据统一包装为标准响应格式
 * @example
 * // 控制器返回
 * return { id: 1, name: 'test' };
 *
 * // 实际响应
 * {
 *   "code": 200,
 *   "message": "success",
 *   "data": { "id": 1, "name": "test" },
 *   "timestamp": "2024-01-01T00:00:00.000Z"
 * }
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, any> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // 如果是 StreamableFile（文件下载），不进行包装
        if (data instanceof StreamableFile) {
          return data;
        }
        
        // 如果响应是字符串类型（如支付回调返回的 "success" 或 "failure"），不进行包装
        if (typeof data === "string") {
          return data;
        }
        
        return {
          code: 200,
          message: "success",
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
