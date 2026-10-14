import {
  IsString,
  IsObject,
  IsOptional,
  ValidateNested,
  IsArray,
  IsEmail,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class PersonalInfoDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  linkedin?: string;

  @IsOptional()
  @IsString()
  website?: string;
}

class ExperienceDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  @IsString()
  company: string;

  @IsString()
  position: string;

  @IsString()
  startDate: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  current?: boolean;

  @IsString()
  @MaxLength(2000)
  description: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  achievements?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

class EducationDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  @IsString()
  institution: string;

  @IsString()
  degree: string;

  @IsString()
  field: string;

  @IsString()
  startDate: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

class SkillCategoryDto {
  @IsString()
  category: string;

  @IsArray()
  @IsString({ each: true })
  items: string[];
}

class LanguageDto {
  @IsString()
  name: string;

  @IsString()
  level: string;
}

class CertificationDto {
  @IsString()
  name: string;

  @IsString()
  issuer: string;

  @IsString()
  date: string;
}

class QrCodeDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}

class CvContentDto {
  @IsOptional()
  @IsString()
  @MaxLength(5)
  language?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => QrCodeDto)
  qrCode?: QrCodeDto;

  @ValidateNested()
  @Type(() => PersonalInfoDto)
  personalInfo: PersonalInfoDto;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExperienceDto)
  experiences: ExperienceDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EducationDto)
  education: EducationDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SkillCategoryDto)
  skills: SkillCategoryDto[];

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => {
    if (!Array.isArray(value)) return value;
    return value.map((language) =>
      typeof language === 'string'
        ? { name: language, level: 'Non spécifié' }
        : {
            name: String(language?.name ?? ''),
            level: String(language?.level ?? 'Non spécifié'),
          },
    );
  })
  @IsObject({ each: true })
  languages?: { name: string; level: string }[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CertificationDto)
  certifications?: CertificationDto[];
}

export class CreateCvDto {
  @ApiProperty({ example: 'My Professional CV' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty()
  @IsObject()
  @ValidateNested()
  @Type(() => CvContentDto)
  contentJson: CvContentDto;
}

export class UpdateCvDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CvContentDto)
  contentJson?: CvContentDto;
}
