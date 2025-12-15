import {
  Model,
  Document,
  QueryOptions,
  Types,
  PopulateOptions,
  UpdateQuery,
  ClientSession,
  PipelineStage,
  QueryFilter,
} from 'mongoose';

import { ConflictError, NotFoundError } from '../errors';

/**
 * Interface for pagination options
 */
export interface IPaginationOptions {
  page?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
  populate?: PopulateOptions | (string | PopulateOptions)[];
  projection?: Record<string, unknown>;
}

/**
 * Interface for paginated results
 */
export interface IPaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * Interface for query builder options
 */
export interface IQueryOptions {
  filter?: QueryFilter<any>;
  projection?: Record<string, unknown>;
  populate?: PopulateOptions | (string | PopulateOptions)[];
  sort?: Record<string, 1 | -1>;
  limit?: number;
  skip?: number;
  lean?: boolean;
  session?: ClientSession;
}

/**
 * Base Service class providing standardized CRUD operations for MongoDB models
 * @template T - Type extending Mongoose Document
 *
 * @example
 * ```typescript
 * class UserService extends BaseService<IUserDocument> {
 *   constructor() {
 *     super(UserModel, 'User');
 *   }
 * }
 * ```
 */
class BaseService<T extends Document> {
  protected model: Model<T>;
  protected entityName: string;

  /**
   * Creates an instance of BaseService
   * @param model - Mongoose model to perform operations on
   * @param entityName - Name of the entity for error messages
   */
  constructor(model: Model<T>, entityName: string) {
    this.model = model;
    this.entityName = entityName;
  }

  /**
   * Creates a single record
   * @param data - Partial entity data
   * @param session - Optional MongoDB session for transactions
   * @returns Created document
   * @throws Error if creation fails
   */
  async create(data: Partial<T>, session?: ClientSession): Promise<T> {
    try {
      const newRecord = new this.model(data);
      const savedRecord = await newRecord.save({ session });
      return savedRecord;
    } catch (error) {
      throw new Error(
        `Failed to create ${this.entityName.toLowerCase()}: ${error.message}`,
      );
    }
  }

  /**
   * Creates multiple records in bulk
   * @param records - Array of partial entity data
   * @param session - Optional MongoDB session for transactions
   * @returns Array of created documents
   */
  async createMany(
    records: Partial<T>[],
    session?: ClientSession,
  ): Promise<T[]> {
    if (!records || records.length === 0) return [];

    try {
      const createdRecords = await this.model.insertMany(records, {
        session,
        ordered: false,
      });
      return createdRecords as unknown as T[];
    } catch (error) {
      throw new Error(
        `Failed to create multiple ${this.entityName.toLowerCase()}s: ${error.message}`,
      );
    }
  }

  /**
   * Finds all records matching the filter with optional query options
   * @param options - Query options including filter, projection, populate, sort
   * @returns Array of documents
   */
  async findAll(options: IQueryOptions = {}): Promise<T[]> {
    const {
      filter = {},
      projection,
      populate,
      sort,
      limit,
      skip,
      lean = false,
      session,
    } = options;

    let query = this.model.find(filter, projection, { session });

    if (populate) query = query.populate(populate);
    if (sort) query = query.sort(sort);
    if (skip) query = query.skip(skip);
    if (limit) query = query.limit(limit);
    if (lean) return (await query.lean().exec()) as any;

    return await query.exec();
  }

  /**
   * Finds a single record matching the filter
   * @param filter - MongoDB filter query
   * @param options - Query options
   * @returns Document or null if not found
   */
  async findOne(
    filter: QueryFilter<T>,
    options: Omit<IQueryOptions, 'filter'> = {},
  ): Promise<T | null> {
    const { projection, populate, sort, lean = false, session } = options;

    let query = this.model.findOne(filter, projection, { session });

    if (populate) query = query.populate(populate);
    if (sort) query = query.sort(sort);
    if (lean) return (await query.lean().exec()) as T | null;

    return await query.exec();
  }

  /**
   * Finds a single record or throws NotFoundError
   * @param filter - MongoDB filter query
   * @param options - Query options
   * @returns Document
   * @throws NotFoundError if record not found
   */
  async findOneOrFail(
    filter: QueryFilter<T>,
    options: Omit<IQueryOptions, 'filter'> = {},
  ): Promise<T> {
    const record = await this.findOne(filter, options);

    if (!record) {
      throw new NotFoundError(`${this.entityName} could not be found.`);
    }

    return record;
  }

