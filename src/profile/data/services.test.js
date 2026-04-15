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
        expect.objectContaining({ fieldName: 'profile_full_name', fieldValue: 'John Doe' }),
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
        expect.objectContaining({ fieldName: 'profile_full_name', fieldValue: '' }),
        expect.objectContaining({ fieldName: 'education_records', fieldValue: [] }),
      ]));
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
        profile_full_name: 'John Doe',
      });

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringMatching(/\/validate\/$/),
        expect.objectContaining({
          section: 'basicInformation',
          flat: expect.objectContaining({
            full_name: 'John Doe',
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
        { profile_full_name: 'John Doe' },
        { profile_full_name: '' },
      );

      expect(mockHttpClient.patch).toHaveBeenCalledWith(
        expect.stringMatching(/\/basic-information\/$/),
        expect.objectContaining({
          full_name: 'John Doe',
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
              userMessage: 'Enter a valid CNIC in the format XXXXX-XXXXXXX-X.',
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
              userMessage: 'This field is required.',
            },
          },
        },
      });
    });
  });
});
