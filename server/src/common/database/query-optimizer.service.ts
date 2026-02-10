/**
 * @file Query Optimizer Service
 * @description Utility service for TypeORM query optimization and N+1 prevention
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable } from "@nestjs/common";
import {
  SelectQueryBuilder,
  FindOptionsRelations,
  FindOptionsWhere,
  FindOptionsOrder,
  Repository,
  ObjectLiteral,
} from "typeorm";

/**
 * Relation join strategy for optimal query performance
 */
export enum JoinStrategy {
  /** Use LEFT JOIN - preserves parent records even without relations */
  LEFT_JOIN = "left_join",
  /** Use INNER JOIN - only returns records with matching relations */
  INNER_JOIN = "inner_join",
  /** Separate queries - batch load relations after (good for very large datasets) */
  SEPARATE_QUERIES = "separate_queries",
}

/**
 * Common relation paths for frequently accessed entity graphs
 */
export const COMMON_RELATION_PATHS = {
  /** User with current level and profession */
  USER_LEVEL: ["currentLevel", "currentLevel.profession"] as const,
  /** User with parent (for affiliate tree) */
  USER_PARENT: ["parent"] as const,
  /** Paper with subject and level */
  PAPER_FULL: [
    "subject",
    "subject.level",
    "subject.level.profession",
  ] as const,
  /** Paper with questions (for exam taking) */
  PAPER_QUESTIONS: ["questions"] as const,
  /** Subscription with user and level */
  SUBSCRIPTION_FULL: ["user", "level", "level.profession"] as const,
  /** Order with user and level */
  ORDER_FULL: ["user", "level", "level.profession"] as const,
  /** Lecture with subject and level */
  LECTURE_FULL: ["subject", "subject.level"] as const,
} as const;

/**
 * Query optimization configuration
 */
export interface QueryOptimizationConfig {
  /** Maximum number of records before using pagination */
  paginationThreshold?: number;
  /** Whether to use query caching */
  enableCache?: boolean;
  /** Cache TTL in milliseconds */
  cacheTtl?: number;
}

/**
 * Paginated result interface
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Query Optimizer Service
 * @description Provides utilities for efficient TypeORM queries and N+1 prevention
 */
@Injectable()
export class QueryOptimizerService {
  /**
   * Build optimized find options with relations
   * @param baseRelations Base relations to always load
   * @param additionalRelations Optional additional relations
   * @returns Combined relations object
   */
  buildRelations(
    baseRelations: string[],
    additionalRelations?: string[],
  ): FindOptionsRelations<any> {
    const relations: FindOptionsRelations<any> = {};

    for (const relation of baseRelations) {
      this.setNestedRelation(relations, relation);
    }

    if (additionalRelations) {
      for (const relation of additionalRelations) {
        this.setNestedRelation(relations, relation);
      }
    }

    return relations;
  }

