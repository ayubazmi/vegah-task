import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Job } from './job.entity';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JOBS_QUEUE } from './jobs.constants';

@Module({
  imports: [TypeOrmModule.forFeature([Job]), BullModule.registerQueue({ name: JOBS_QUEUE })],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}
