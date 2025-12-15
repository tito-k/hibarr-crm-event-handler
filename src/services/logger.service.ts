import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

import { serverConfig } from '../config';
import { BadRequestError, NotFoundError } from '../errors';
import { logger } from '../utils';

class LoggerService {
  private readdir = promisify(fs.readdir);

  private readFile = promisify(fs.readFile);

  // Use process.cwd() to match the logger utility's path resolution
  // This ensures we look in the same place where logs are actually created
  public logDirectory = path.resolve(
    process.cwd(),
    serverConfig.logging.directoryName,
  );

  private allowedLevels = new Set(['error', 'info', 'http', 'debug', 'query']);

  private validateLevel(level: string) {
    if (!this.allowedLevels.has(level)) {
      throw new BadRequestError(
        `Invalid log level. Allowed: ${Array.from(this.allowedLevels).join(', ')}`,
      );
    }
  }

  public async getAllForLevel(logLevel: string): Promise<string[]> {
    try {
      this.validateLevel(logLevel);
      const levelPath = path.join(this.logDirectory, logLevel);
      const files = await this.readdir(levelPath);

      const logFilePattern = new RegExp(
        `^\\d{4}-\\d{2}-\\d{2}-${logLevel}\\.log$`,
      );

      const logFiles = files
        .filter((file) => logFilePattern.test(file))
        .sort()
        .reverse();
      return logFiles;
    } catch (error) {
      throw new NotFoundError('Log files not found for this level.');
    }
  }

  public async getLogContent(logLevel: string, date?: string): Promise<string> {
    const filePath = this.getLogPath(logLevel, date);
    const content = await this.readFile(filePath, 'utf8');
    return content;
  }

  public getLogPath(logLevel: string, date?: string): string {
    this.validateLevel(logLevel);
    date = date || new Date().toISOString().split('T')[0];

    const filePath = path.join(
      this.logDirectory,
      logLevel,
      `${date}-${logLevel}.log`,
    );

    try {
      // Check if the file exists using fs.existsSync
      if (!fs.existsSync(filePath)) {
        logger.debug('Log file check failed', { filePath });
        throw new NotFoundError('This log file does not exist.');
      }
    } catch (error) {
      logger.error('Error checking log file existence', error);
      throw new NotFoundError('This log file does not exist.');
    }

    return filePath;
  }

  public getLogStream(
    logLevel: string,
    date?: string,
    start?: number,
  ): fs.ReadStream {
    const filePath = this.getLogPath(logLevel, date);
    const opts: {
      start?: number;
      end?: number;
      flags?: string;
      mode?: number;
      autoClose?: boolean;
      emitClose?: boolean;
      highWaterMark?: number;
    } = {};
    if (typeof start === 'number' && start >= 0) {
      opts.start = start;
    }
    return fs.createReadStream(filePath, opts);
  }
}

export default LoggerService;
