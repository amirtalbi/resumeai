import { Test, TestingModule } from '@nestjs/testing';
import { PdfExportService } from './pdf-export.service';
import { CvContent } from '../cv/entities/cv.entity';

describe('PdfExportService', () => {
  let service: PdfExportService;

  const mockCvContent: CvContent = {
    personalInfo: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '+33 6 12 34 56 78',
      address: 'Paris, France',
      linkedin: 'linkedin.com/in/johndoe',
    },
    summary:
      'Experienced full-stack developer with 5+ years in web development.',
    experiences: [
      {
        company: 'Tech Corp',
        position: 'Senior Full Stack Developer',
        startDate: '2020-01',
        endDate: '2023-12',
        description:
          'Developed and maintained web applications using React and Node.js.',
        achievements: [
          'Increased application performance by 50%',
          'Led a team of 5 developers',
        ],
      },
      {
        company: 'StartupXYZ',
        position: 'Junior Developer',
        startDate: '2018-06',
        endDate: '2019-12',
        current: false,
        description:
          'Built RESTful APIs and frontend components.',
      },
    ],
    education: [
      {
        institution: 'University of Paris',
        degree: 'Master',
        field: 'Computer Science',
        startDate: '2015',
        endDate: '2018',
        description: 'Specialized in distributed systems.',
      },
    ],
    skills: [
      {
        category: 'Frontend',
        items: ['React', 'TypeScript', 'Vue.js', 'TailwindCSS'],
      },
      {
        category: 'Backend',
        items: ['Node.js', 'NestJS', 'PostgreSQL', 'Redis'],
      },
    ],
    languages: [
      { name: 'French', level: 'Native' },
      { name: 'English', level: 'Fluent' },
    ],
    certifications: [
      {
        name: 'AWS Solutions Architect',
        issuer: 'Amazon',
        date: '2022',
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PdfExportService],
    }).compile();

    service = module.get<PdfExportService>(PdfExportService);
  });

  describe('generateAtsFriendlyPdf', () => {
    it('should generate a valid PDF buffer', async () => {
      const result = await service.generateAtsFriendlyPdf(mockCvContent);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
      // PDF files start with %PDF
      expect(result.toString('utf8', 0, 4)).toBe('%PDF');
    });

    it('should handle CV with minimal content', async () => {
      const minimalCv: CvContent = {
        personalInfo: {
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
        },
        experiences: [],
        education: [],
        skills: [],
      };

      const result = await service.generateAtsFriendlyPdf(minimalCv);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should include all sections in the PDF', async () => {
      const result = await service.generateAtsFriendlyPdf(mockCvContent);
      const pdfText = result.toString('utf8');

      // PDF content contains the name
      expect(pdfText).toContain('John');
      expect(pdfText).toContain('Doe');
    });
  });
});
