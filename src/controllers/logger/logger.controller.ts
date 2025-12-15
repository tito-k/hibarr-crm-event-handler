import { Request, Response, NextFunction } from 'express';
import { Stats, stat } from 'fs';

import { LoggerService } from '../../services';

export default class LoggerController {
  private service: LoggerService;

  constructor() {
    this.service = new LoggerService();
  }

  getFiles = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        params: { level },
      } = req;

      const data = await this.service.getAllForLevel(level);

      res.status(200).json({ message: 'Log files retrieved', data });
    } catch (error) {
      next(error);
    }
  };

  getContent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { level } = req.params;

      const { date, tailBytes } = req.query as {
        date?: string;
        tailBytes?: string;
      };

      // Optional: support tailing the last N bytes to avoid large payloads
      let start: number | undefined = undefined;
      if (tailBytes) {
        const n = Number(tailBytes);
        if (!Number.isNaN(n) && n > 0) {
          try {
            const filePath = this.service.getLogPath(level, date);
            const stats = await new Promise<Stats>((resolve, reject) =>
              stat(filePath, (err: any, st: Stats) =>
                err ? reject(err) : resolve(st),
              ),
            );
            start = Math.max(0, stats.size - n);
          } catch {
            // Fall back to full stream if stat fails; service will throw if missing
          }
        }
      }

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      const stream = this.service.getLogStream(level, date, start);
      stream.on('error', (err) => next(err));
      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  };
}
