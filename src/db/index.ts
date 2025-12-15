import mongoose, { Connection, ConnectOptions, Mongoose } from 'mongoose';
import { logger } from '../utils';
import { serverConfig, ServerEnvOptions } from '../config';

class Database {
  private connection: Connection | null = null;
  private connectionPromise: Promise<Mongoose> | null = null;
  private isConnecting = false;
  private retryAttempts = 0;
  private readonly maxRetryAttempts = 5;
  private readonly retryInterval = 5000; // 5 seconds

  /**
   * Get the MongoDB connection options
   */
  private getConnectionOptions(): ConnectOptions {
    return {
      // Automatically retry initial connection
      autoCreate: true,
      // Set timeout for socket operations to avoid hanging connections
      socketTimeoutMS: 30000,
      // Wait 10 seconds before timing out the connection
      connectTimeoutMS: 10000,
      // Use a connection pool for better performance
      maxPoolSize: 10,
      // Minimum connection pool size (always keep some connections ready)
      minPoolSize: 2,
      // How long to wait for server selection before timeout
      serverSelectionTimeoutMS: 5000,
    };
  }

  /**
   * Connect to MongoDB database
   */
  async connect(): Promise<Mongoose> {
    // Return existing connection promise if already connecting
    if (this.isConnecting && this.connectionPromise) {
      return this.connectionPromise;
    }

    try {
      this.isConnecting = true;

      logger.info('Connecting to MongoDB...');

      this.connectionPromise = mongoose.connect(
        serverConfig.db.uri,
        this.getConnectionOptions(),
      );

      const mongooseInstance = await this.connectionPromise;
      this.connection = mongooseInstance.connection;

      // Reset retry counter on successful connection
      this.retryAttempts = 0;

      // Setup connection event handlers
      this.setupConnectionHandlers();

      logger.info('Successfully connected to MongoDB');

      return mongooseInstance;
    } catch (error) {
      const typedError = error as Error;
      logger.error(`MongoDB connection failed: ${typedError.message}`, {
        stack: typedError.stack,
        name: typedError.name,
      });

      // Implement retry logic
      if (this.retryAttempts < this.maxRetryAttempts) {
        this.retryAttempts++;
        logger.info(
          `Retrying connection (${this.retryAttempts}/${this.maxRetryAttempts}) in ${this.retryInterval / 1000}s...`,
        );

        // Reset connection state
        this.isConnecting = false;
        this.connectionPromise = null;

        // Wait and retry
        await new Promise((resolve) => setTimeout(resolve, this.retryInterval));
        return this.connect();
      }

      logger.error('Max retry attempts reached. Could not connect to MongoDB');
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Setup MongoDB connection event handlers
   */
  private setupConnectionHandlers(): void {
    if (!this.connection) return;

    this.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    this.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    this.connection.on('error', (err) => {
      logger.error(`MongoDB connection error: ${err.message}`, {
        stack: err.stack,
      });
    });

    // Log all executed queries in development
    if (serverConfig.node.env === ServerEnvOptions.DEVELOPMENT) {
      mongoose.set('debug', (collectionName, methodName, ...args) => {
        logger.debug(
          `Mongoose: ${collectionName}.${methodName}(${JSON.stringify(args)})`,
        );
      });
    }
  }

  /**
   * Check if database is connected
   */
  isConnected(): boolean {
    return this.connection !== null && this.connection.readyState === 1;
  }

  /**
   * Get the database connection
   */
  getConnection(): Connection | null {
    return this.connection;
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    if (!this.connection) {
      logger.info('No active database connection to close');
      return;
    }

    try {
      logger.info('Closing database connection...');
      await mongoose.disconnect();
      this.connection = null;
      this.connectionPromise = null;
      logger.info('Database connection closed successfully');
    } catch (error) {
      const typedError = error as Error;
      logger.error(`Error closing database connection: ${typedError.message}`, {
        stack: typedError.stack,
      });
      throw error;
    }
  }
}

export default new Database();
