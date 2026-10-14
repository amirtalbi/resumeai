import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CvService } from '../cv/cv.service';
import { CvContent } from '../cv/entities/cv.entity';
import { JobOfferService } from '../job-offer/job-offer.service';
import { PdfExportService } from '../pdf-export/pdf-export.service';
import { CvVariant } from './entities/cv-variant.entity';
import {
  CreateVariantDto,
  DuplicateVariantDto,
  PreviewVariantDto,
  UpdateVariantDto,
} from './dto/cv-variant.dto';
import { emptyRules, normalizeRules, VariantRules } from './cv-variant.types';
import { resolveVariant } from './resolve-variant';
import { suggestRules } from './suggest-rules';
import { buildExportFileName } from './export-file-name';

@Injectable()
export class CvVariantService {
  constructor(
    @InjectRepository(CvVariant)
    private readonly variantRepository: Repository<CvVariant>,
    private readonly cvService: CvService,
    private readonly jobOfferService: JobOfferService,
    private readonly pdfExportService: PdfExportService,
  ) {}

  async create(userId: string, dto: CreateVariantDto): Promise<CvVariant> {
    const cv = await this.cvService.findOneWithItemIds(dto.cvId, userId);
    const offer = dto.jobOfferId
      ? await this.jobOfferService.findOne(dto.jobOfferId, userId)
      : null;

    let rules: VariantRules;
    if (dto.rules) {
      rules = normalizeRules(dto.rules);
    } else if (offer) {
      rules = suggestRules(cv.contentJson, offer);
    } else {
      rules = emptyRules();
    }

    const name =
      dto.name?.trim() ||
      (offer ? [offer.company, offer.title].filter(Boolean).join(' - ') : 'Nouvelle variante');

    return this.variantRepository.save(
      this.variantRepository.create({
        userId,
        cvId: cv.id,
        name,
        jobOfferId: offer?.id ?? null,
        rules,
      }),
    );
  }

  async findAll(userId: string, cvId?: string): Promise<CvVariant[]> {
    return this.variantRepository.find({
      where: cvId ? { userId, cvId } : { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<CvVariant> {
    const variant = await this.variantRepository.findOne({ where: { id } });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    if (variant.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return variant;
  }

  /** Variante + master (avec ids) + rendu résolu, pour l'écran d'édition. */
  async detail(id: string, userId: string) {
    const variant = await this.findOne(id, userId);
    const cv = await this.cvService.findOneWithItemIds(variant.cvId, userId);

    return {
      variant,
      master: cv.contentJson,
      resolved: resolveVariant(cv.contentJson, variant.rules),
    };
  }

  async update(id: string, userId: string, dto: UpdateVariantDto): Promise<CvVariant> {
    const variant = await this.findOne(id, userId);

    if (dto.name?.trim()) variant.name = dto.name.trim();
    if (dto.rules) variant.rules = normalizeRules(dto.rules);
    if (dto.jobOfferId) {
      const offer = await this.jobOfferService.findOne(dto.jobOfferId, userId);
      variant.jobOfferId = offer.id;
    }

    return this.variantRepository.save(variant);
  }

  async remove(id: string, userId: string): Promise<void> {
    const variant = await this.findOne(id, userId);
    await this.variantRepository.remove(variant);
  }

  async preview(userId: string, dto: PreviewVariantDto): Promise<CvContent> {
    const cv = await this.cvService.findOneWithItemIds(dto.cvId, userId);
    return resolveVariant(cv.contentJson, normalizeRules(dto.rules));
  }

  /**
   * Copie les règles d'une variante (preset) ; si une offre est fournie, les tags
   * de l'offre trouvés dans le CV sont ajoutés en tête des tags mis en avant.
   */
  async duplicate(id: string, userId: string, dto: DuplicateVariantDto): Promise<CvVariant> {
    const source = await this.findOne(id, userId);
    const cv = await this.cvService.findOneWithItemIds(source.cvId, userId);
    const offer = dto.jobOfferId
      ? await this.jobOfferService.findOne(dto.jobOfferId, userId)
      : null;

    const rules = normalizeRules(source.rules);
    if (offer) {
      const suggested = suggestRules(cv.contentJson, offer).includeTags;
      rules.includeTags = Array.from(new Set([...suggested, ...rules.includeTags]));
    }

    const name =
      dto.name?.trim() ||
      (offer
        ? [offer.company, offer.title].filter(Boolean).join(' - ')
        : `${source.name} (copie)`);

    return this.variantRepository.save(
      this.variantRepository.create({
        userId,
        cvId: source.cvId,
        name,
        jobOfferId: offer?.id ?? null,
        rules,
      }),
    );
  }

  /** Génère le PDF de la variante et archive le contenu envoyé dans l'historique du CV. */
  async exportPdf(id: string, userId: string): Promise<{ buffer: Buffer; fileName: string }> {
    const variant = await this.findOne(id, userId);
    const cv = await this.cvService.findOneWithItemIds(variant.cvId, userId);
    const resolved = resolveVariant(cv.contentJson, variant.rules);

    const offer = variant.jobOfferId
      ? await this.jobOfferService.findOne(variant.jobOfferId, userId).catch(() => null)
      : null;

    const buffer = await this.pdfExportService.generateAtsFriendlyPdf(resolved);
    const fileName = buildExportFileName(
      resolved.personalInfo,
      { company: offer?.company, title: offer?.title },
      variant.name,
    );

    await this.cvService.createSnapshot(
      cv.id,
      userId,
      resolved,
      offer?.id ?? undefined,
      { variantId: variant.id, variantName: variant.name, fileName },
    );

    return { buffer, fileName };
  }
}
