import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bull";
import { AuthModule } from "./auth/auth.module";
import { CvModule } from "./cv/cv.module";
import { JobOfferModule } from "./job-offer/job-offer.module";
import { AiOptimizationModule } from "./ai-optimization/ai-optimization.module";
import { PdfExportModule } from "./pdf-export/pdf-export.module";
import { BullBoardModule } from "@bull-board/nestjs";
import { ExpressAdapter } from "@bull-board/express";
import { BullAdapter } from "@bull-board/api/bullAdapter";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        host: configService.get<string>("DATABASE_HOST", "localhost"),
        port: configService.get<number>("DATABASE_PORT", 5432),
        username: configService.get<string>("DATABASE_USERNAME", "resumeai"),
        password: configService.get<string>(
          "DATABASE_PASSWORD",
          "resumeai_secret",
        ),
        database: configService.get<string>("DATABASE_NAME", "resumeai"),
        autoLoadEntities: true,
        synchronize: configService.get<string>("NODE_ENV") !== "production",
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>("REDIS_HOST", "localhost"),
          port: configService.get<number>("REDIS_PORT", 6379),
        },
      }),
    }),
    BullBoardModule.forRoot({
      route: "/queues",
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: "job-offer-import",
      adapter: BullAdapter,
    }),
    BullBoardModule.forFeature({
      name: "ai-optimization",
      adapter: BullAdapter,
    }),
    AuthModule,
    CvModule,
    JobOfferModule,
    AiOptimizationModule,
    PdfExportModule,
  ],
})
export class AppModule {}