  /**
   * Finds a record by ID
   * @param id - Document ID
   * @param options - Query options
   * @returns Document or null if not found
   */
  async findById(
    id: string | Types.ObjectId,
    options: Omit<IQueryOptions, 'filter'> = {},
  ): Promise<T | null> {
    const { projection, populate, lean = false, session } = options;

    let query = this.model.findById(id, projection, { session });

    if (populate) query = query.populate(populate);
    if (lean) return (await query.lean().exec()) as any;

    return await query.exec();
  }

  /**
   * Finds a record by ID or throws NotFoundError
   * @param id - Document ID
   * @param options - Query options
   * @returns Document
   * @throws NotFoundError if record not found
   */
  async findByIdOrFail(
    id: string | Types.ObjectId,
    options: Omit<IQueryOptions, 'filter'> = {},
  ): Promise<T> {
    const record = await this.findById(id, options);

    if (!record) {
      throw new NotFoundError(
        `${this.entityName} with ID ${id} could not be found.`,
      );
    }

    return record;
  }

  /**
   * Updates a single record by ID
   * @param id - Document ID
   * @param update - Update data
   * @param options - Query options
   * @returns Updated document or null if not found
   */
  async updateById(
    id: string | Types.ObjectId,
    update: UpdateQuery<T>,
    options: QueryOptions & { session?: ClientSession } = { new: true },
  ): Promise<T | null> {
    const updatedRecord = await this.model.findByIdAndUpdate(id, update, {
      ...options,
      runValidators: true,
    });

    return updatedRecord;
  }

  /**
   * Updates a single record by ID or throws NotFoundError
   * @param id - Document ID
   * @param update - Update data
   * @param options - Query options
   * @returns Updated document
   * @throws NotFoundError if record not found
   */
  async updateByIdOrFail(
    id: string | Types.ObjectId,
    update: UpdateQuery<T>,
    options: QueryOptions & { session?: ClientSession } = { new: true },
  ): Promise<T> {
    const record = await this.updateById(id, update, options);

    if (!record) {
      throw new NotFoundError(
        `${this.entityName} with ID ${id} could not be found.`,
      );
    }

    return record;
  }

  /**
   * Updates a single record matching the filter
   * @param filter - MongoDB filter query
   * @param update - Update data
   * @param options - Query options
   * @returns Updated document or null if not found
   */
  async updateOne(
    filter: QueryFilter<T>,
    update: UpdateQuery<T>,
    options: QueryOptions & { session?: ClientSession } = { new: true },
  ): Promise<T | null> {
    const record = await this.model.findOneAndUpdate(filter, update, {
      ...options,
      runValidators: true,
    });

    return record;
  }

  /**
   * Updates multiple records matching the filter
   * @param filter - MongoDB filter query
   * @param update - Update data
   * @param session - Optional MongoDB session
   * @returns Number of modified documents
   */
  async updateMany(
    filter: QueryFilter<T>,
    update: UpdateQuery<T>,
    session?: ClientSession,
  ): Promise<number> {
    const result = await this.model.updateMany(filter, update, {
      session,
      runValidators: true,
    });

    return result.modifiedCount;
  }

  /**
   * Deletes a single record by ID
   * @param id - Document ID
   * @param session - Optional MongoDB session
   * @returns Deleted document or null if not found
   */
  async deleteById(
    id: string | Types.ObjectId,
    session?: ClientSession,
  ): Promise<T | null> {
    return await this.model.findByIdAndDelete(id, { session });
  }

  /**
   * Deletes a single record by ID or throws NotFoundError
   * @param id - Document ID
   * @param session - Optional MongoDB session
   * @returns Deleted document
   * @throws NotFoundError if record not found
   */
  async deleteByIdOrFail(
    id: string | Types.ObjectId,
    session?: ClientSession,
  ): Promise<T> {
    const record = await this.deleteById(id, session);

    if (!record) {
      throw new NotFoundError(
        `${this.entityName} with ID ${id} could not be found.`,
      );
    }

    return record;
  }

  /**
   * Deletes a single record matching the filter
   * @param filter - MongoDB filter query
   * @param session - Optional MongoDB session
   * @returns Deleted document or null if not found
   */
  async deleteOne(
    filter: QueryFilter<T>,
    session?: ClientSession,
  ): Promise<T | null> {
    return await this.model.findOneAndDelete(filter, { session });
  }

