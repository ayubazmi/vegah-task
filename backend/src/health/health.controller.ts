import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { JOBS_QUEUE } from '../jobs/jobs.constants';

@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    @InjectQueue(JOBS_QUEUE) private readonly queue: Queue,
  ) {}

  @Get()
  async check() {
    const checks = { database: 'up', redis: 'up' };

    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      checks.database = 'down';
    }
    try {
      const client = await this.queue.client;
      await (client as unknown as { ping(): Promise<string> }).ping();
    } catch {
      checks.redis = 'down';
    }

    const healthy = checks.database === 'up' && checks.redis === 'up';
    const body = { status: healthy ? 'ok' : 'error', uptime: Math.round(process.uptime()), checks };
    if (!healthy) throw new ServiceUnavailableException(body); // 503 -> Docker/LB ko pata chale
    return body;
  }
}