  /**
   * Set nested relation in relations object
   * @param relations Relations object to modify
   * @param path Dot-notation path (e.g., "user.profile")
   */
  private setNestedRelation(relations: any, path: string): void {
    const parts = path.split(".");
    let current = relations;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        current[part] = true;
      } else {
        current[part] = current[part] || {};
        current = current[part];
      }
    }
  }

  /**
   * Create an optimized query with proper joins
   * @param queryBuilder TypeORM query builder
   * @param relations Relations to join
   * @param strategy Join strategy to use
   * @returns Modified query builder
   */
  createOptimizedQuery<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    relations: string[],
    strategy: JoinStrategy = JoinStrategy.LEFT_JOIN,
  ): SelectQueryBuilder<T> {
    for (const relation of relations) {
      if (strategy === JoinStrategy.LEFT_JOIN) {
        queryBuilder = queryBuilder.leftJoinAndSelect(
          relation,
          this.getAlias(relation),
        );
      } else if (strategy === JoinStrategy.INNER_JOIN) {
        queryBuilder = queryBuilder.innerJoinAndSelect(
          relation,
          this.getAlias(relation),
        );
      }
    }

    return queryBuilder;
  }

  /**
   * Get a safe alias for relation in query
   * @param relation Relation path
   * @returns Safe alias name
   */
  private getAlias(relation: string): string {
    return relation.replace(/\./g, "_");
  }

  /**
   * Execute paginated query with optimization
   * @param repository TypeORM repository
   * @param options Query options
   * @param page Page number (1-based)
   * @param pageSize Page size
   * @returns Paginated results
   */
  async paginate<T extends ObjectLiteral>(
    repository: Repository<T>,
    options: {
      relations?: FindOptionsRelations<T>;
      where?: FindOptionsWhere<T>;
      order?: FindOptionsOrder<T>;
    },
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedResult<T>> {
    const [data, total] = await repository.findAndCount({
      relations: options.relations,
      where: options.where,
      order: options.order,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      data,
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  }

  /**
   * Batch load entities to avoid N+1 queries
   * @param repository TypeORM repository
   * @param ids Array of entity IDs
   * @param relations Relations to load
   * @returns Map of ID to entity
   */
  async batchLoad<T extends ObjectLiteral>(
    repository: Repository<T>,
    ids: (string | number)[],
    relations?: FindOptionsRelations<T>,
  ): Promise<Map<string | number, T>> {
    if (ids.length === 0) {
      return new Map();
    }

    const entities = await repository.find({
      where: ids.map((id) => ({ id } as any)),
      relations,
    });

    return new Map(entities.map((e) => [e["id"] as string | number, e]));
  }

  /**
   * Check if a query pattern may cause N+1 issues
   * @param queryDescription Description of the query pattern
   * @returns Warning message if N+1 detected, null otherwise
   */
  detectN1Pattern(queryDescription: {
    hasLoop?: boolean;
    loadsRelationsAfterQuery?: boolean;
    usesFindWithoutRelations?: boolean;
  }): string | null {
    const { hasLoop, loadsRelationsAfterQuery, usesFindWithoutRelations } =
      queryDescription;

    if (hasLoop) {
      return "Loop detected with relation loading - likely N+1 issue. Consider using JOIN or batch loading.";
    }

    if (loadsRelationsAfterQuery) {
      return "Loading relations after initial query - use relations in find() or JOIN instead.";
    }

    if (usesFindWithoutRelations) {
      return "Using find() without relations for entities with @OneToMany - may cause N+1 issues.";
    }

    return null;
  }

  /**
   * Get recommended relations for common entity access patterns
   * @param entityName Name of the entity
   * @returns Array of relation paths to load
   */
  getRecommendedRelations(
    entityName: keyof typeof COMMON_RELATION_PATHS,
  ): readonly string[] {
    return COMMON_RELATION_PATHS[entityName];
  }

  /**
   * Validate that a query includes necessary relations
   * @param relations Relations being loaded
   * @param requiredRelations Relations that should be loaded
   * @returns Validation result with missing relations
   */
  validateRelations(
    relations: string[] | FindOptionsRelations<any>,
    requiredRelations: string[],
  ): {
    valid: boolean;
    missing: string[];
  } {
    const relationList = Array.isArray(relations)
      ? relations
      : this.flattenRelations(relations);

    const missing = requiredRelations.filter(
      (required) => !relationList.includes(required),
    );

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Flatten nested relations object to dot-notation array
   * @param relations Relations object
   * @param prefix Current prefix for nested relations
   * @returns Flattened relation paths
   */
  private flattenRelations(
    relations: FindOptionsRelations<any>,
    prefix: string = "",
  ): string[] {
    const result: string[] = [];

    for (const [key, value] of Object.entries(relations)) {
      const path = prefix ? `${prefix}.${key}` : key;

      if (typeof value === "boolean" && value) {
        result.push(path);
      } else if (typeof value === "object") {
        result.push(...this.flattenRelations(value, path));
      }
    }

    return result;
  }

  /**
   * Create a paginated response from query builder
   * @param queryBuilder TypeORM query builder
   * @param page Page number
   * @param pageSize Page size
   * @returns Paginated results
   */
  async paginateFromBuilder<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedResult<T>> {
    const [data, total] = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  }
}
