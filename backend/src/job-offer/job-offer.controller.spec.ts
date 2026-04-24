import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JobOfferController } from './job-offer.controller';
import { JobOfferService } from './job-offer.service';
import { JobOfferPlatform } from './dto/job-offer.dto';

describe('JobOfferController', () => {
  let controller: JobOfferController;
  let jobOfferService: { importFromPlatform: jest.Mock };

  beforeEach(async () => {
    jobOfferService = {
      importFromPlatform: jest.fn().mockResolvedValue({ imported: 1, offers: [] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobOfferController],
      providers: [{ provide: JobOfferService, useValue: jobOfferService }],
    }).compile();

    controller = module.get<JobOfferController>(JobOfferController);
  });

  it('allows automatic import for amirotalbi94@gmail.com', async () => {
    const dto = {
      platform: JobOfferPlatform.LINKEDIN,
      keywords: ['nodejs'],
      limit: 5,
    };

    await controller.importOffers('user-1', 'amirotalbi94@gmail.com', dto);

    expect(jobOfferService.importFromPlatform).toHaveBeenCalledWith('user-1', dto);
  });

  it('blocks automatic import for other emails', async () => {
    const dto = {
      platform: JobOfferPlatform.LINKEDIN,
      keywords: ['docker'],
      limit: 5,
    };

    expect(() =>
      controller.importOffers('user-1', 'other.user@example.com', dto),
    ).toThrow(ForbiddenException);

    expect(jobOfferService.importFromPlatform).not.toHaveBeenCalled();
  });
});
