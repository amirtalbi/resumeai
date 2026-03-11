import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import CvPreview from '~/components/CvPreview.vue';

describe('CvPreview', () => {
  const fullContent = {
    personalInfo: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '+33 6 12 34 56 78',
      address: 'Paris',
      linkedin: 'linkedin.com/in/johndoe',
    },
    summary: 'Experienced full stack developer.',
    experiences: [
      {
        company: 'Tech Corp',
        position: 'Senior Developer',
        startDate: '2020-01',
        endDate: '2023-12',
        current: false,
        description: 'Built web applications.',
        achievements: ['Increased performance by 50%'],
      },
    ],
    education: [
      {
        institution: 'University',
        degree: 'Master',
        field: 'CS',
        startDate: '2015',
        endDate: '2020',
      },
    ],
    skills: [
      { category: 'Frontend', items: ['React', 'Vue.js'] },
    ],
    languages: [
      { name: 'French', level: 'Native' },
      { name: 'English', level: 'Fluent' },
    ],
    certifications: [
      { name: 'AWS SA', issuer: 'Amazon', date: '2022' },
    ],
  };

  it('should render personal info', () => {
    const wrapper = mount(CvPreview, { props: { content: fullContent } });
    expect(wrapper.text()).toContain('John');
    expect(wrapper.text()).toContain('Doe');
    expect(wrapper.text()).toContain('john@example.com');
  });

  it('should render summary', () => {
    const wrapper = mount(CvPreview, { props: { content: fullContent } });
    expect(wrapper.text()).toContain('Experienced full stack developer.');
  });

  it('should render experiences', () => {
    const wrapper = mount(CvPreview, { props: { content: fullContent } });
    expect(wrapper.text()).toContain('Senior Developer');
    expect(wrapper.text()).toContain('Tech Corp');
    expect(wrapper.text()).toContain('Built web applications.');
  });

  it('should render education', () => {
    const wrapper = mount(CvPreview, { props: { content: fullContent } });
    expect(wrapper.text()).toContain('Master');
    expect(wrapper.text()).toContain('University');
  });

  it('should render skills', () => {
    const wrapper = mount(CvPreview, { props: { content: fullContent } });
    expect(wrapper.text()).toContain('React');
    expect(wrapper.text()).toContain('Vue.js');
  });

  it('should render languages', () => {
    const wrapper = mount(CvPreview, { props: { content: fullContent } });
    expect(wrapper.text()).toContain('French');
    expect(wrapper.text()).toContain('English');
  });

  it('should render certifications', () => {
    const wrapper = mount(CvPreview, { props: { content: fullContent } });
    expect(wrapper.text()).toContain('AWS SA');
    expect(wrapper.text()).toContain('Amazon');
  });

  it('should show empty state when no content', () => {
    const emptyContent = {
      personalInfo: { firstName: '', lastName: '', email: '' },
      experiences: [],
      education: [],
      skills: [],
    };
    const wrapper = mount(CvPreview, { props: { content: emptyContent } });
    expect(wrapper.text()).toContain('Remplissez le formulaire');
  });
});
