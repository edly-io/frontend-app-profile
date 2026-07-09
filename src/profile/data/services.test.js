import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { logError } from '@edx/frontend-platform/logging';
import {
  getAccount,
  getBiodataProfile,
  patchProfile,
  postProfilePhoto,
  deleteProfilePhoto,
  getPreferences,
  patchPreferences,
  getCourseCertificates,
  getCountryList,
  saveBiodataSection,
  validateBiodataSection,
} from './services';

import { FIELD_LABELS } from './constants';

import { camelCaseObject, snakeCaseObject, convertKeyNames } from '../utils';

// --- Mocks ---
jest.mock('@edx/frontend-platform', () => ({
  ensureConfig: jest.fn(),
  getConfig: jest.fn(() => ({
    LMS_BASE_URL: 'http://fake-lms',
  })),
}));

jest.mock('@edx/frontend-platform/auth', () => ({
  getAuthenticatedHttpClient: jest.fn(),
}));

jest.mock('@edx/frontend-platform/logging', () => ({
  logError: jest.fn(),
}));

jest.mock('../utils', () => ({
  camelCaseObject: jest.fn((obj) => obj),
  snakeCaseObject: jest.fn((obj) => obj),
  convertKeyNames: jest.fn((obj) => obj),
}));

const mockHttpClient = {
  get: jest.fn(),
  patch: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  getAuthenticatedHttpClient.mockReturnValue(mockHttpClient);
});

