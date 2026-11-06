import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Job } from './jobs/job.entity';
import { JobsModule } from './jobs/jobs.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService): TypeOrmModuleOptions => ({
        type: 'postgres',
        host: c.get('DB_HOST', 'localhost'),
        port: Number(c.get('DB_PORT', 5432)),
        username: c.get('DB_USER', 'postgres'),
        password: c.get('DB_PASSWORD', 'postgres'),
        database: c.get('DB_NAME', 'taskflow'),
        entities: [Job],
        // Assessment ke liye simple rakha hai: table apne aap ban jaati hai.
        // Real production me migrations use karte hain.
        synchronize: true,
        retryAttempts: 10,
        retryDelay: 3000,
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        connection: {
          host: c.get('REDIS_HOST', 'localhost'),
          port: Number(c.get('REDIS_PORT', 6379)),
        },
      }),
    }),
    JobsModule,
    HealthModule,
  ],
})
export class AppModule {}
