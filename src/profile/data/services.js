import { ensureConfig, getConfig } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient as getHttpClient } from '@edx/frontend-platform/auth';
import { logError } from '@edx/frontend-platform/logging';
import { camelCaseObject, convertKeyNames, snakeCaseObject } from '../utils';
import { FIELD_LABELS } from './constants';
import {
  BIODATA_API_DEFAULT_BASE_PATH,
  BIODATA_VALIDATE_PATH,
  getConfiguredBiodataSections,
  getSectionEndpointConfig,
  getSectionRepeatableConfigs,
} from '../biodata/apiConfig';
import {
  buildBiodataExtendedProfile,
  buildSectionExtendedProfile,
  buildValidationPayload,
  mapSectionDataToFlatPayload,
  mapSectionDataToRepeatablePayloads,
  mergeSectionIntoExtendedProfile,
  normalizeBiodataErrorForSection,
} from '../biodata/apiTransforms';
import { getSectionById } from '../biodata/utils';

ensureConfig(['LMS_BASE_URL'], 'Profile API service');

function processAccountData(data) {
  const processedData = camelCaseObject(data);
  return {
    ...processedData,
    socialLinks: Array.isArray(processedData.socialLinks) ? processedData.socialLinks : [],
    languageProficiencies: Array.isArray(processedData.languageProficiencies)
      ? processedData.languageProficiencies : [],
    name: processedData.name || null,
    bio: processedData.bio || null,
    country: processedData.country || null,
    levelOfEducation: processedData.levelOfEducation || null,
    profileImage: processedData.profileImage || {},
    yearOfBirth: processedData.yearOfBirth || null,
  };
}

function processAndThrowError(error, errorDataProcessor) {
  const processedError = Object.create(error);
  if (error.response && error.response.data && typeof error.response.data === 'object') {
    processedError.processedData = errorDataProcessor(error.response.data);
    throw processedError;
  } else {
    throw error;
  }
}

