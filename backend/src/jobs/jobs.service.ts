import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { Job } from './job.entity';
import { CreateJobDto } from './create-job.dto';
import { JOBS_QUEUE } from './jobs.constants';

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job) private readonly repo: Repository<Job>,
    @InjectQueue(JOBS_QUEUE) private readonly queue: Queue,
  ) {}

  async create(dto: CreateJobDto): Promise<Job> {
    // 1) Pehle DB me record (status = queued)
    const job = await this.repo.save(
      this.repo.create({ task: dto.task, input: dto.input, status: 'queued' }),
    );

    // 2) Phir Redis queue me message daalo -> worker utha lega
    await this.queue.add(
      dto.task,
      { jobId: job.id, task: dto.task, input: dto.input },
      {
        jobId: job.id,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 200 },
      },
    );
    return job;
  }

  findAll(): Promise<Job[]> {
    return this.repo.find({ order: { createdAt: 'DESC' }, take: 30 });
  }

  async findOne(id: string): Promise<Job> {
    const job = await this.repo.findOne({ where: { id } });
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return job;
  }
}