// --- Tests ---
describe('services', () => {
  describe('getAccount', () => {
    it('should return processed account data', async () => {
      const mockData = { name: 'John Doe', socialLinks: [] };
      mockHttpClient.get.mockResolvedValue({ data: mockData });

      const result = await getAccount('john');
      expect(result).toMatchObject(mockData);
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        'http://fake-lms/api/user/v1/accounts/john',
      );
    });
  });

  describe('getBiodataProfile', () => {
    it('should load configured flat and repeatable biodata endpoints into extendedProfile shape', async () => {
      mockHttpClient.get.mockImplementation((url) => {
        if (url.endsWith('/basic-information/')) {
          return Promise.resolve({
            data: {
              full_name: 'John Doe',
              marital_status: 'single',
            },
          });
        }

        if (url.endsWith('/education/')) {
          return Promise.resolve({
            data: { results: [{ id: 10, institute: 'NDU' }] },
          });
        }

        if (url.endsWith('/languages/')) {
          return Promise.resolve({
            data: [{
              id: 11,
              language: 'English',
              speaking: 'Basic',
              reading: 'Advanced',
              writing: 'Native',
            }],
          });
        }

        return Promise.resolve({ data: {} });
      });

      const result = await getBiodataProfile();

      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({ fieldName: 'marital_status', fieldValue: 'single' }),
        expect.objectContaining({
          fieldName: 'education_records',
          fieldValue: [expect.objectContaining({ educational_institute: 'NDU', backendId: 10 })],
        }),
        expect.objectContaining({
          fieldName: 'language_proficiencies',
          fieldValue: [expect.objectContaining({
            language_name: 'English',
            speaking_proficiency: 'Basic',
            reading_proficiency: 'Advanced',
            writing_proficiency: 'Native',
            backendId: 11,
          })],
        }),
      ]));
    });

    it('should return empty biodata state instead of failing when biodata endpoints are missing', async () => {
      mockHttpClient.get.mockImplementation((url) => {
        if (url.endsWith('/basic-information/')) {
          const error = new Error('missing basic information endpoint');
          error.response = { status: 404 };
          return Promise.reject(error);
        }

        if (url.endsWith('/education/')) {
          const error = new Error('missing education endpoint');
          error.response = { status: 404 };
          return Promise.reject(error);
        }

        return Promise.resolve({ data: {} });
      });

      const result = await getBiodataProfile();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({ fieldName: 'preferred_calling_name', fieldValue: '' }),
        expect.objectContaining({ fieldName: 'education_records', fieldValue: [] }),
      ]));
    });

    it('should prefer saved repeatable rows over stale not_applicable metadata', async () => {
      mockHttpClient.get.mockImplementation((url) => {
        if (url.endsWith('/government-relatives/')) {
          return Promise.resolve({
            data: {
              results: [
                {
                  id: 3,
                  not_applicable: true,
                  name: '',
                  designation: '',
                  relationship: '',
                  address: '',
                  is_submitted: true,
                },
                {
                  id: 5,
                  not_applicable: false,
                  name: 'Kashif',
                  designation: 'SHO',
                  relationship: 'Brother',
                  address: 'Lahore',
                  is_submitted: true,
                },
              ],
            },
          });
        }

        return Promise.resolve({ data: {} });
      });

      const result = await getBiodataProfile();

      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({
          fieldName: 'close_relatives_in_government_service_not_applicable',
          fieldValue: false,
        }),
        expect.objectContaining({
          fieldName: 'close_relatives_in_government_service',
          fieldValue: expect.arrayContaining([
            expect.objectContaining({
              name: 'Kashif',
              designation: 'SHO',
              relationship: 'Brother',
              address: 'Lahore',
              backendId: 5,
            }),
          ]),
        }),
      ]));

      const relativesEntry = result.find(
        entry => entry.fieldName === 'close_relatives_in_government_service',
      );

      expect(relativesEntry.fieldValue).toHaveLength(1);
    });
  });

  describe('patchProfile', () => {
    it('should patch and return processed data', async () => {
      const mockData = { bio: 'New Bio' };
      mockHttpClient.patch.mockResolvedValue({ data: mockData });

      const result = await patchProfile('john', { bio: 'New Bio' });
      expect(result).toMatchObject(mockData);
      expect(snakeCaseObject).toHaveBeenCalledWith({ bio: 'New Bio' });
    });

    it('should throw processed error on failure', async () => {
      const error = { response: { data: { some: 'error' } } };
      mockHttpClient.patch.mockRejectedValue(error);

      await expect(patchProfile('john', {})).rejects.toMatchObject(error);
    });
  });

  describe('postProfilePhoto', () => {
    it('should post photo and return updated profile image', async () => {
      mockHttpClient.post.mockResolvedValue({});
      mockHttpClient.get.mockResolvedValue({
        data: { profileImage: { url: 'img.png' } },
      });

      const result = await postProfilePhoto('john', new FormData());
      expect(result).toEqual({ url: 'img.png' });
    });

    it('should throw error if API fails', async () => {
      const error = { response: { data: { error: 'fail' } } };
      mockHttpClient.post.mockRejectedValue(error);
      await expect(postProfilePhoto('john', new FormData())).rejects.toMatchObject(error);
    });
  });

  describe('deleteProfilePhoto', () => {
    it('should delete photo and return updated profile image', async () => {
      mockHttpClient.delete.mockResolvedValue({});
      mockHttpClient.get.mockResolvedValue({
        data: { profileImage: { url: 'deleted.png' } },
      });

      const result = await deleteProfilePhoto('john');
      expect(result).toEqual({ url: 'deleted.png' });
    });
  });

  describe('getPreferences', () => {
    it('should return camelCased preferences', async () => {
      mockHttpClient.get.mockResolvedValue({ data: { pref: 1 } });

      const result = await getPreferences('john');
      expect(result).toMatchObject({ pref: 1 });
      expect(camelCaseObject).toHaveBeenCalledWith({ pref: 1 });
    });
  });

  describe('patchPreferences', () => {
    it('should patch preferences and return params', async () => {
      mockHttpClient.patch.mockResolvedValue({});
      const params = { visibility_bio: true };

      const result = await patchPreferences('john', params);
      expect(result).toBe(params);
      expect(snakeCaseObject).toHaveBeenCalledWith(params);
      expect(convertKeyNames).toHaveBeenCalled();
    });
  });

  describe('getCourseCertificates', () => {
    it('should return transformed certificates', async () => {
      mockHttpClient.get.mockResolvedValue({
        data: [{ download_url: '/path', certificate_type: 'type' }],
      });

      const result = await getCourseCertificates('john');
      expect(result[0]).toHaveProperty('downloadUrl', 'http://fake-lms/path');
    });

    it('should log error and return empty array on failure', async () => {
      mockHttpClient.get.mockRejectedValue(new Error('fail'));
      const result = await getCourseCertificates('john');
      expect(result).toEqual([]);
      expect(logError).toHaveBeenCalled();
    });
  });

  describe('getCountryList', () => {
    it('should extract country list', async () => {
      mockHttpClient.get.mockResolvedValue({
        data: {
          fields: [
            { name: FIELD_LABELS.COUNTRY, options: [{ value: 'US' }, { value: 'CA' }] },
          ],
        },
      });

      const result = await getCountryList();
      expect(result).toEqual(['US', 'CA']);
    });

    it('should log error and return empty array on failure', async () => {
      mockHttpClient.get.mockRejectedValue(new Error('fail'));
      const result = await getCountryList();
      expect(result).toEqual([]);
      expect(logError).toHaveBeenCalled();
    });
  });

  describe('validateBiodataSection', () => {
    it('should post validation payload to the biodata validation endpoint', async () => {
      mockHttpClient.post.mockResolvedValue({});

      await validateBiodataSection('basicInformation', {
        preferred_calling_name: 'John',
        province_of_domicile: 'Punjab',
      });

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringMatching(/\/validate\/$/),
        expect.objectContaining({
          section: 'basicInformation',
          flat: expect.objectContaining({
            preferred_name: 'John',
            province_of_domicile: 'Punjab',
          }),
        }),
      );
    });
  });

  describe('saveBiodataSection', () => {
    it('should patch flat biodata sections and return refreshed extendedProfile', async () => {
      mockHttpClient.patch.mockResolvedValue({});
      mockHttpClient.get.mockResolvedValue({ data: {} });

      const result = await saveBiodataSection(
        'basicInformation',
        {
          preferred_calling_name: 'John',
          province_of_domicile: 'Punjab',
        },
        {
          preferred_calling_name: '',
          province_of_domicile: '',
        },
      );

      expect(mockHttpClient.patch).toHaveBeenCalledWith(
        expect.stringMatching(/\/basic-information\/$/),
        expect.objectContaining({
          preferred_name: 'John',
          province_of_domicile: 'Punjab',
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
      expect(result).toHaveProperty('extendedProfile');
    });

    it('should map backend validation errors to UI field names', async () => {
      const error = new Error('validation failed');
      error.response = {
        data: {
          cnic: ['Enter a valid CNIC in the format XXXXX-XXXXXXX-X.'],
        },
      };
      mockHttpClient.patch.mockRejectedValue(error);

      await expect(saveBiodataSection(
        'basicInformation',
        { identity_card_number: 'bad' },
        { identity_card_number: '' },
      )).rejects.toMatchObject({
        processedData: {
          fieldErrors: {
            identity_card_number: {
              userMessage: 'Enter a valid 13-digit CNIC number.',
            },
          },
        },
      });
    });

    it('should map language repeatable row payload fields to backend keys', async () => {
      mockHttpClient.post.mockResolvedValue({});
      mockHttpClient.get.mockResolvedValue({ data: { results: [] } });

      await saveBiodataSection(
        'languages',
        {
          language_proficiencies: [{
            rowId: 'row-1',
            language_name: 'English',
            speaking_proficiency: 'Native',
            reading_proficiency: 'Native',
            writing_proficiency: 'Advanced',
          }],
        },
        {
          language_proficiencies: [],
        },
      );

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringMatching(/\/languages\/$/),
        expect.objectContaining({
          language: 'English',
          speaking: 'Native',
          reading: 'Native',
          writing: 'Advanced',
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    });

    it('should map education repeatable row payload fields to backend keys', async () => {
      mockHttpClient.post.mockResolvedValue({});
      mockHttpClient.get.mockResolvedValue({ data: { results: [] } });

      await saveBiodataSection(
        'education',
        {
          education_records: [{
            rowId: 'row-1',
            educational_institute: 'UOS',
            attended_from: '2005-06-21',
            attended_to: '2009-09-25',
            examination: 'Bachelors',
            year_of_passing: '2009',
            grade_division: '',
            subjects_studied: 'computer science',
          }],
        },
        {
          education_records: [],
        },
      );

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringMatching(/\/education\/$/),
        expect.objectContaining({
          institute: 'UOS',
          attended_from: '2005-06-21',
          attended_to: '2009-09-25',
          examination: 'Bachelors',
          year_of_passing: '2009',
          grade: '',
          subjects: 'computer science',
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    });

    it('should not delete an existing education row when a restored draft is missing backendId', async () => {
      mockHttpClient.patch.mockResolvedValue({});
      mockHttpClient.post.mockResolvedValue({});
      mockHttpClient.delete.mockResolvedValue({});
      mockHttpClient.get.mockResolvedValue({ data: { results: [] } });

      await saveBiodataSection(
        'education',
        {
          education_records: [{
            rowId: 'row-1',
            educational_institute: 'University of Sargodha',
            attended_from: '2015-09-23',
            attended_to: '2019-09-12',
            examination: 'xyz',
            year_of_passing: '2019',
            grade_division: 'First',
            subjects_studied: 'Computer Science',
            education_degree_attachment: 'degree.pdf',
          }],
        },
        {
          education_records: [{
            rowId: 'row-committed',
            backendId: 3,
            educational_institute: 'University of Sargodha',
            attended_from: '2015-09-23',
            attended_to: '2019-09-12',
            examination: 'xyz',
            year_of_passing: '2019',
            grade_division: 'First',
            subjects_studied: 'Computer Science',
            education_degree_attachment: 'degree.pdf',
          }],
        },
      );

      expect(mockHttpClient.patch).toHaveBeenCalledWith(
        expect.stringMatching(/\/education\/3\/$/),
        expect.objectContaining({
          institute: 'University of Sargodha',
          attended_from: '2015-09-23',
          attended_to: '2019-09-12',
          examination: 'xyz',
          year_of_passing: '2019',
          grade: 'First',
          subjects: 'Computer Science',
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
      expect(mockHttpClient.delete).not.toHaveBeenCalledWith(
        expect.stringMatching(/\/education\/3\/$/),
      );
    });

    it('should delete removed education rows', async () => {
      mockHttpClient.patch.mockResolvedValue({});
      mockHttpClient.post.mockResolvedValue({});
      mockHttpClient.delete.mockResolvedValue({});
      mockHttpClient.get
        .mockResolvedValueOnce({
          data: [{
            id: 3,
            institute: 'University of Sargodha',
            attended_from: '2015-09-23',
            attended_to: '2019-09-12',
            examination: 'xyz',
            year_of_passing: '2019',
            grade: 'First',
            subjects: 'Computer Science',
          }],
        })
        .mockResolvedValueOnce({ data: {} });

      await saveBiodataSection(
        'education',
        {
          education_records: [{
            rowId: 'row-1',
            backendId: 3,
            educational_institute: 'University of Sargodha',
            attended_from: '2015-09-23',
            attended_to: '2019-09-12',
            examination: 'xyz',
            year_of_passing: '2019',
            grade_division: 'First',
            subjects_studied: 'Computer Science',
          }],
        },
        {
          education_records: [
            {
              rowId: 'row-1',
              backendId: 3,
              educational_institute: 'University of Sargodha',
              attended_from: '2015-09-23',
              attended_to: '2019-09-12',
              examination: 'xyz',
              year_of_passing: '2019',
              grade_division: 'First',
              subjects_studied: 'Computer Science',
            },
            {
              rowId: 'row-2',
              backendId: 4,
              educational_institute: 'Old Record',
              attended_from: '2011-01-01',
              attended_to: '2013-01-01',
              examination: 'Old',
              year_of_passing: '2013',
              grade_division: 'Second',
              subjects_studied: 'History',
            },
          ],
        },
      );

      expect(mockHttpClient.delete).toHaveBeenCalledWith(
        expect.stringMatching(/\/education\/4\/$/),
      );
    });

    it('should delete missing committed education rows', async () => {
      mockHttpClient.patch.mockResolvedValue({});
      mockHttpClient.post.mockResolvedValue({});
      mockHttpClient.delete.mockResolvedValue({});
      mockHttpClient.get
        .mockResolvedValueOnce({
          data: [{
            id: 3,
            institute: 'University of Sargodha',
            attended_from: '2015-09-23',
            attended_to: '2019-09-12',
            examination: 'xyz',
            year_of_passing: '2019',
            grade: 'First',
            subjects: 'Computer Science',
          }],
        })
        .mockResolvedValueOnce({ data: {} });

      await saveBiodataSection(
        'education',
        {
          education_records: [{
            rowId: 'row-1',
            educational_institute: 'University of Sargodha',
            attended_from: '2015-09-23',
            attended_to: '2019-09-12',
            examination: 'xyz',
            year_of_passing: '2019',
            grade_division: 'First',
            subjects_studied: 'Computer Science',
            education_degree_attachment: 'degree.pdf',
          }],
        },
        {
          education_records: [
            {
              rowId: 'row-committed-1',
              backendId: 3,
              educational_institute: 'University of Sargodha',
              attended_from: '2015-09-23',
              attended_to: '2019-09-12',
              examination: 'xyz',
              year_of_passing: '2019',
              grade_division: 'First',
              subjects_studied: 'Computer Science',
              education_degree_attachment: 'degree.pdf',
            },
            {
              rowId: 'row-committed-2',
              backendId: 4,
              educational_institute: 'Old Record',
              attended_from: '2011-01-01',
              attended_to: '2013-01-01',
              examination: 'Old',
              year_of_passing: '2013',
              grade_division: 'Second',
              subjects_studied: 'History',
              education_degree_attachment: 'old.pdf',
            },
          ],
        },
      );

      expect(mockHttpClient.patch).toHaveBeenCalledWith(
        expect.stringMatching(/\/education\/3\/$/),
        expect.any(Object),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      expect(mockHttpClient.delete).toHaveBeenCalledWith(
        expect.stringMatching(/\/education\/4\/$/),
      );
    });

    it('should keep a newly added education row after save and cleanup refresh', async () => {
      mockHttpClient.patch.mockResolvedValue({ data: { id: 3 } });
      mockHttpClient.post.mockResolvedValue({
        data: {
          id: 8,
          institute: 'NDU',
          attended_from: '2020-01-01',
          attended_to: '2022-01-01',
          examination: 'Masters',
          year_of_passing: '2022',
          grade: 'A',
          subjects: 'Policy',
          degree_file: '/media/ndu.pdf',
        },
      });
      mockHttpClient.delete.mockResolvedValue({});
      mockHttpClient.get
        .mockResolvedValueOnce({
          data: [
            {
              id: 3,
              institute: 'University of Sargodha',
              attended_from: '2015-09-23',
              attended_to: '2019-09-12',
              examination: 'xyz',
              year_of_passing: '2019',
              grade: 'First',
              subjects: 'Computer Science',
              degree_file: '/media/uos.pdf',
            },
            {
              id: 8,
              institute: 'NDU',
              attended_from: '2020-01-01',
              attended_to: '2022-01-01',
              examination: 'Masters',
              year_of_passing: '2022',
              grade: 'A',
              subjects: 'Policy',
              degree_file: '/media/ndu.pdf',
            },
          ],
        })
        .mockResolvedValueOnce({ data: {} });

      await saveBiodataSection(
        'education',
        {
          education_records: [
            {
              rowId: 'row-1',
              backendId: 3,
              educational_institute: 'University of Sargodha',
              attended_from: '2015-09-23',
              attended_to: '2019-09-12',
              examination: 'xyz',
              year_of_passing: '2019',
              grade_division: 'First',
              subjects_studied: 'Computer Science',
            },
            {
              rowId: 'row-2',
              educational_institute: 'NDU',
              attended_from: '2020-01-01',
              attended_to: '2022-01-01',
              examination: 'Masters',
              year_of_passing: '2022',
              grade_division: 'A',
              subjects_studied: 'Policy',
            },
          ],
        },
        {
          education_records: [
            {
              rowId: 'row-1',
              backendId: 3,
              educational_institute: 'University of Sargodha',
              attended_from: '2015-09-23',
              attended_to: '2019-09-12',
              examination: 'xyz',
              year_of_passing: '2019',
              grade_division: 'First',
              subjects_studied: 'Computer Science',
            },
          ],
        },
      );

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringMatching(/\/education\/$/),
        expect.objectContaining({
          institute: 'NDU',
          attended_from: '2020-01-01',
          attended_to: '2022-01-01',
          examination: 'Masters',
          year_of_passing: '2022',
          grade: 'A',
          subjects: 'Policy',
        }),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      expect(mockHttpClient.delete).not.toHaveBeenCalledWith(
        expect.stringMatching(/\/education\/8\/$/),
      );
    });

    it('should match language rows by content before index when a deleted earlier row shifts positions', async () => {
      mockHttpClient.patch.mockResolvedValue({});
      mockHttpClient.post.mockResolvedValue({});
      mockHttpClient.delete.mockResolvedValue({});
      mockHttpClient.get.mockImplementation((url) => {
        if (url.endsWith('/languages/')) {
          return Promise.resolve({
            data: [{
              id: 7,
              language: 'Urdu',
              speaking: 'basic',
              reading: 'intermediate',
              writing: 'intermediate',
              is_submitted: true,
            }],
          });
        }

        if (url.endsWith('/declaration/')) {
          return Promise.resolve({ data: {} });
        }

        return Promise.resolve({ data: {} });
      });

      await saveBiodataSection(
        'languages',
        {
          language_proficiencies: [{
            rowId: 'row-1',
            language_name: 'Urdu',
            speaking_proficiency: 'basic',
            reading_proficiency: 'intermediate',
            writing_proficiency: 'intermediate',
          }],
        },
        {
          language_proficiencies: [
            {
              rowId: 'row-english',
              backendId: 6,
              language_name: 'English',
              speaking_proficiency: 'basic',
              reading_proficiency: 'intermediate',
              writing_proficiency: 'advanced',
            },
            {
              rowId: 'row-urdu',
              backendId: 7,
              language_name: 'Urdu',
              speaking_proficiency: 'basic',
              reading_proficiency: 'intermediate',
              writing_proficiency: 'intermediate',
            },
          ],
        },
      );

      expect(mockHttpClient.patch).toHaveBeenCalledWith(
        expect.stringMatching(/\/languages\/7\/$/),
        expect.objectContaining({
          language: 'Urdu',
          speaking: 'basic',
          reading: 'intermediate',
          writing: 'intermediate',
        }),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      expect(mockHttpClient.delete).toHaveBeenCalledWith(
        expect.stringMatching(/\/languages\/6\/$/),
      );
      expect(mockHttpClient.patch).not.toHaveBeenCalledWith(
        expect.stringMatching(/\/languages\/6\/$/),
        expect.anything(),
        expect.anything(),
      );
      expect(mockHttpClient.delete).not.toHaveBeenCalledWith(
        expect.stringMatching(/\/languages\/7\/$/),
      );
    });

    it('should delete extra language rows still returned by a follow-up GET after patching', async () => {
      mockHttpClient.patch.mockResolvedValue({});
      mockHttpClient.post.mockResolvedValue({});
      mockHttpClient.delete.mockResolvedValue({});
      mockHttpClient.get
        .mockResolvedValueOnce({
          data: [
            {
              id: 6,
              language: 'English',
              speaking: 'basic',
              reading: 'intermediate',
              writing: 'advanced',
              is_submitted: true,
            },
            {
              id: 7,
              language: 'Urdu',
              speaking: 'basic',
              reading: 'intermediate',
              writing: 'intermediate',
              is_submitted: true,
            },
          ],
        })
        .mockResolvedValueOnce({
          data: [{
            id: 6,
            language: 'English',
            speaking: 'basic',
            reading: 'intermediate',
            writing: 'advanced',
            is_submitted: true,
          }],
        })
        .mockResolvedValueOnce({ data: {} });

      await saveBiodataSection(
        'languages',
        {
          language_proficiencies: [{
            rowId: 'row-1',
            backendId: 6,
            language_name: 'English',
            speaking_proficiency: 'basic',
            reading_proficiency: 'intermediate',
            writing_proficiency: 'advanced',
          }],
        },
        {
          language_proficiencies: [{
            rowId: 'row-1',
            backendId: 6,
            language_name: 'English',
            speaking_proficiency: 'basic',
            reading_proficiency: 'intermediate',
            writing_proficiency: 'advanced',
          }],
        },
      );

      expect(mockHttpClient.patch).toHaveBeenCalledWith(
        expect.stringMatching(/\/languages\/6\/$/),
        expect.objectContaining({
          language: 'English',
          speaking: 'basic',
          reading: 'intermediate',
          writing: 'advanced',
        }),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      expect(mockHttpClient.delete).toHaveBeenCalledWith(
        expect.stringMatching(/\/languages\/7\/$/),
      );
    });

    it('should patch existing CSS service group preferences instead of reposting them', async () => {
      mockHttpClient.patch.mockResolvedValue({});
      mockHttpClient.post.mockResolvedValue({});
      mockHttpClient.delete.mockResolvedValue({});
      mockHttpClient.get.mockResolvedValue({ data: {} });

      await saveBiodataSection(
        'cssExamDetails',
        {
          css_roll_number: '1234',
          css_merit_position: '1',
          css_chances_availed: '1',
          applied_for_forthcoming_css_exam: 'Yes',
          intend_to_sit_for_forthcoming_css_exam: 'Yes',
          last_chance_date_year: '2026',
          occupational_service_group_preferences: [
            {
              rowId: 'pref-1',
              backendId: 4,
              service_group: 'PAS',
              priority: '1',
            },
            {
              rowId: 'pref-2',
              backendId: 5,
              service_group: 'IRS',
              priority: '2',
            },
          ],
          css_subject_marks: [],
        },
        {
          occupational_service_group_preferences: [
            {
              rowId: 'pref-1',
              backendId: 4,
              service_group: 'PAS',
              priority: '1',
            },
            {
              rowId: 'pref-2',
              backendId: 5,
              service_group: 'IRS',
              priority: '2',
            },
          ],
          css_subject_marks: [],
        },
      );

      expect(mockHttpClient.patch).toHaveBeenCalledWith(
        expect.stringMatching(/\/service-group-preferences\/4\/$/),
        expect.objectContaining({
          service_group: 'PAS',
          priority: '1',
        }),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      expect(mockHttpClient.patch).toHaveBeenCalledWith(
        expect.stringMatching(/\/service-group-preferences\/5\/$/),
        expect.objectContaining({
          service_group: 'IRS',
          priority: '2',
        }),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      expect(mockHttpClient.post).not.toHaveBeenCalledWith(
        expect.stringMatching(/\/service-group-preferences\/$/),
        expect.anything(),
        expect.anything(),
      );
      expect(mockHttpClient.delete).not.toHaveBeenCalled();
    });

    it('should delete removed CSS service group preferences', async () => {
      mockHttpClient.patch.mockResolvedValue({});
      mockHttpClient.post.mockResolvedValue({});
      mockHttpClient.delete.mockResolvedValue({});
      mockHttpClient.get
        .mockResolvedValueOnce({ data: {} })
        .mockResolvedValueOnce({
          data: [
            {
              id: 4,
              service_group: 'PAS',
              priority: '1',
            },
          ],
        })
        .mockResolvedValueOnce({ data: {} });

      await saveBiodataSection(
        'cssExamDetails',
        {
          occupational_service_group_preferences: [
            {
              rowId: 'pref-1',
              backendId: 4,
              service_group: 'PAS',
              priority: '1',
            },
          ],
          css_subject_marks: [],
        },
        {
          occupational_service_group_preferences: [
            {
              rowId: 'pref-1',
              backendId: 4,
              service_group: 'PAS',
              priority: '1',
            },
            {
              rowId: 'pref-2',
              backendId: 5,
              service_group: 'IRS',
              priority: '2',
            },
          ],
          css_subject_marks: [],
        },
      );

      expect(mockHttpClient.delete).toHaveBeenCalledWith(
        expect.stringMatching(/\/service-group-preferences\/5\/$/),
      );
    });

    it('should map repeatable backend validation errors to UI field names', async () => {
      const error = new Error('validation failed');
      error.response = {
        data: {
          language: ['This field is required.'],
        },
      };
      mockHttpClient.post.mockRejectedValue(error);

      await expect(saveBiodataSection(
        'languages',
        {
          language_proficiencies: [{
            rowId: 'row-1',
            language_name: '',
            speaking_proficiency: 'Native',
            reading_proficiency: 'Native',
            writing_proficiency: 'Advanced',
          }],
        },
        {
          language_proficiencies: [],
        },
      )).rejects.toMatchObject({
        processedData: {
          fieldErrors: {
            language_name: {
              userMessage: 'Language is required.',
            },
          },
        },
      });
    });

    it('should preserve a local false N/A toggle and local rows when refresh data is empty', async () => {
      mockHttpClient.post.mockResolvedValue({});
      mockHttpClient.get.mockImplementation((url) => {
        if (url.endsWith('/foreign-visits/')) {
          return Promise.resolve({ data: [] });
        }

        if (url.endsWith('/declaration/')) {
          return Promise.resolve({ data: {} });
        }

        return Promise.resolve({ data: {} });
      });

      const result = await saveBiodataSection(
        'foreignVisits',
        {
          foreign_visits_not_applicable: false,
          foreign_visits: [{
            rowId: 'row-1',
            country: 'Turkey',
            purpose_of_visit: 'Training',
            self_or_sponsored_visit: 'Self',
            from: '2020-01-01',
            to: '2020-01-10',
          }],
        },
        {
          foreign_visits_not_applicable: true,
          foreign_visits: [],
        },
      );

      const notApplicableEntry = result.extendedProfile.find(
        entry => entry.fieldName === 'foreign_visits_not_applicable',
      );
      const visitsEntry = result.extendedProfile.find(
        entry => entry.fieldName === 'foreign_visits',
      );

      expect(notApplicableEntry).toEqual(expect.objectContaining({
        fieldName: 'foreign_visits_not_applicable',
        fieldValue: 'false',
      }));
      expect(JSON.parse(visitsEntry.fieldValue)).toEqual([
        expect.objectContaining({
          country: 'Turkey',
          purpose_of_visit: 'Training',
        }),
      ]);
    });
  });
});