  /**
   * Deletes multiple records matching the filter
   * @param filter - MongoDB filter query
   * @param session - Optional MongoDB session
   * @returns Number of deleted documents
   */
  async deleteMany(
    filter: QueryFilter<T>,
    session?: ClientSession,
  ): Promise<number> {
    const result = await this.model.deleteMany(filter, { session });
    return result.deletedCount;
  }

  /**
   * Deletes multiple records or throws NotFoundError if none deleted
   * @param filter - MongoDB filter query
   * @param session - Optional MongoDB session
   * @returns Number of deleted documents
   * @throws NotFoundError if no records deleted
   */
  async deleteManyOrFail(
    filter: QueryFilter<T>,
    session?: ClientSession,
  ): Promise<number> {
    const deletedCount = await this.deleteMany(filter, session);

    if (deletedCount === 0) {
      throw new NotFoundError(
        `No ${this.entityName.toLowerCase()}s found to delete.`,
      );
    }

    return deletedCount;
  }

  /**
   * Counts documents matching the filter
   * @param filter - MongoDB filter query
   * @returns Count of matching documents
   */
  async count(filter: QueryFilter<T> = {}): Promise<number> {
    return await this.model.countDocuments(filter);
  }

  /**
   * Checks if any document exists matching the filter
   * @param filter - MongoDB filter query
   * @returns Boolean indicating existence
   */
  async exists(filter: QueryFilter<T>): Promise<boolean> {
    const count = await this.count(filter);
    return count > 0;
  }

  /**
   * Executes an aggregation pipeline
   * @param pipeline - MongoDB aggregation pipeline
   * @param session - Optional MongoDB session
   * @returns Aggregation result
   */
  async aggregate<R = any>(
    pipeline: PipelineStage[],
    session?: ClientSession,
  ): Promise<R[]> {
    return await this.model.aggregate(pipeline).session(session).exec();
  }

  /**
   * Performs a bulk write operation
   * @param operations - Array of bulk write operations
   * @param session - Optional MongoDB session
   * @returns Bulk write result
   */
  async bulkWrite(operations: any[], session?: ClientSession): Promise<any> {
    return await this.model.bulkWrite(operations, { session });
  }

  /**
   * Validates uniqueness of a field value
   * @param filter - MongoDB filter query
   * @param fieldName - Name of the field being validated
   * @param throwError - Whether to throw error if duplicate found
   * @returns Existing document or null
   * @throws ConflictError if duplicate found and throwError is true
   */
  protected async validateUnique(
    filter: QueryFilter<T>,
    fieldName: string = 'name',
    throwError: boolean = true,
  ): Promise<T | null> {
    const record = await this.findOne(filter);

    if (record && throwError) {
      const article = this.entityName.toLowerCase().match(/^[aeiou]/)
        ? 'An'
        : 'A';
      throw new ConflictError(
        `${article} ${this.entityName.toLowerCase()} with this ${fieldName} already exists.`,
      );
    }

    return record;
  }

  /**
   * Starts a MongoDB transaction session
   * @returns ClientSession
   */
  async startSession(): Promise<ClientSession> {
    return await this.model.db.startSession();
  }

  /**
   * Executes a function within a transaction
   * @param callback - Function to execute in transaction
   * @returns Result of the callback function
   */
  async withTransaction<R>(
    callback: (session: ClientSession) => Promise<R>,
  ): Promise<R> {
    const session = await this.startSession();

    try {
      session.startTransaction();
      const result = await callback(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Soft deletes a record by setting a deleted flag or timestamp
   * Override this method if your model supports soft deletes
   * @param id - Document ID
   * @param session - Optional MongoDB session
   * @returns Updated document
   */
  async softDelete(
    id: string | Types.ObjectId,
    session?: ClientSession,
  ): Promise<T | null> {
    // Default implementation - override in child classes
    return await this.updateById(id, { deletedAt: new Date() } as any, {
      session,
      new: true,
    });
  }

  /**
   * Restores a soft-deleted record
   * Override this method if your model supports soft deletes
   * @param id - Document ID
   * @param session - Optional MongoDB session
   * @returns Updated document
   */
  async restore(
    id: string | Types.ObjectId,
    session?: ClientSession,
  ): Promise<T | null> {
    // Default implementation - override in child classes
    return await this.updateById(id, { deletedAt: null } as any, {
      session,
      new: true,
    });
  }
}

export default BaseService;
