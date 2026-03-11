import { Injectable, Logger } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { CvContent } from '../cv/entities/cv.entity';

@Injectable()
export class PdfExportService {
  private readonly logger = new Logger(PdfExportService.name);

  async generateAtsFriendlyPdf(cvContent: CvContent): Promise<Buffer> {
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
          .fontSize(24)
          .text(
            `${cvContent.personalInfo.firstName} ${cvContent.personalInfo.lastName}`,
            { align: 'center' },
          );

        doc.moveDown(0.3);

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
          .fontSize(10)
          .text(contactParts.join(' | '), { align: 'center' });

        doc.moveDown(0.5);
        this.drawLine(doc);

        // Summary
        if (cvContent.summary) {
          doc.moveDown(0.5);
          this.addSectionTitle(doc, 'PROFIL PROFESSIONNEL');
          doc.font('Helvetica').fontSize(10).text(cvContent.summary, {
            align: 'justify',
            lineGap: 2,
          });
        }

        // Experience
        if (cvContent.experiences?.length > 0) {
          doc.moveDown(0.5);
          this.addSectionTitle(doc, 'EXPÉRIENCE PROFESSIONNELLE');

          for (const exp of cvContent.experiences) {
            doc.moveDown(0.3);
            doc
              .font('Helvetica-Bold')
              .fontSize(11)
              .text(exp.position, { continued: false });

            doc
              .font('Helvetica')
              .fontSize(10)
              .fillColor('#666666')
              .text(
                `${exp.company} | ${exp.startDate} - ${exp.current ? 'Présent' : exp.endDate || ''}`,
              );
            doc.fillColor('#000000');

            doc.moveDown(0.2);
            doc.font('Helvetica').fontSize(10).text(exp.description, {
              align: 'justify',
              lineGap: 1,
            });

            if (exp.achievements?.length) {
              doc.moveDown(0.2);
              for (const achievement of exp.achievements) {
                doc
                  .font('Helvetica')
                  .fontSize(10)
                  .text(`• ${achievement}`, { indent: 15, lineGap: 1 });
              }
            }
          }
        }

        // Education
        if (cvContent.education?.length > 0) {
          doc.moveDown(0.5);
          this.addSectionTitle(doc, 'FORMATION');

          for (const edu of cvContent.education) {
            doc.moveDown(0.3);
            doc
              .font('Helvetica-Bold')
              .fontSize(11)
              .text(`${edu.degree} - ${edu.field}`);

            doc
              .font('Helvetica')
              .fontSize(10)
              .text(
                `${edu.institution} | ${edu.startDate} - ${edu.endDate || ''}`,
              );

            if (edu.description) {
              doc.moveDown(0.1);
              doc.font('Helvetica').fontSize(10).text(edu.description);
            }
          }
        }

        // Skills
        if (cvContent.skills?.length > 0) {
          doc.moveDown(0.5);
          this.addSectionTitle(doc, 'COMPÉTENCES');

          for (const skillCategory of cvContent.skills) {
            doc.moveDown(0.2);
            doc
              .font('Helvetica-Bold')
              .fontSize(10)
              .text(`${skillCategory.category}: `, { continued: true });
            doc
              .font('Helvetica')
              .fontSize(10)
              .text(skillCategory.items.join(', '));
          }
        }

        // Languages
        if (cvContent.languages?.length) {
          doc.moveDown(0.5);
          this.addSectionTitle(doc, 'LANGUES');

          for (const lang of cvContent.languages) {
            doc
              .font('Helvetica')
              .fontSize(10)
              .text(`• ${lang.name}: ${lang.level}`);
          }
        }

        // Certifications
        if (cvContent.certifications?.length) {
          doc.moveDown(0.5);
          this.addSectionTitle(doc, 'CERTIFICATIONS');

          for (const cert of cvContent.certifications) {
            doc
              .font('Helvetica')
              .fontSize(10)
              .text(`• ${cert.name} - ${cert.issuer} (${cert.date})`);
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
    doc.font('Helvetica-Bold').fontSize(13).text(title);
    doc.moveDown(0.1);
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
    doc.moveDown(0.2);
  }
}
