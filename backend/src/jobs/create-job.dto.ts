import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export const TASKS = ['word-count', 'reverse-text', 'fibonacci', 'failing-job'] as const;

export class CreateJobDto {
  @IsIn(TASKS as unknown as string[], { message: `task must be one of: ${TASKS.join(', ')}` })
  task: string;

  @IsString()
  @IsNotEmpty({ message: 'input cannot be empty' })
  @MaxLength(500)
  input: string;
}
