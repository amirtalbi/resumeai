import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cv, CvContent } from './entities/cv.entity';
import { CvVersion } from './entities/cv-version.entity';
import { CreateCvDto, UpdateCvDto } from './dto/cv.dto';
import { OllamaService } from '../ai-optimization/ollama.service';

@Injectable()
export class CvService {
  constructor(
    @InjectRepository(Cv)
    private readonly cvRepository: Repository<Cv>,
    @InjectRepository(CvVersion)
    private readonly cvVersionRepository: Repository<CvVersion>,
    private readonly ollamaService: OllamaService,
  ) {}

  async create(userId: string, createCvDto: CreateCvDto): Promise<Cv> {
    const cv = this.cvRepository.create({
      userId,
      title: createCvDto.title,
      contentJson: createCvDto.contentJson,
    });

    const savedCv = await this.cvRepository.save(cv);

    await this.cvVersionRepository.save({
      cvId: savedCv.id,
      versionNumber: 1,
      contentJson: savedCv.contentJson as unknown as Record<string, unknown>,
      modificationsHistory: { action: 'created' },
    });

    return savedCv;
  }

  async findAllByUser(userId: string): Promise<Cv[]> {
    return this.cvRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Cv> {
    const cv = await this.cvRepository.findOne({
      where: { id },
      relations: ['versions'],
    });

    if (!cv) {
      throw new NotFoundException('CV not found');
    }

    if (cv.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return cv;
  }

  async update(id: string, userId: string, updateCvDto: UpdateCvDto): Promise<Cv> {
    const cv = await this.findOne(id, userId);

    const latestVersion = await this.cvVersionRepository.findOne({
      where: { cvId: id },
      order: { versionNumber: 'DESC' },
    });

    const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;

    if (updateCvDto.title) cv.title = updateCvDto.title;
    if (updateCvDto.contentJson) cv.contentJson = updateCvDto.contentJson;

    const savedCv = await this.cvRepository.save(cv);

    await this.cvVersionRepository.save({
      cvId: savedCv.id,
      versionNumber: nextVersionNumber,
      contentJson: savedCv.contentJson as unknown as Record<string, unknown>,
      modificationsHistory: {
        action: 'updated',
        changes: updateCvDto,
      },
    });

    return savedCv;
  }

  async remove(id: string, userId: string): Promise<void> {
    const cv = await this.findOne(id, userId);
    await this.cvRepository.remove(cv);
  }

  async getVersions(cvId: string, userId: string): Promise<CvVersion[]> {
    await this.findOne(cvId, userId);
    return this.cvVersionRepository.find({
      where: { cvId },
      order: { versionNumber: 'DESC' },
    });
  }

  async importFromPdfText(
    userId: string,
    title: string,
    extractedText: string,
  ): Promise<Cv> {
    const contentJson = await this.parseExtractedText(extractedText);
    return this.create(userId, { title, contentJson });
  }

  private async parseExtractedText(text: string): Promise<CvContent> {
    const structured = this.parseStructuredCv(text);
    if (structured) {
      return structured;
    }

    const aiParsed = await this.parseWithAi(text);
    if (aiParsed) {
      return aiParsed;
    }

    const lines = text.split('\n').filter((l) => l.trim());

    return {
      language: this.detectLanguage(text),
      personalInfo: {
        firstName: '',
        lastName: '',
        email: this.extractEmail(text) || '',
        phone: this.extractPhone(text),
      },
      summary: lines.slice(0, 3).join(' '),
      experiences: [],
      education: [],
      skills: [
        {
          category: 'Extracted',
          items: this.extractSkillKeywords(text),
        },
      ],
      languages: [],
      certifications: [],
    } as CvContent;
  }

  private parseStructuredCv(text: string): CvContent | null {
    const lines = text
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 5) {
      return null;
    }

    const headings = this.findSectionHeadings(lines);
    if (!headings.length) {
      return null;
    }

    const sectionMap = this.buildSectionMap(lines, headings);
    const headerLines = lines.slice(0, headings[0].index);
    const personalInfo = this.parseHeader(headerLines, text);

    const summary = this.joinSection(sectionMap.summary);
    const experiences = this.parseExperiences(sectionMap.experience);
    const education = this.parseEducation(sectionMap.education);
    const skills = this.parseSkills(sectionMap.skills);

    const score =
      (personalInfo.firstName || personalInfo.lastName ? 1 : 0) +
      (summary ? 1 : 0) +
      (experiences.length ? 1 : 0) +
      (skills.length ? 1 : 0);

    if (score < 2) {
      return null;
    }

    return {
      language: this.detectLanguage(text),
      personalInfo,
      summary,
      experiences,
      education,
      skills,
      languages: [],
      certifications: [],
    } as CvContent;
  }

  private findSectionHeadings(lines: string[]) {
    const headingMap = {
      summary: ['PROFESSIONAL SUMMARY', 'PROFILE', 'PROFIL PROFESSIONNEL', 'RESUME PROFESSIONNEL'],
      experience: ['PROFESSIONAL EXPERIENCE', 'EXPERIENCE', 'EXPERIENCES', 'EXPERIENCE PROFESSIONNELLE'],
      education: ['EDUCATION', 'FORMATION'],
      skills: ['SKILLS', 'COMPETENCES', 'COMPETENCES TECHNIQUES'],
    } as const;

    const headings: Array<{ index: number; type: keyof typeof headingMap }> = [];
    lines.forEach((line, index) => {
      const normalized = line.toUpperCase();
      (Object.keys(headingMap) as Array<keyof typeof headingMap>).forEach((type) => {
        if (headingMap[type].some((label) => normalized === label)) {
          headings.push({ index, type });
        }
      });
    });

    return headings.sort((a, b) => a.index - b.index);
  }

  private buildSectionMap(
    lines: string[],
    headings: Array<{ index: number; type: string }>,
  ) {
    const result: Record<string, string[]> = {
      summary: [],
      experience: [],
      education: [],
      skills: [],
    };

    headings.forEach((heading, idx) => {
      const start = heading.index + 1;
      const end = idx + 1 < headings.length ? headings[idx + 1].index : lines.length;
      const chunk = lines.slice(start, end).filter(Boolean);
      if (result[heading.type]) {
        result[heading.type] = chunk;
      }
    });

    return result;
  }

  private parseHeader(headerLines: string[], fullText: string) {
    const nameLine = headerLines[0] || '';
    const nameParts = nameLine.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ');

    const jobTitle = headerLines.find((line) =>
      line && !line.includes('@') && !line.includes('|') && line !== nameLine,
    ) || '';

    const contactLine = headerLines.find((line) => line.includes('@') || this.extractPhone(line));

    const email = this.extractEmail(fullText) || '';
    const phone = this.extractPhone(fullText);
    const address = contactLine?.split('|').map((s) => s.trim()).pop();

    return {
      firstName,
      lastName,
      jobTitle,
      email,
      phone,
      address: address && address !== email ? address : undefined,
      linkedin: '',
      website: '',
    };
  }

  private joinSection(lines: string[] | undefined): string {
    return (lines || []).join(' ').trim();
  }

  private parseExperiences(lines: string[] | undefined) {
    if (!lines?.length) return [];

    const results: CvContent['experiences'] = [];
    let current: CvContent['experiences'][number] | null = null;
    let descriptionLines: string[] = [];

    const flush = () => {
      if (!current) return;
      current.description = descriptionLines.join(' ').trim();
      results.push(current);
      current = null;
      descriptionLines = [];
    };

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];

      if (this.isCompanyLine(line)) {
        flush();
        current = {
          company: line,
          position: '',
          startDate: '',
          endDate: '',
          current: false,
          description: '',
          achievements: [],
          tags: [],
        };
        continue;
      }

      if (current && !current.position && this.looksLikeRoleLine(line)) {
        const parsed = this.parseRoleAndDates(line);
        current.position = parsed.role || line;
        current.startDate = parsed.startDate;
        current.endDate = parsed.endDate;
        current.current = parsed.current;
        continue;
      }

      if (current && line.toLowerCase().startsWith('stack:')) {
        current.tags = line
          .replace(/^stack:/i, '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
        continue;
      }

      if (current) {
        descriptionLines.push(line);
      }
    }

    flush();
    return results;
  }

