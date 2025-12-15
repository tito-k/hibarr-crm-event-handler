import { Request, Response, NextFunction } from 'express';
import { QueryFilter, PopulateOptions, Types } from 'mongoose';
import { NotFoundError } from '../errors';
import BaseService, {
  IPaginationOptions,
  IQueryOptions,
} from '../services/base.service';

/**
 * Interface for standardized API response
 */
export interface IApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: any;
}

/**
 * Interface for paginated API response
 */
export interface IPaginatedApiResponse<T = any> extends IApiResponse<T> {
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * Base Controller class providing standardized CRUD operations
 * @template T - Type of the entity document
 * @template S - Type of service used (extends BaseService)
 *
 * @example
 * ```typescript
 * class UserController extends BaseController<IUserDocument, UserService> {
 *   constructor() {
 *     super(new UserService(), 'User');
 *   }
 * }
 * ```
 */
export abstract class BaseController<
  T = any,
  S extends BaseService<any> = any,
> {
  protected service: S;
  protected entityName: string;

  /**
   * Creates an instance of BaseController
   * @param service - Service instance for entity operations
   * @param entityName - Name of the entity for messages
   */
  constructor(service: S, entityName: string) {
    this.service = service;
    this.entityName = entityName;
  }

  /**
   * Creates a new entity
   * @param req - Express request
   * @param res - Express response
   * @param next - Next function
   */
  create = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const data = await this.beforeCreate(req.body, req);
      const result = await this.service.create(data);
      const transformedResult = await this.afterCreate(result, req);

      this.sendSuccess(
        res,
        201,
        `${this.entityName} created successfully.`,
        transformedResult,
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * Creates multiple entities in bulk
   * @param req - Express request
   * @param res - Express response
   * @param next - Next function
   */
  createMany = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const records = Array.isArray(req.body) ? req.body : [req.body];
      const result = await this.service.createMany(records);

      this.sendSuccess(
        res,
        201,
        `${result.length} ${this.entityName.toLowerCase()}(s) created successfully.`,
        result,
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * Gets all entities without pagination
   * @param req - Express request
   * @param res - Express response
   * @param next - Next function
   */
  getAll = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const queryOptions = await this.buildQueryOptions(req);
      const data = await this.service.findAll(queryOptions);
      const transformedData = await this.afterFindAll(data, req);

      this.sendSuccess(
        res,
        200,
        `${this.entityName} records retrieved successfully.`,
        transformedData,
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * Gets an entity by ID
   * @param req - Express request
   * @param res - Express response
   * @param next - Next function
   */
  getById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      this.validateObjectId(id);

      const options = await this.buildQueryOptions(req);
      const result = await this.service.findByIdOrFail(id, options);
      const transformedResult = await this.afterFindOne(result, req);

      this.sendSuccess(
        res,
        200,
        `${this.entityName} retrieved successfully.`,
        transformedResult,
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * Gets a single entity by filter
   * @param req - Express request
   * @param res - Express response
   * @param next - Next function
   */
  getOne = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const filter = await this.buildFilter(req);
      const options = await this.buildQueryOptions(req);

      const result = await this.service.findOneOrFail(filter, options);
      const transformedResult = await this.afterFindOne(result, req);

      this.sendSuccess(
        res,
        200,
        `${this.entityName} retrieved successfully.`,
        transformedResult,
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * Updates an entity by ID
   * @param req - Express request
   * @param res - Express response
   * @param next - Next function
   */
  update = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      this.validateObjectId(id);

      const updateData = await this.beforeUpdate(req.body, id, req);
      const result = await this.service.updateByIdOrFail(id, updateData);
      const transformedResult = await this.afterUpdate(result, req);

      this.sendSuccess(
        res,
        200,
        `${this.entityName} updated successfully.`,
        transformedResult,
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * Partially updates an entity by ID
   * @param req - Express request
   * @param res - Express response
   * @param next - Next function
   */
  patch = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      this.validateObjectId(id);

      const result = await this.service.updateByIdOrFail(id, req.body);
      const transformedResult = await this.afterUpdate(result, req);

      this.sendSuccess(
        res,
        200,
        `${this.entityName} updated successfully.`,
        transformedResult,
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * Deletes an entity by ID
   * @param req - Express request
   * @param res - Express response
   * @param next - Next function
   */
  delete = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      this.validateObjectId(id);

      await this.beforeDelete(id, req);
      await this.service.deleteByIdOrFail(id);
      await this.afterDelete(id, req);

      this.sendSuccess(res, 200, `${this.entityName} deleted successfully.`);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Deletes multiple entities by filter
   * @param req - Express request
   * @param res - Express response
   * @param next - Next function
   */
  deleteMany = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const filter = await this.buildFilter(req);
      const deletedCount = await this.service.deleteManyOrFail(filter);

      this.sendSuccess(
        res,
        200,
        `${deletedCount} ${this.entityName.toLowerCase()}(s) deleted successfully.`,
        { deletedCount },
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * Counts entities matching the filter
   * @param req - Express request
   * @param res - Express response
   * @param next - Next function
   */
  count = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const filter = await this.buildFilter(req);
      const count = await this.service.count(filter);

      this.sendSuccess(
        res,
        200,
        `${this.entityName} count retrieved successfully.`,
        { count },
      );
    } catch (error) {
      next(error);
    }
  };

  // ============= Protected Hook Methods =============

  /**
   * Hook called before creating an entity
   * Override to add custom validation or transformation
   * @param data - Entity data
   * @param req - Express request
   * @returns Processed data
   */
  protected async beforeCreate(data: any, req: Request): Promise<any> {
    return data;
  }

  /**
   * Hook called after creating an entity
   * Override to transform response data
   * @param entity - Created entity
   * @param req - Express request
   * @returns Transformed entity
   */
  protected async afterCreate(entity: any, req: Request): Promise<any> {
    return entity;
  }

  /**
   * Hook called before updating an entity
   * Override to add custom validation or transformation
   * @param data - Update data
   * @param id - Entity ID
   * @param req - Express request
   * @returns Processed update data
   */
  protected async beforeUpdate(
    data: any,
    id: string,
    req: Request,
  ): Promise<any> {
    return data;
  }

  /**
   * Hook called after updating an entity
   * Override to transform response data
   * @param entity - Updated entity
   * @param req - Express request
   * @returns Transformed entity
   */
  protected async afterUpdate(entity: any, req: Request): Promise<any> {
    return entity;
  }

  /**
   * Hook called before deleting an entity
   * Override to add custom validation
   * @param id - Entity ID
   * @param req - Express request
   */
  protected async beforeDelete(id: string, req: Request): Promise<void> {
    // Override in derived classes if needed
  }

  /**
   * Hook called after deleting an entity
   * Override to perform cleanup operations
   * @param id - Entity ID
   * @param req - Express request
   */
  protected async afterDelete(id: string, req: Request): Promise<void> {
    // Override in derived classes if needed
  }

  /**
   * Hook called after finding one entity
   * Override to transform response data
   * @param entity - Found entity
   * @param req - Express request
   * @returns Transformed entity
   */
  protected async afterFindOne(entity: any, req: Request): Promise<any> {
    return entity;
  }

  /**
   * Hook called after finding multiple entities
   * Override to transform response data
   * @param entities - Found entities
   * @param req - Express request
   * @returns Transformed entities
   */
  protected async afterFindAll(entities: any[], req: Request): Promise<any[]> {
    return entities;
  }

  // ============= Protected Query Builder Methods =============

  /**
   * Builds filter query from request
   * Override to implement custom filter logic
   * @param req - Express request
   * @returns Filter query object
   */
  protected async buildFilter(req: Request): Promise<QueryFilter<any>> {
    return {};
  }

  /**
   * Builds populate options from request
   * Override to implement custom population logic
   * @param req - Express request
   * @returns Populate options
   */
  protected buildPopulateOptions(
    req: Request,
  ): PopulateOptions | (string | PopulateOptions)[] | undefined {
    return undefined;
  }

  /**
   * Builds sort options from request
   * Override to implement custom sorting logic
   * @param req - Express request
   * @returns Sort options
   */
  protected buildSortOptions(req: Request): Record<string, 1 | -1> | undefined {
    const { sortBy, sortOrder } = req.query;

    if (!sortBy) return undefined;

    return {
      [sortBy as string]: sortOrder === 'desc' ? -1 : 1,
    };
  }

  /**
   * Builds projection options from request
   * Override to implement custom field selection
   * @param req - Express request
   * @returns Projection options
   */
  protected buildProjectionOptions(
    req: Request,
  ): Record<string, unknown> | undefined {
    const { fields } = req.query;

    if (!fields || typeof fields !== 'string') return undefined;

    const projection: Record<string, number> = {};
    fields.split(',').forEach((field) => {
      projection[field.trim()] = 1;
    });

    return projection;
  }

  /**
   * Builds complete query options from request
   * @param req - Express request
   * @returns Query options
   */
  protected async buildQueryOptions(req: Request): Promise<IQueryOptions> {
    return {
      filter: await this.buildFilter(req),
      projection: this.buildProjectionOptions(req),
      populate: this.buildPopulateOptions(req),
      sort: this.buildSortOptions(req),
    };
  }

  /**
   * Builds pagination options from request
   * @param req - Express request
   * @returns Pagination options
   */
  protected buildPaginationOptions(req: Request): IPaginationOptions {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    return {
      page: Math.max(1, page),
      limit: Math.min(100, Math.max(1, limit)), // Cap at 100
      sort: this.buildSortOptions(req),
      populate: this.buildPopulateOptions(req),
      projection: this.buildProjectionOptions(req),
    };
  }

  // ============= Protected Utility Methods =============

  /**
   * Validates if a string is a valid MongoDB ObjectId
   * @param id - ID to validate
   * @throws NotFoundError if invalid
   */
  protected validateObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundError(`Invalid ${this.entityName} ID format.`);
    }
  }

  /**
   * Sends a success response
   * @param res - Express response
   * @param statusCode - HTTP status code
   * @param message - Success message
   * @param data - Response data
   */
  protected sendSuccess(
    res: Response,
    statusCode: number,
    message: string,
    data?: any,
  ): void {
    const response: IApiResponse = {
      success: true,
      message,
      ...(data !== undefined && { data }),
    };

    res.status(statusCode).json(response);
  }

  /**
   * Sends an error response
   * @param res - Express response
   * @param statusCode - HTTP status code
   * @param message - Error message
   * @param error - Error details
   */
  protected sendError(
    res: Response,
    statusCode: number,
    message: string,
    error?: any,
  ): void {
    const response: IApiResponse = {
      success: false,
      message,
      ...(error && { error }),
    };

    res.status(statusCode).json(response);
  }
}

export default BaseController;
