import { BullModule } from "@nestjs/bull";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OllamaModule } from "src/ai-optimization/ollama.module";
import { JobOffer } from "./entities/job-offer.entity";
import { JobOfferImportProcessor } from "./job-offer-import.processor";
import { JobOfferController } from "./job-offer.controller";
import { JobOfferService } from "./job-offer.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([JobOffer]),
    OllamaModule,
    BullModule.registerQueue({
      name: "job-offer-import",
      defaultJobOptions: {
        attempts: 2,
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  controllers: [JobOfferController],
  providers: [JobOfferService, JobOfferImportProcessor],
  exports: [JobOfferService],
})
export class JobOfferModule {}
