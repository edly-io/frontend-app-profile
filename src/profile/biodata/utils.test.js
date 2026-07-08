import { BIODATA_SECTION_MAP } from './config';
import {
  getSectionErrorFields,
  getSectionErrorSummary,
  sectionIsComplete,
  validateSectionDraft,
} from './utils';

describe('biodata utils', () => {
  describe('validateSectionDraft', () => {
    it('rejects digits in district and religion fields', () => {
      const result = validateSectionDraft(BIODATA_SECTION_MAP.basicInformation, {
        profile_title: 'mr',
        preferred_calling_name: 'John',
        place_of_birth: 'Lahore',
        district_of_domicile: 'Lahore1',
        province_of_domicile: 'Punjab',
        religion: 'Islam2',
        marital_status: 'single',
        number_of_children: '0',
        sons: '0',
        daughters: '0',
        cnic_front: 'front.pdf',
        cnic_back: 'back.pdf',
        domicile_file: 'domicile.pdf',
      });

      expect(result.district_of_domicile).toEqual({
        userMessage: 'District of Domicile cannot contain numbers.',
      });
      expect(result.religion).toEqual({
        userMessage: 'Religion cannot contain numbers.',
      });
    });

    it('rejects digits and special characters in calling name and place of birth', () => {
      const result = validateSectionDraft(BIODATA_SECTION_MAP.basicInformation, {
        profile_title: 'mr',
        preferred_calling_name: 'John1',
        place_of_birth: 'Lahore!',
        district_of_domicile: 'Lahore',
        province_of_domicile: 'Punjab',
        religion: 'Islam',
        marital_status: 'single',
        number_of_children: '0',
        sons: '0',
        daughters: '0',
        cnic_front: 'front.pdf',
        cnic_back: 'back.pdf',
        domicile_file: 'domicile.pdf',
      });

      expect(result.preferred_calling_name).toEqual({
        userMessage: 'Preferred / calling name cannot contain numbers.',
      });
      expect(result.place_of_birth).toEqual({
        userMessage: 'Place of Birth can only contain letters and spaces.',
      });
    });

    it('rejects numeric-only grade, institute, and subjects values in education rows', () => {
      const result = validateSectionDraft(BIODATA_SECTION_MAP.education, {
        education_records: [{
          rowId: 'row-1',
          educational_institute: '12345',
          attended_from: '2015-01-01',
          attended_to: '2018-01-01',
          examination: 'Bachelors',
          year_of_passing: '2018',
          grade_division: '123',
          subjects_studied: '456',
          education_degree_attachment: 'degree.pdf',
        }],
      });

      expect(result['education_records.row-1.educational_institute']).toEqual({
        userMessage: 'Educational Institute cannot be numbers only.',
      });
      expect(result['education_records.row-1.grade_division']).toEqual({
        userMessage: 'Grade / Division cannot be numbers only.',
      });
      expect(result['education_records.row-1.subjects_studied']).toEqual({
        userMessage: 'Subjects Studied cannot be numbers only.',
      });
    });

    it('rejects a symbol-only educational institute instead of silently accepting it', () => {
      const result = validateSectionDraft(BIODATA_SECTION_MAP.education, {
        education_records: [{
          rowId: 'row-1',
          educational_institute: '----',
          attended_from: '2015-01-01',
          attended_to: '2018-01-01',
          examination: 'Bachelors',
          year_of_passing: '2018',
          grade_division: 'First Division',
          subjects_studied: 'Computer Science',
          education_degree_attachment: 'degree.pdf',
        }],
      });

      expect(result['education_records.row-1.educational_institute']).toEqual({
        userMessage: 'Educational Institute must contain at least one letter.',
      });
    });

    it('rejects a symbol-only CSS roll number', () => {
      const result = validateSectionDraft(BIODATA_SECTION_MAP.cssExamDetails, {
        css_roll_number: '----',
        css_merit_position: '1',
        css_chances_availed: '1',
        applied_for_forthcoming_css_exam: 'Yes',
        intend_to_sit_for_forthcoming_css_exam: 'No',
        last_chance_date_year: '2026',
      });

      expect(result.css_roll_number).toEqual({
        userMessage: 'CSS Roll Number cannot be only symbols.',
      });
    });

    it('rejects a symbol-only present residential address', () => {
      const result = validateSectionDraft(BIODATA_SECTION_MAP.contactInformation, {
        permanent_residential_address: 'Main Street',
        permanent_phone_number: '03001234567',
        present_residential_address: '-=--',
        present_phone_number: '03001234567',
        contact_address_lahore: 'Lahore',
        lahore_phone_number: '03001234567',
        mobile_number: '03001234567',
        contact_email: 'valid@example.com',
      });

      expect(result.present_residential_address).toEqual({
        userMessage: 'Present residential address must contain at least one letter.',
      });
    });

    it('allows digits in employment gap details now that it needs real dates', () => {
      const result = validateSectionDraft(BIODATA_SECTION_MAP.employment, {
        is_first_job: 'Yes',
        first_employment_gap_details_after_education: 'Prepared for CSS exam from 2019 to 2021',
      });

      expect(result.first_employment_gap_details_after_education).toBeUndefined();
    });

    it('does not apply free-text format rules to the purpose-of-visit select field', () => {
      const result = validateSectionDraft(BIODATA_SECTION_MAP.foreignVisits, {
        foreign_visits_not_applicable: false,
        foreign_visits: [{
          rowId: 'visit-1',
          country: 'Turkey',
          purpose_of_visit: 'training',
          self_or_sponsored_visit: 'Self',
          from: '2022-05-01',
          to: '2022-05-10',
        }],
      });

      expect(result['foreign_visits.visit-1.purpose_of_visit']).toBeUndefined();
    });

    it('rejects future education dates and future year of passing', () => {
      const nextYear = String(new Date().getFullYear() + 1);
      const result = validateSectionDraft(BIODATA_SECTION_MAP.education, {
        education_records: [{
          rowId: 'row-1',
          educational_institute: 'Punjab University',
          attended_from: `${nextYear}-01-01`,
          attended_to: `${nextYear}-12-31`,
          examination: 'Bachelors',
          year_of_passing: nextYear,
          grade_division: 'First Division',
          subjects_studied: 'Computer Science',
          education_degree_attachment: 'degree.pdf',
        }],
      });

      expect(result['education_records.row-1.attended_from']).toEqual({
        userMessage: 'Date cannot be in the future.',
      });
      expect(result['education_records.row-1.attended_to']).toEqual({
        userMessage: 'Date cannot be in the future.',
      });
      expect(result['education_records.row-1.year_of_passing']).toEqual({
        userMessage: 'Year of Passing must be a valid year and cannot be in the future.',
      });
    });

    it('requires year of passing to be a valid four digit year before cross-field year comparison runs', () => {
      const result = validateSectionDraft(BIODATA_SECTION_MAP.education, {
        education_records: [{
          rowId: 'row-1',
          educational_institute: 'Punjab University',
          attended_from: '2015-01-01',
          attended_to: '2018-01-01',
          examination: 'Bachelors',
          year_of_passing: '12ab!',
          grade_division: 'First Division',
          subjects_studied: 'Computer Science',
          education_degree_attachment: 'degree.pdf',
        }],
      });

      expect(result['education_records.row-1.year_of_passing']).toEqual({
        userMessage: 'Year of Passing must be a valid year and cannot be in the future.',
      });
    });

    it('rejects invalid CSS year and non-negative numeric CSS values', () => {
      const result = validateSectionDraft(BIODATA_SECTION_MAP.cssExamDetails, {
        css_roll_number: '1234',
        css_merit_position: '1',
        css_chances_availed: '-1',
        applied_for_forthcoming_css_exam: 'Yes',
        intend_to_sit_for_forthcoming_css_exam: 'No',
        last_chance_date_year: 'abcd',
        css_subject_marks: [
          {
            rowId: 'comp-1', subject: 'English Essay', total_marks: '100', marks_obtained: '-5',
          },
          {
            rowId: 'comp-2', subject: 'English Precise and Composition', total_marks: '100', marks_obtained: '50',
          },
          {
            rowId: 'comp-3', subject: 'General Science and Ability', total_marks: '100', marks_obtained: '50',
          },
          {
            rowId: 'comp-4', subject: 'Current Affairs', total_marks: '100', marks_obtained: '50',
          },
          {
            rowId: 'comp-5', subject: 'Pakistan Affairs', total_marks: '100', marks_obtained: '50',
          },
          {
            rowId: 'comp-6', subject: 'Islamic Studies', total_marks: '100', marks_obtained: '50',
          },
          {
            rowId: 'comp-7', subject: 'Viva Voce', total_marks: '300', marks_obtained: '150',
          },
          {
            rowId: 'el-1', subject: 'Psychology', total_marks: '100', marks_obtained: '70',
          },
          {
            rowId: 'el-2', subject: 'Psychology', total_marks: '100', marks_obtained: '80',
          },
          {
            rowId: 'el-3', subject: 'Geography', total_marks: '100', marks_obtained: '60',
          },
          {
            rowId: 'el-4', subject: 'History', total_marks: '100', marks_obtained: '55',
          },
          {
            rowId: 'el-5', subject: 'Sociology', total_marks: '100', marks_obtained: '65',
          },
          {
            rowId: 'el-6', subject: 'Public Administration', total_marks: '100', marks_obtained: '75',
          },
        ],
      });

      expect(result.css_chances_availed).toEqual({
        userMessage: 'Value cannot be negative.',
      });
      expect(result.last_chance_date_year).toEqual({
        userMessage: 'Last chance year must be a number.',
      });
      expect(result['css_subject_marks.comp-1.marks_obtained']).toEqual({
        userMessage: 'Value cannot be negative.',
      });
      expect(result['css_subject_marks.el-1.subject']).toEqual({
        userMessage: 'Duplicate elective subjects are not allowed.',
      });
      expect(result['css_subject_marks.el-2.subject']).toEqual({
        userMessage: 'Duplicate elective subjects are not allowed.',
      });
    });

    it('rejects a future last chance year', () => {
      const nextYear = String(new Date().getFullYear() + 1);
      const result = validateSectionDraft(BIODATA_SECTION_MAP.cssExamDetails, {
        css_roll_number: '1234',
        css_merit_position: '1',
        css_chances_availed: '1',
        applied_for_forthcoming_css_exam: 'Yes',
        intend_to_sit_for_forthcoming_css_exam: 'No',
        last_chance_date_year: nextYear,
        css_subject_marks: [
          {
            rowId: 'comp-1', subject: 'English Essay', total_marks: '100', marks_obtained: '50',
          },
          {
            rowId: 'comp-2', subject: 'English Precise and Composition', total_marks: '100', marks_obtained: '50',
          },
          {
            rowId: 'comp-3', subject: 'General Science and Ability', total_marks: '100', marks_obtained: '50',
          },
          {
            rowId: 'comp-4', subject: 'Current Affairs', total_marks: '100', marks_obtained: '50',
          },
          {
            rowId: 'comp-5', subject: 'Pakistan Affairs', total_marks: '100', marks_obtained: '50',
          },
          {
            rowId: 'comp-6', subject: 'Islamic Studies', total_marks: '100', marks_obtained: '50',
          },
          {
            rowId: 'comp-7', subject: 'Viva Voce', total_marks: '300', marks_obtained: '150',
          },
          {
            rowId: 'el-1', subject: 'Psychology', total_marks: '100', marks_obtained: '70',
          },
          {
            rowId: 'el-2', subject: 'Geography', total_marks: '100', marks_obtained: '80',
          },
          {
            rowId: 'el-3', subject: 'History', total_marks: '100', marks_obtained: '60',
          },
          {
            rowId: 'el-4', subject: 'Sociology', total_marks: '100', marks_obtained: '55',
          },
          {
            rowId: 'el-5', subject: 'Public Administration', total_marks: '100', marks_obtained: '65',
          },
          {
            rowId: 'el-6', subject: 'International Relations', total_marks: '100', marks_obtained: '75',
          },
        ],
      });

      expect(result.last_chance_date_year).toEqual({
        userMessage: 'Last chance year must be a valid year and cannot be in the future.',
      });
    });

    it('rejects future dates and invalid date order in foreign visits', () => {
      const nextYear = String(new Date().getFullYear() + 1);
      const result = validateSectionDraft(BIODATA_SECTION_MAP.foreignVisits, {
        foreign_visits_not_applicable: false,
        foreign_visits: [{
          rowId: 'visit-1',
          country: 'Turkey',
          purpose_of_visit: 'Training',
          self_or_sponsored_visit: 'Self',
          from: `${nextYear}-01-01`,
          to: '2020-01-01',
        }],
      });

      expect(result['foreign_visits.visit-1.from']).toEqual({
        userMessage: 'Date cannot be in the future.',
      });
      expect(result['foreign_visits.visit-1.to']).toEqual({
        userMessage: 'To date must be on or after From date.',
      });
    });

    it('rejects a foreign visit to date in the future even when it is on or after from date', () => {
      const nextYear = String(new Date().getFullYear() + 1);
      const result = validateSectionDraft(BIODATA_SECTION_MAP.foreignVisits, {
        foreign_visits_not_applicable: false,
        foreign_visits: [{
          rowId: 'visit-1',
          country: 'Iran',
          purpose_of_visit: 'Casual',
          self_or_sponsored_visit: 'Self',
          from: '2026-06-28',
          to: `${nextYear}-01-01`,
        }],
      });

      expect(result['foreign_visits.visit-1.from']).toBeUndefined();
      expect(result['foreign_visits.visit-1.to']).toEqual({
        userMessage: 'Date cannot be in the future.',
      });
    });

    it('rejects future dates and invalid date order in employment records', () => {
      const nextYear = String(new Date().getFullYear() + 1);
      const result = validateSectionDraft(BIODATA_SECTION_MAP.employment, {
        is_first_job: 'No',
        employment_records: [{
          rowId: 'job-1',
          organization_office: 'FBR',
          designation_place_of_posting: 'Officer',
          from: `${nextYear}-01-01`,
          to: '2020-01-01',
        }],
      });

      expect(result['employment_records.job-1.from']).toEqual({
        userMessage: 'Date cannot be in the future.',
      });
      expect(result['employment_records.job-1.to']).toEqual({
        userMessage: 'To date must be on or after From date.',
      });
    });

    it('rejects an employment to date in the future even when it is on or after from date', () => {
      const nextYear = String(new Date().getFullYear() + 1);
      const result = validateSectionDraft(BIODATA_SECTION_MAP.employment, {
        is_first_job: 'No',
        employment_records: [{
          rowId: 'job-1',
          organization_office: 'FBR',
          designation_place_of_posting: 'Officer',
          from: '2026-06-28',
          to: `${nextYear}-01-01`,
        }],
      });

      expect(result['employment_records.job-1.from']).toBeUndefined();
      expect(result['employment_records.job-1.to']).toEqual({
        userMessage: 'Date cannot be in the future.',
      });
    });

    it('rejects future dates in government service details', () => {
      const nextYear = String(new Date().getFullYear() + 1);
      const result = validateSectionDraft(BIODATA_SECTION_MAP.governmentServiceDetails, {
        date_joining_any_govt_service_before_csa: `${nextYear}-01-01`,
        department_name: 'FBR',
        date_joining_civil_services_academy_lahore: `${nextYear}-02-01`,
        date_joining_transfer_inland_revenue_service: `${nextYear}-03-01`,
        other_income_source_besides_salary: 'No',
        other_income_details: '',
      });

      expect(result.date_joining_any_govt_service_before_csa).toEqual({
        userMessage: 'Date cannot be in the future.',
      });
      expect(result.date_joining_civil_services_academy_lahore).toEqual({
        userMessage: 'Date cannot be in the future.',
      });
      expect(result.date_joining_transfer_inland_revenue_service).toEqual({
        userMessage: 'Date cannot be in the future.',
      });
    });

    it('allows address punctuation while keeping email-specific validation for email fields', () => {
      const result = validateSectionDraft(BIODATA_SECTION_MAP.contactInformation, {
        permanent_residential_address: 'House #12, Street 4-B',
        permanent_phone_number: '923001234567',
        present_residential_address: 'Flat 7/A, Block-C',
        present_phone_number: '03001234567',
        contact_address_lahore: 'Lahore Cantt, Sector 11',
        lahore_phone_number: '923001234567',
        mobile_number: '03001234567',
        contact_email: 'not-an-email',
      });

      expect(result.permanent_residential_address).toBeUndefined();
      expect(result.present_residential_address).toBeUndefined();
      expect(result.contact_address_lahore).toBeUndefined();
      expect(result.contact_email).toEqual({
        userMessage: 'Enter a valid email address.',
      });
    });

    it('rejects non-numeric phone number input', () => {
      const result = validateSectionDraft(BIODATA_SECTION_MAP.contactInformation, {
        permanent_residential_address: 'Main Street',
        permanent_phone_number: '0300-ABC-4567',
        present_residential_address: 'Main Street',
        present_phone_number: '03001234567',
        contact_address_lahore: 'Lahore',
        lahore_phone_number: '03001234567',
        mobile_number: '03001234567',
        contact_email: 'valid@example.com',
      });

      expect(result.permanent_phone_number).toEqual({
        userMessage: 'Enter a valid Pakistani mobile number in the format +923XXXXXXXXX.',
      });
    });

    it('allows descriptive text with numbers and punctuation in achievement fields', () => {
      const result = validateSectionDraft(BIODATA_SECTION_MAP.achievements, {
        distinctions: 'Top 10 position in 2024, Batch #3',
        scholarships: 'Merit scholarship (Phase-2) worth Rs. 50,000',
        awards: 'Best Employee Award - 2023',
      });

      expect(result.distinctions).toBeUndefined();
      expect(result.scholarships).toBeUndefined();
      expect(result.awards).toBeUndefined();
    });
  });

  describe('sectionIsComplete', () => {
    it('treats repeatable N/A sections as complete when submitted', () => {
      expect(sectionIsComplete(BIODATA_SECTION_MAP.competitiveExaminations, {
        competitive_examinations_not_applicable: true,
        competitiveExaminations_is_submitted: true,
      })).toBe(true);
    });

    it('does not treat a foreign visit row as complete when a required select is empty', () => {
      expect(sectionIsComplete(BIODATA_SECTION_MAP.foreignVisits, {
        foreign_visits_not_applicable: false,
        foreign_visits: [{
          rowId: 'visit-1',
          country: 'U.A.E',
          purpose_of_visit: 'self',
          self_or_sponsored_visit: '',
          from: '2023-02-08',
          to: '2023-02-10',
        }],
      })).toBe(false);
    });

    it('treats a foreign visit row as complete once every required field is filled', () => {
      expect(sectionIsComplete(BIODATA_SECTION_MAP.foreignVisits, {
        foreign_visits_not_applicable: false,
        foreign_visits: [{
          rowId: 'visit-1',
          country: 'U.A.E',
          purpose_of_visit: 'self',
          self_or_sponsored_visit: 'self',
          from: '2023-02-08',
          to: '2023-02-10',
        }],
      })).toBe(true);
    });
  });

  describe('getSectionErrorSummary', () => {
    it('shows the exact elective-subject-count message at the top instead of a generic field name', () => {
      const errors = {
        css_subject_marks: {
          userMessage: 'Add exactly 6 elective subjects.',
        },
      };

      expect(getSectionErrorSummary(BIODATA_SECTION_MAP.cssExamDetails, errors, {}))
        .toBe('Add exactly 6 elective subjects.');
      expect(getSectionErrorFields(BIODATA_SECTION_MAP.cssExamDetails, errors, {})).toContainEqual({
        fieldName: 'css_subject_marks',
        label: 'Elective subjects',
      });
    });
  });
});
