import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
}
