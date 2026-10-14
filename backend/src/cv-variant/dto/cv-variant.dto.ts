import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class VariantOverridesDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  jobTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  language?: string;
}

export class VariantRulesDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  includeTags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  excludeTags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  hiddenItemIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  skillOrder?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => VariantOverridesDto)
  overrides?: VariantOverridesDto;
}

export class CreateVariantDto {
  @ApiProperty()
  @IsUUID()
  cvId: string;

  @ApiProperty({ required: false, example: 'Backend Symfony' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  jobOfferId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => VariantRulesDto)
  rules?: VariantRulesDto;
}

export class UpdateVariantDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsUUID()
  jobOfferId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => VariantRulesDto)
  rules?: VariantRulesDto;
}

export class PreviewVariantDto {
  @IsUUID()
  cvId: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => VariantRulesDto)
  rules?: VariantRulesDto;
}

export class DuplicateVariantDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsUUID()
  jobOfferId?: string;
}
