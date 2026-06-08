import { Injectable, Logger } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { CvContent } from '../cv/entities/cv.entity';

@Injectable()
export class PdfExportService {
  private readonly logger = new Logger(PdfExportService.name);
  private readonly sectionSpacingMultiplier = 0.95;

  async generateAtsFriendlyPdf(cvContent: CvContent): Promise<Buffer> {
    const labels = this.getLabels(cvContent.language);
    const qrCodeBuffer = await this.buildQrCodeBuffer(cvContent);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
          info: {
            Title: `${cvContent.personalInfo.firstName} ${cvContent.personalInfo.lastName} - CV`,
            Author: `${cvContent.personalInfo.firstName} ${cvContent.personalInfo.lastName}`,
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header - Name
        doc
          .font('Helvetica-Bold')
          .fontSize(25)
          .text(
            `${cvContent.personalInfo.firstName} ${cvContent.personalInfo.lastName}`,
            { align: 'center' },
          );

        if (qrCodeBuffer) {
          const qrSize = 90;
          const qrX = doc.page.width - doc.page.margins.right - qrSize;
          const qrY = doc.page.margins.top * 0.5;
          const originalY = doc.y;
          doc.image(qrCodeBuffer, qrX, qrY, { width: qrSize, height: qrSize });

          const label = cvContent.qrCode?.label?.trim();
          if (label) {
            doc
              .font('Helvetica')
              .fontSize(9)
              .fillColor('#666666')
              .text(label, qrX, qrY + qrSize + 3, { width: qrSize, align: 'center' });
            doc.fillColor('#000000');
          }

          doc.y = originalY;
        }

        if (cvContent.personalInfo.jobTitle) {
          doc.moveDown(this.scaleSectionGap(0.15));
          doc
            .font('Helvetica')
            .fontSize(12)
            .fillColor('#444444')
            .text(cvContent.personalInfo.jobTitle, { align: 'center' });
          doc.fillColor('#000000');
          doc.moveDown(this.scaleSectionGap(0.5));
        } else {
          doc.moveDown(this.scaleSectionGap(0.65));
        }

        // Contact info
        const contactParts: string[] = [];
        if (cvContent.personalInfo.email)
          contactParts.push(cvContent.personalInfo.email);
        if (cvContent.personalInfo.phone)
          contactParts.push(cvContent.personalInfo.phone);
        if (cvContent.personalInfo.address)
          contactParts.push(cvContent.personalInfo.address);
        if (cvContent.personalInfo.linkedin)
          contactParts.push(cvContent.personalInfo.linkedin);

        doc
          .font('Helvetica')
          .fontSize(11)
          .text(contactParts.join(' | '), { align: 'center' });

        doc.moveDown(this.scaleSectionGap(1));
        this.drawLine(doc);

        // Summary
        if (cvContent.summary) {
          doc.moveDown(this.scaleSectionGap(1.05));
          this.addSectionTitle(doc, labels.summary);
          doc.font('Helvetica').fontSize(11).text(cvContent.summary, {
            align: 'justify',
            lineGap: 3.5,
          });
        }

        // Experience
        if (cvContent.experiences?.length > 0) {
          doc.moveDown(this.scaleSectionGap(1.05));
          this.addSectionTitle(doc, labels.experience);

          for (const exp of cvContent.experiences) {
            doc.moveDown(0.7);
            doc
              .font('Helvetica-Bold')
              .fontSize(12)
              .text(exp.position, { continued: false });

            doc
              .font('Helvetica')
              .fontSize(11)
              .fillColor('#666666')
              .text(
                this.formatLineWithDateRange(
                  exp.company,
                  exp.startDate,
                  exp.endDate,
                  exp.current,
                  labels.present,
                  cvContent.language,
                ),
              );
            doc.fillColor('#000000');

            doc.moveDown(0.4);
            doc.font('Helvetica').fontSize(11).text(exp.description, {
              align: 'justify',
              lineGap: 2.6,
            });

            if (exp.achievements?.length) {
              doc.moveDown(0.4);
              for (const achievement of exp.achievements) {
                doc
                  .font('Helvetica')
                  .fontSize(11)
                  .text(`• ${achievement}`, { indent: 15, lineGap: 2.3 });
              }
            }

            if (exp.tags?.length) {
              doc.moveDown(0.35);
              doc
                .font('Helvetica-Oblique')
                .fontSize(10)
                .fillColor('#444444')
                .text(`${labels.stack}: ${exp.tags.join(', ')}`);
              doc.fillColor('#000000');
            }
          }
        }

        // Education
        if (cvContent.education?.length > 0) {
          doc.moveDown(this.scaleSectionGap(1.05));
          this.addSectionTitle(doc, labels.education);

          for (const edu of cvContent.education) {
            doc.moveDown(0.7);
            doc
              .font('Helvetica-Bold')
              .fontSize(12)
              .text(`${edu.degree} - ${edu.field}`);

            doc
              .font('Helvetica')
              .fontSize(11)
              .text(
                this.formatLineWithDateRange(
                  edu.institution,
                  edu.startDate,
                  edu.endDate,
                  false,
                  labels.present,
                  cvContent.language,
                ),
              );

            if (edu.description) {
              doc.moveDown(0.35);
              doc.font('Helvetica').fontSize(11).text(edu.description, {
                lineGap: 2,
              });
            }

            if (edu.tags?.length) {
              doc.moveDown(0.35);
              doc
                .font('Helvetica-Oblique')
                .fontSize(10)
                .fillColor('#444444')
                .text(`${labels.modules}: ${edu.tags.join(', ')}`);
              doc.fillColor('#000000');
            }
          }
        }

        // Skills
        if (cvContent.skills?.length > 0) {
          doc.moveDown(this.scaleSectionGap(1.05));
          this.addSectionTitle(doc, labels.skills);

          for (const skillCategory of cvContent.skills) {
            doc.moveDown(0.45);
            doc
              .font('Helvetica-Bold')
              .fontSize(11)
              .text(`${skillCategory.category}: `, { continued: true });
            doc
              .font('Helvetica')
              .fontSize(11)
              .text(skillCategory.items.join(', '));
          }
        }

        // Languages
        if (cvContent.languages?.length) {
          doc.moveDown(this.scaleSectionGap(1.05));
          this.addSectionTitle(doc, labels.languages);

          for (const lang of cvContent.languages) {
            doc
              .font('Helvetica')
              .fontSize(11)
              .text(`• ${lang.name}: ${lang.level}`, { lineGap: 2.1 });
          }
        }

        // Certifications
        if (cvContent.certifications?.length) {
          doc.moveDown(this.scaleSectionGap(1.05));
          this.addSectionTitle(doc, labels.certifications);

          for (const cert of cvContent.certifications) {
            doc
              .font('Helvetica')
              .fontSize(11)
              .text(`• ${cert.name} - ${cert.issuer} (${cert.date})`, {
                lineGap: 2.1,
              });
          }
        }

        doc.end();
      } catch (error) {
        this.logger.error('PDF generation failed', error);
        reject(error);
      }
    });
  }

  private addSectionTitle(doc: PDFKit.PDFDocument, title: string) {
    doc.font('Helvetica-Bold').fontSize(15).text(title);
    doc.moveDown(this.scaleSectionGap(0.12));
    this.drawLine(doc);
  }

  private drawLine(doc: PDFKit.PDFDocument) {
    const startX = doc.page.margins.left;
    const endX = doc.page.width - doc.page.margins.right;
    const y = doc.y;
    doc
      .moveTo(startX, y)
      .lineTo(endX, y)
      .strokeColor('#333333')
      .lineWidth(0.5)
      .stroke();
    doc.moveDown(this.scaleSectionGap(0.25));
  }

  private scaleSectionGap(value: number): number {
    return value * this.sectionSpacingMultiplier;
  }

  private getLabels(language?: string) {
    const locale = (language || 'fr').toLowerCase();
    const translations = {
      fr: {
        summary: 'PROFIL PROFESSIONNEL',
        experience: 'EXPÉRIENCE PROFESSIONNELLE',
        education: 'FORMATION',
        skills: 'COMPÉTENCES',
        languages: 'LANGUES',
        certifications: 'CERTIFICATIONS',
        present: 'Présent',
        stack: 'Stack',
        modules: 'Modules',
      },
      en: {
        summary: 'PROFESSIONAL SUMMARY',
        experience: 'PROFESSIONAL EXPERIENCE',
        education: 'EDUCATION',
        skills: 'SKILLS',
        languages: 'LANGUAGES',
        certifications: 'CERTIFICATIONS',
        present: 'Present',
        stack: 'Stack',
        modules: 'Modules',
      },
    } as const;

    if (locale === 'en') {
      return translations.en;
    }

    return translations.fr;
  }

  private formatMonthYear(value?: string, language?: string): string {
    if (!value) {
      return '';
    }

    const match = value.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
      return value;
    }

    const [, year, month] = match;
    if ((language || 'fr').toLowerCase() === 'en') {
      const date = new Date(Number(year), Number(month) - 1, 1);
      return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date);
    }

    return `${month}/${year}`;
  }

  private formatDateRange(
    start?: string,
    end?: string,
    isCurrent?: boolean,
    presentLabel?: string,
    language?: string,
  ): string {
    const startFormatted = this.formatMonthYear(start, language);
    const endFormatted = isCurrent ? presentLabel || 'Present' : this.formatMonthYear(end, language);

    if (startFormatted && endFormatted) {
      return `${startFormatted} - ${endFormatted}`;
    }

    return startFormatted || endFormatted || '';
  }

  private formatLineWithDateRange(
    prefix: string,
    start?: string,
    end?: string,
    isCurrent?: boolean,
    presentLabel?: string,
    language?: string,
  ): string {
    const range = this.formatDateRange(start, end, isCurrent, presentLabel, language);
    if (!range) {
      return prefix;
    }

    return `${prefix} | ${range}`;
  }

  private async buildQrCodeBuffer(cvContent: CvContent): Promise<Buffer | null> {
    if (!cvContent.qrCode?.enabled || !cvContent.qrCode.url) {
      return null;
    }

    try {
      return await QRCode.toBuffer(cvContent.qrCode.url, {
        type: 'png',
        margin: 1,
        width: 180,
      });
    } catch {
      return null;
    }
  }
}