  private parseEducation(lines: string[] | undefined) {
    if (!lines?.length) return [];

    const results: CvContent['education'] = [];
    let current: CvContent['education'][number] | null = null;

    const flush = () => {
      if (!current) return;
      results.push(current);
      current = null;
    };

    for (const line of lines) {
      if (!current) {
        current = {
          institution: '',
          degree: line,
          field: '',
          startDate: '',
          endDate: '',
          description: '',
          tags: [],
        };
        continue;
      }

      if (!current.institution && !this.containsYear(line)) {
        current.institution = line;
        continue;
      }

      const dates = this.extractYearRange(line);
      if (dates && !current.startDate && !current.endDate) {
        current.startDate = dates.startDate;
        current.endDate = dates.endDate;
        continue;
      }

      current.description = [current.description, line].filter(Boolean).join(' ');
    }

    flush();
    return results;
  }

  private parseSkills(lines: string[] | undefined) {
    if (!lines?.length) return [];

    const results: CvContent['skills'] = [];
    lines.forEach((line) => {
      const [category, rest] = line.split(':');
      if (!rest) return;
      const items = rest.split(',').map((item) => item.trim()).filter(Boolean);
      results.push({ category: category.trim(), items });
    });

    if (!results.length) {
      return [
        {
          category: 'Extracted',
          items: this.extractSkillKeywords(lines.join(' ')),
        },
      ];
    }

    return results;
  }

