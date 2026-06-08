import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { CvController } from './cv.controller';
import { CvService } from './cv.service';
import { Cv } from './entities/cv.entity';
import { CvVersion } from './entities/cv-version.entity';
import { OllamaService } from '../ai-optimization/ollama.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cv, CvVersion]),
    MulterModule.register({
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  ],
  controllers: [CvController],
  providers: [CvService, OllamaService],
  exports: [CvService],
})
export class CvModule {}