function normalizeBiodataPath(path) {
  return path.replace(/^\//, '');
}

function getBiodataApiBaseUrl() {
  const { LMS_BASE_URL, BIODATA_API_BASE_URL } = getConfig();

  if (BIODATA_API_BASE_URL) {
    return BIODATA_API_BASE_URL.replace(/\/$/, '');
  }

  return `${LMS_BASE_URL}${BIODATA_API_DEFAULT_BASE_PATH}`;
}

function getBiodataEndpointUrl(path) {
  return `${getBiodataApiBaseUrl()}/${normalizeBiodataPath(path)}`;
}

function normalizeBiodataPayload(payload) {
  return snakeCaseObject(payload);
}

function isMissingBiodataResponse(error) {
  const status = error?.response?.status;
  return status === 404 || status === 403;
}

async function getFlatBiodataSection(section) {
  const sectionEndpointConfig = getSectionEndpointConfig(section.id);

  if (!sectionEndpointConfig?.flat?.path) {
    return null;
  }

  try {
    const { data } = await getHttpClient().get(getBiodataEndpointUrl(sectionEndpointConfig.flat.path));
    return data && typeof data === 'object' ? snakeCaseObject(data) : {};
  } catch (error) {
    if (isMissingBiodataResponse(error)) {
      return {};
    }

    logError(error);
    return {};
  }
}

async function getRepeatableBiodataSection(section, repeatable, endpoint) {
  try {
    const { data } = await getHttpClient().get(getBiodataEndpointUrl(endpoint.path));
    const rows = Array.isArray(data) ? data : data?.results || [];

    return {
      storageFieldName: repeatable.storageFieldName,
      rows: rows.map(row => snakeCaseObject(row)),
    };
  } catch (error) {
    if (!isMissingBiodataResponse(error)) {
      logError(error);
    }

    return {
      storageFieldName: repeatable.storageFieldName,
      rows: [],
    };
  }
}

async function getBiodataSectionProfile(sectionId) {
  const section = getSectionById(sectionId);

  if (!section) {
    return [];
  }

  const [flatResponse, ...repeatableResponses] = await Promise.all([
    getFlatBiodataSection(section),
    ...getSectionRepeatableConfigs(section)
      .map(({ repeatable, endpoint }) => getRepeatableBiodataSection(section, repeatable, endpoint)),
  ]);

  const repeatableResponsesByKey = repeatableResponses.reduce((accumulator, { storageFieldName, rows }) => {
    accumulator[storageFieldName] = rows;
    return accumulator;
  }, {});

  return buildSectionExtendedProfile(sectionId, flatResponse || {}, repeatableResponsesByKey);
}

async function updateRepeatableRows(endpointPath, committedRows, draftRows) {
  const committedRowMap = committedRows.reduce((accumulator, row) => {
    if (row.backendId != null) {
      accumulator[String(row.backendId)] = row;
    }
    return accumulator;
  }, {});

  const draftRowMap = draftRows.reduce((accumulator, row) => {
    if (row.backendId != null) {
      accumulator[String(row.backendId)] = row;
    }
    return accumulator;
  }, {});

  const operations = [];

  draftRows.forEach((row) => {
    const payload = normalizeBiodataPayload(row.values);
    if (row.backendId != null) {
      operations.push(getHttpClient().patch(
        getBiodataEndpointUrl(`${endpointPath}${row.backendId}/`),
        payload,
        {
          headers: { 'Content-Type': 'application/json' },
        },
      ));
    } else {
      operations.push(getHttpClient().post(getBiodataEndpointUrl(endpointPath), payload));
    }
  });

  Object.keys(committedRowMap).forEach((backendId) => {
    if (!draftRowMap[backendId]) {
      operations.push(getHttpClient().delete(getBiodataEndpointUrl(`${endpointPath}${backendId}/`)));
    }
  });

  await Promise.all(operations);
}

export async function getAccount(username) {
  const { data } = await getHttpClient().get(`${getConfig().LMS_BASE_URL}/api/user/v1/accounts/${username}`);

  return processAccountData(data);
}

export async function patchProfile(username, params) {
  const processedParams = snakeCaseObject(params);

  const { data } = await getHttpClient()
    .patch(`${getConfig().LMS_BASE_URL}/api/user/v1/accounts/${username}`, processedParams, {
      headers: {
        'Content-Type': 'application/merge-patch+json',
      },
    })
    .catch((error) => {
      processAndThrowError(error, processAccountData);
    });

  return processAccountData(data);
}

export async function postProfilePhoto(username, formData) {
  // eslint-disable-next-line no-unused-vars
  const { data } = await getHttpClient().post(
    `${getConfig().LMS_BASE_URL}/api/user/v1/accounts/${username}/image`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  ).catch((error) => {
    processAndThrowError(error, camelCaseObject);
  });

  // TODO: Someday in the future the POST photo endpoint
  // will return the new values. At that time we should
  // use the commented line below instead of the separate
  // getAccount request that follows.
  // return camelCaseObject(data);
  const updatedData = await getAccount(username);
  return updatedData.profileImage;
}

export async function deleteProfilePhoto(username) {
  // eslint-disable-next-line no-unused-vars
  const { data } = await getHttpClient().delete(`${getConfig().LMS_BASE_URL}/api/user/v1/accounts/${username}/image`);

  // TODO: Someday in the future the POST photo endpoint
  // will return the new values. At that time we should
  // use the commented line below instead of the separate
  // getAccount request that follows.
  // return camelCaseObject(data);
  const updatedData = await getAccount(username);
  return updatedData.profileImage;
}

export async function getPreferences(username) {
  const { data } = await getHttpClient().get(`${getConfig().LMS_BASE_URL}/api/user/v1/preferences/${username}`);

  return camelCaseObject(data);
}

export async function patchPreferences(username, params) {
  let processedParams = snakeCaseObject(params);
  processedParams = convertKeyNames(processedParams, {
    visibility_bio: 'visibility.bio',
    visibility_course_certificates: 'visibility.course_certificates',
    visibility_country: 'visibility.country',
    visibility_date_joined: 'visibility.date_joined',
    visibility_level_of_education: 'visibility.level_of_education',
    visibility_language_proficiencies: 'visibility.language_proficiencies',
    visibility_name: 'visibility.name',
    visibility_social_links: 'visibility.social_links',
    visibility_time_zone: 'visibility.time_zone',
  });

  await getHttpClient().patch(`${getConfig().LMS_BASE_URL}/api/user/v1/preferences/${username}`, processedParams, {
    headers: { 'Content-Type': 'application/merge-patch+json' },
  });

  return params; // TODO: Once the server returns the updated preferences object, return that.
}

function transformCertificateData(data) {
  const transformedData = [];
  data.forEach((cert) => {
    // download_url may be full url or absolute path.
    // note: using the URL() api breaks in ie 11
    const urlIsPath = typeof cert.download_url === 'string'
      && cert.download_url.search(/http[s]?:\/\//) !== 0;

    const downloadUrl = urlIsPath
      ? `${getConfig().LMS_BASE_URL}${cert.download_url}`
      : cert.download_url;

    transformedData.push({
      ...camelCaseObject(cert),
      certificateType: cert.certificate_type,
      downloadUrl,
    });
  });
  return transformedData;
}

export async function getCourseCertificates(username) {
  const url = `${getConfig().LMS_BASE_URL}/api/certificates/v0/certificates/${username}/`;
  try {
    const { data } = await getHttpClient().get(url);
    return transformCertificateData(data);
  } catch (e) {
    logError(e);
    return [];
  }
}

function extractCountryList(data) {
  return data?.fields
    .find(({ name }) => name === FIELD_LABELS.COUNTRY)
    ?.options?.map(({ value }) => (value)) || [];
}

export async function getCountryList() {
  const url = `${getConfig().LMS_BASE_URL}/user_api/v1/account/registration/`;

  try {
    const { data } = await getHttpClient().get(url);
    return extractCountryList(data);
  } catch (e) {
    logError(e);
    return [];
  }
}

export async function getBiodataProfile() {
  const sections = getConfiguredBiodataSections();
  const flatResponsesBySection = {};
  const repeatableResponsesByKey = {};

  await Promise.all(sections.map(async (section) => {
    const [flatResponse, ...repeatableResponses] = await Promise.all([
      getFlatBiodataSection(section),
      ...getSectionRepeatableConfigs(section)
        .map(({ repeatable, endpoint }) => getRepeatableBiodataSection(section, repeatable, endpoint)),
    ]);

    if (flatResponse) {
      flatResponsesBySection[section.id] = flatResponse;
    }

    repeatableResponses.forEach(({ storageFieldName, rows }) => {
      repeatableResponsesByKey[storageFieldName] = rows;
    });
  }));

  return buildBiodataExtendedProfile(flatResponsesBySection, repeatableResponsesByKey);
}

export async function validateBiodataSection(sectionId, sectionData) {
  const section = getSectionById(sectionId);

  if (!section) {
    return null;
  }

  const payload = normalizeBiodataPayload(buildValidationPayload(section, sectionData));
  try {
    await getHttpClient().post(getBiodataEndpointUrl(BIODATA_VALIDATE_PATH), payload);
    return null;
  } catch (error) {
    throw normalizeBiodataErrorForSection(error, sectionId);
  }
}

export async function saveBiodataSection(sectionId, sectionData, committedData, currentExtendedProfile = []) {
  const section = getSectionById(sectionId);
  const sectionEndpointConfig = getSectionEndpointConfig(sectionId);

  if (!section || !sectionEndpointConfig) {
    return { extendedProfile: [] };
  }

  try {
    if (sectionEndpointConfig.flat?.path) {
      const flatPayload = normalizeBiodataPayload(mapSectionDataToFlatPayload(section, sectionData));
      await getHttpClient().patch(
        getBiodataEndpointUrl(sectionEndpointConfig.flat.path),
        flatPayload,
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const repeatablePayloads = mapSectionDataToRepeatablePayloads(section, sectionData);
    const committedRepeatablePayloads = mapSectionDataToRepeatablePayloads(section, committedData || {});

    await Promise.all(repeatablePayloads.map(async (payload) => {
      if (Object.keys(payload.extraFields).length > 0 && sectionEndpointConfig.flat?.path) {
        await getHttpClient().patch(
          getBiodataEndpointUrl(sectionEndpointConfig.flat.path),
          normalizeBiodataPayload(payload.extraFields),
          {
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      const committedRepeatable = committedRepeatablePayloads.find(
        item => item.repeatable.storageFieldName === payload.repeatable.storageFieldName,
      );

      await updateRepeatableRows(
        payload.endpoint.path,
        committedRepeatable?.rows || [],
        payload.rows,
      );
    }));

    const savedSectionProfile = await getBiodataSectionProfile(sectionId);
    return {
      extendedProfile: mergeSectionIntoExtendedProfile(
        sectionId,
        currentExtendedProfile,
        savedSectionProfile,
      ),
    };
  } catch (error) {
    throw normalizeBiodataErrorForSection(error, sectionId);
  }
}