  private isCompanyLine(line: string): boolean {
    return !line.includes('|') && !this.containsYear(line) && line.length > 1;
  }

  private looksLikeRoleLine(line: string): boolean {
    return line.includes('|') || this.containsYear(line);
  }

  private parseRoleAndDates(line: string) {
    const [rolePart, datePart] = line.split('|').map((part) => part.trim());
    const range = this.extractMonthYearRange(datePart || line);
    return {
      role: rolePart || '',
      startDate: range.startDate,
      endDate: range.endDate,
      current: range.current,
    };
  }

  private extractMonthYearRange(value: string) {
    const lower = value.toLowerCase();
    const current = /present|present\b|actuel|present\b|aujourd'hui/i.test(value);
    const match = value.match(/([A-Za-zÀ-ÿ]{3,})\s+(\d{4}).*?([A-Za-zÀ-ÿ]{3,}|present|actuel)\s*(\d{4})?/i);
    if (!match) {
      return { startDate: '', endDate: '', current: false };
    }

    const startMonth = this.monthToNumber(match[1]);
    const startYear = match[2];
    const endMonthText = match[3];
    const endYear = match[4] || '';
    const endMonth = this.monthToNumber(endMonthText);
    const endDate = current || !endMonth ? '' : `${endYear}-${endMonth}`;

    return {
      startDate: startMonth ? `${startYear}-${startMonth}` : '',
      endDate,
      current,
    };
  }

  private extractYearRange(value: string) {
    const match = value.match(/(\d{4}).*?(\d{4})/);
    if (!match) return null;
    return { startDate: match[1], endDate: match[2] };
  }

  private containsYear(value: string): boolean {
    return /\d{4}/.test(value);
  }

  private monthToNumber(month: string): string {
    const map: Record<string, string> = {
      jan: '01', january: '01', janv: '01', janvier: '01',
      feb: '02', fev: '02', fevr: '02', fevrier: '02', february: '02',
      mar: '03', mars: '03', march: '03',
      apr: '04', avril: '04', april: '04',
      may: '05', mai: '05',
      jun: '06', juin: '06', june: '06',
      jul: '07', juillet: '07', july: '07',
      aug: '08', aout: '08', august: '08',
      sep: '09', sept: '09', september: '09', septembre: '09',
      oct: '10', octobre: '10', october: '10',
      nov: '11', novembre: '11', november: '11',
      dec: '12', decembre: '12', december: '12',
    };
    const key = month.toLowerCase().replace(/[^a-z]/g, '');
    return map[key] || '';
  }

  private async parseWithAi(text: string): Promise<CvContent | null> {
    try {
      const prompt = this.buildCvImportPrompt(text);
      const response = await this.ollamaService.generate(prompt);
      const jsonString = this.extractLargestJsonObject(response);
      if (!jsonString) {
        return null;
      }

      const parsed = JSON.parse(jsonString) as Partial<CvContent>;
      return this.sanitizeCvContent(parsed, text);
    } catch {
      return null;
    }
  }

  private buildCvImportPrompt(text: string): string {
    return `Tu es un expert en parsing de CV. Tu dois extraire les informations du texte suivant.

INSTRUCTIONS STRICTES:
1. N'invente AUCUNE information.
2. Utilise uniquement les informations présentes dans le texte.
3. Si une donnée est absente, laisse la valeur vide ou un tableau vide.
4. Ne déduis pas une entreprise, un poste, une date, un diplôme, une compétence, un lien ou un niveau.
5. Réponds UNIQUEMENT avec un JSON valide, sans texte additionnel.

FORMAT ATTENDU (exemple):
{
  "language": "fr",
  "personalInfo": {
    "firstName": "",
    "lastName": "",
    "jobTitle": "",
    "email": "",
    "phone": "",
    "address": "",
    "linkedin": "",
    "website": ""
  },
  "summary": "",
  "experiences": [
    {
      "company": "",
      "position": "",
      "startDate": "",
      "endDate": "",
      "current": false,
      "description": "",
      "achievements": [],
      "tags": []
    }
  ],
  "education": [
    {
      "institution": "",
      "degree": "",
      "field": "",
      "startDate": "",
      "endDate": "",
      "description": "",
      "tags": []
    }
  ],
  "skills": [
    { "category": "", "items": [] }
  ],
  "languages": [
    { "name": "", "level": "" }
  ],
  "certifications": [
    { "name": "", "issuer": "", "date": "" }
  ]
}

TEXTE DU CV:
${text}
`;
  }

