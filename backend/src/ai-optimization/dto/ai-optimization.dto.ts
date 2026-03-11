import { IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OptimizeCvDto {
  @ApiProperty({ description: 'CV ID to optimize' })
  @IsUUID()
  cvId: string;

  @ApiProperty({ description: 'Job offer ID to match against' })
  @IsUUID()
  jobOfferId: string;
}

export class AiJobStatusDto {
  jobId: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  result?: Record<string, unknown>;
  error?: string;
}
