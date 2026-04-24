import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum JobOfferPlatform {
  LINKEDIN = 'linkedin',
  INDEED = 'indeed',
  HELLOWORK = 'hellowork',
}

export class CreateJobOfferDto {
  @ApiProperty({ example: 'Senior Full Stack Developer' })
  @IsString()
  @MaxLength(300)
  title: string;

  @ApiProperty({ example: 'We are looking for a senior developer...' })
  @IsString()
  @MaxLength(10000)
  description: string;

  @ApiProperty({ example: 'Google', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  company?: string;

  @ApiProperty({ example: 'Paris, France', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiProperty({ example: 'https://www.linkedin.com/jobs/view/123', required: false })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  applicationUrl?: string;
}

export class UpdateJobOfferDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  company?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  applicationUrl?: string;
}

export class ImportJobOffersDto {
  @ApiProperty({ enum: JobOfferPlatform, example: JobOfferPlatform.LINKEDIN })
  @IsEnum(JobOfferPlatform)
  platform: JobOfferPlatform;

  @ApiProperty({
    type: [String],
    example: ['nodejs', 'docker', 'nest'],
    description: 'Mots-clés de recherche',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  keywords: string[];

  @ApiProperty({ example: 'Paris', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @ApiProperty({ example: 10, required: false, minimum: 1, maximum: 25 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(25)
  limit?: number;
}