  private sanitizeCvContent(parsed: Partial<CvContent>, rawText: string): CvContent {
    const safeArray = <T>(value: T[] | undefined): T[] => Array.isArray(value) ? value : [];
    const safeString = (value: unknown): string => (typeof value === 'string' ? value : '');

    return {
      language: safeString(parsed.language) || this.detectLanguage(rawText),
      personalInfo: {
        firstName: safeString(parsed.personalInfo?.firstName),
        lastName: safeString(parsed.personalInfo?.lastName),
        jobTitle: safeString(parsed.personalInfo?.jobTitle),
        email: safeString(parsed.personalInfo?.email) || this.extractEmail(rawText) || '',
        phone: safeString(parsed.personalInfo?.phone) || this.extractPhone(rawText),
        address: safeString(parsed.personalInfo?.address),
        linkedin: safeString(parsed.personalInfo?.linkedin),
        website: safeString(parsed.personalInfo?.website),
      },
      summary: safeString(parsed.summary),
      experiences: safeArray(parsed.experiences).map((exp) => ({
        company: safeString(exp.company),
        position: safeString(exp.position),
        startDate: safeString(exp.startDate),
        endDate: safeString(exp.endDate),
        current: Boolean(exp.current),
        description: safeString(exp.description),
        achievements: safeArray(exp.achievements).map((a) => safeString(a)).filter(Boolean),
        tags: safeArray(exp.tags).map((t) => safeString(t)).filter(Boolean),
      })),
      education: safeArray(parsed.education).map((edu) => ({
        institution: safeString(edu.institution),
        degree: safeString(edu.degree),
        field: safeString(edu.field),
        startDate: safeString(edu.startDate),
        endDate: safeString(edu.endDate),
        description: safeString(edu.description),
        tags: safeArray(edu.tags).map((t) => safeString(t)).filter(Boolean),
      })),
      skills: safeArray(parsed.skills).map((skill) => ({
        category: safeString(skill.category),
        items: safeArray(skill.items).map((item) => safeString(item)).filter(Boolean),
      })),
      languages: safeArray(parsed.languages).map((lang) => ({
        name: safeString(lang.name),
        level: safeString(lang.level),
      })),
      certifications: safeArray(parsed.certifications).map((cert) => ({
        name: safeString(cert.name),
        issuer: safeString(cert.issuer),
        date: safeString(cert.date),
      })),
    };
  }

  private extractLargestJsonObject(response: string): string | null {
    const firstBraceIndex = response.indexOf('{');
    if (firstBraceIndex === -1) {
      return null;
    }

    return this.extractBalancedSegment(response, firstBraceIndex, '{', '}');
  }

  private extractBalancedSegment(
    text: string,
    startIndex: number,
    openChar: '{' | '[',
    closeChar: '}' | ']',
  ): string | null {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = startIndex; index < text.length; index += 1) {
      const character = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === '\\') {
          escaped = true;
        } else if (character === '"') {
          inString = false;
        }
        continue;
      }

      if (character === '"') {
        inString = true;
        continue;
      }

      if (character === openChar) {
        depth += 1;
      } else if (character === closeChar) {
        depth -= 1;
        if (depth === 0) {
          return text.slice(startIndex, index + 1);
        }
      }
    }

    return null;
  }

  private detectLanguage(text: string): 'fr' | 'en' {
    const lower = text.toLowerCase();
    const frenchMarkers = ['le ', 'la ', 'les ', 'et ', 'avec ', 'pour ', 'experience', 'formation'];
    const englishMarkers = ['the ', 'and ', 'with ', 'for ', 'experience', 'education', 'skills'];
    const frScore = frenchMarkers.reduce((score, marker) => score + (lower.includes(marker) ? 1 : 0), 0);
    const enScore = englishMarkers.reduce((score, marker) => score + (lower.includes(marker) ? 1 : 0), 0);
    return frScore >= enScore ? 'fr' : 'en';
  }

  private extractEmail(text: string): string | undefined {
    const match = text.match(/[\w.-]+@[\w.-]+\.\w+/);
    return match?.[0];
  }

  private extractPhone(text: string): string | undefined {
    const match = text.match(
      /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}/,
    );
    return match?.[0];
  }

  private extractSkillKeywords(text: string): string[] {
    const commonSkills = [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'React', 'Angular',
      'Vue', 'Node.js', 'NestJS', 'Express', 'Django', 'Flask', 'Spring',
      'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'SQL', 'MongoDB',
      'PostgreSQL', 'Redis', 'Git', 'CI/CD', 'Agile', 'Scrum',
      'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch',
    ];

    return commonSkills.filter((skill) =>
      text.toLowerCase().includes(skill.toLowerCase()),
    );
  }
}
