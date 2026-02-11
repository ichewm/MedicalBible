/**
 * @file Common API Response Decorators
 * @description Reusable Swagger response decorators for consistent API documentation
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { ApiResponse } from "@nestjs/swagger";
import { ErrorResponseDto } from "../dto/error-response.dto";

/**
 * 401 Unauthorized response decorator
 * @description Standard unauthorized response for missing or invalid JWT tokens
 */
export const ApiUnauthorizedResponse = () =>
  ApiResponse({
    status: 401,
    description: "Unauthorized - JWT token is missing or invalid",
    type: ErrorResponseDto,
    example: {
      code: 401,
      message: "Unauthorized",
      errorCode: "ERR_2002",
      path: "/api/v1/user/profile",
      timestamp: "2024-01-15T10:30:00.000Z",
    },
  });

/**
 * 403 Forbidden response decorator
 * @description Standard forbidden response for insufficient permissions or subscription requirements
 */
export const ApiForbiddenResponse = () =>
  ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions or subscription required",
    type: ErrorResponseDto,
    example: {
      code: 403,
      message: "Active subscription required to access this resource",
      errorCode: "ERR_4001",
      path: "/api/v1/question/papers",
      timestamp: "2024-01-15T10:30:00.000Z",
    },
  });

/**
 * 404 Not Found response decorator factory
 * @param resource - The resource type that was not found
 * @description Standard not found response for missing resources
 */
export const ApiNotFoundResponse = (resource: string) =>
  ApiResponse({
    status: 404,
    description: `${resource} not found`,
    type: ErrorResponseDto,
    example: {
      code: 404,
      message: `${resource} not found`,
      errorCode: "ERR_3001",
      path: "/api/v1/question/papers/999",
      timestamp: "2024-01-15T10:30:00.000Z",
    },
  });

/**
 * 400 Bad Request response decorator
 * @description Standard bad request response for validation errors
 */
export const ApiBadRequestResponse = () =>
  ApiResponse({
    status: 400,
    description: "Bad Request - Request validation failed or invalid parameters",
    type: ErrorResponseDto,
    example: {
      code: 400,
      message: "Validation failed",
      errorCode: "ERR_1001",
      path: "/api/v1/user/profile",
      timestamp: "2024-01-15T10:30:00.000Z",
      validationErrors: [
        {
          field: "phone",
          constraints: { isMobilePhone: "Please enter a valid mobile phone number" },
        },
      ],
    },
  });

/**
 * 429 Too Many Requests response decorator
 * @description Rate limit exceeded response
 */
export const ApiTooManyRequestsResponse = () =>
  ApiResponse({
    status: 429,
    description: "Too Many Requests - Rate limit exceeded",
    type: ErrorResponseDto,
    example: {
      code: 429,
      message: "Rate limit exceeded. Please try again later.",
      errorCode: "ERR_1002",
      path: "/api/v1/auth/verification-code",
      timestamp: "2024-01-15T10:30:00.000Z",
    },
  });

/**
 * 500 Internal Server Error response decorator
 * @description Standard server error response
 */
export const ApiInternalErrorResponse = () =>
  ApiResponse({
    status: 500,
    description: "Internal Server Error - An unexpected error occurred",
    type: ErrorResponseDto,
    example: {
      code: 500,
      message: "An unexpected error occurred",
      errorCode: "ERR_5001",
      path: "/api/v1/user/profile",
      timestamp: "2024-01-15T10:30:00.000Z",
    },
  });

/**
 * Paginated response decorator factory
 * @param dataType - The class constructor for the data type in the items array
 * @description Creates a paginated response schema for list endpoints
 */
export const ApiPaginatedResponse = <T extends new (...args: any[]) => any>(dataType: T) =>
  ApiResponse({
    status: 200,
    description: "Paginated list response",
    schema: {
      allOf: [
        { $ref: "#/components/schemas/PaginatedResponseDto" },
        {
          properties: {
            items: {
              type: "array",
              items: { $ref: `#/components/schemas/${dataType.name}` },
            },
          },
        },
      ],
    },
  });

/**
 * Standard success response decorator factory
 * @param dataType - The class constructor for the response data type
 * @param description - Custom description for the response
 * @description Creates a standard success response schema
 */
export const ApiSuccessResponse = <T extends new (...args: any[]) => any>(
  dataType: T,
  description?: string,
) =>
  ApiResponse({
    status: 200,
    description: description || "Request successful",
    schema: {
      allOf: [
        { $ref: "#/components/schemas/ApiResponseDto" },
        {
          properties: {
            data: {
              $ref: `#/components/schemas/${dataType.name}`,
            },
          },
        },
      ],
    },
  });

/**
 * Common error responses decorator
 * @description Adds common error responses (400, 401, 403, 404, 500) to an endpoint
 */
export const ApiCommonErrorResponses = () => {
  const decorators = [
    ApiBadRequestResponse(),
    ApiUnauthorizedResponse(),
    ApiForbiddenResponse(),
    ApiInternalErrorResponse(),
  ];
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    decorators.forEach((decorator) => decorator(target, propertyKey, descriptor));
  };
};
