import { ensureConfig, getConfig } from '@edx/frontend-platform';
import {
  getAuthenticatedHttpClient as getHttpClient,
  getAuthenticatedUser,
} from '@edx/frontend-platform/auth';
import { logError } from '@edx/frontend-platform/logging';
import { camelCaseObject, convertKeyNames, snakeCaseObject } from '../utils';
import { FIELD_LABELS } from './constants';
import {
  BIODATA_VALIDATE_PATH,
  getBiodataEndpointUrl,
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
import {
  getFileUploadBlob,
  getSectionById,
  getSectionPayload,
  getSectionSubmittedFieldName,
} from '../biodata/utils';

ensureConfig(['LMS_BASE_URL'], 'Profile API service');

const PROFILE_COMPLETION_STORAGE_PREFIX = 'fbr.requiredProfileCompletion';
const OUTSIDE_HRMS_INSTRUCTOR_STORAGE_PREFIX = 'fbr.outsideHrmsInstructorProfile';
const DECLARATION_SECTION_ID = 'declaration';
const DECLARATION_CONFIRMED_FIELD = 'declaration_confirmed';

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

function getStorageUsername(username = null) {
  return username || (
    typeof getAuthenticatedUser === 'function'
      ? getAuthenticatedUser()?.username
      : null
  ) || 'current-user';
}

function setStorageValue(key, value) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(key, value);
}

function getRequiredProfileCompletionStorageKey(username = null) {
  return `${PROFILE_COMPLETION_STORAGE_PREFIX}:${getStorageUsername(username)}`;
}

function getOutsideHrmsInstructorStorageKey(username = null) {
  return `${OUTSIDE_HRMS_INSTRUCTOR_STORAGE_PREFIX}:${getStorageUsername(username)}`;
}

function normalizeBiodataPayload(payload) {
  return snakeCaseObject(payload);
}

function hasMultipartValue(payload = {}) {
  return Object.values(payload || {}).some(value => Boolean(getFileUploadBlob(value)));
}

function appendFormDataValue(formData, key, value) {
  const file = getFileUploadBlob(value);
  if (file) {
    formData.append(key, file, file.name);
    return;
  }

  if (value === undefined || value === null) {
    return;
  }

  formData.append(key, typeof value === 'boolean' ? String(value) : value);
}

function buildBiodataRequestPayload(payload = {}) {
  if (!hasMultipartValue(payload)) {
    return {
      data: normalizeBiodataPayload(payload),
      headers: { 'Content-Type': 'application/json' },
      isMultipart: false,
    };
  }

  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    appendFormDataValue(formData, key, value);
  });

  return {
    data: formData,
    headers: undefined,
    isMultipart: true,
  };
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

function shouldSkipRepeatableEndpoint(endpoint, flatResponse = {}) {
  const skipRule = endpoint.skipWhenFlatFieldEquals;

  return Boolean(skipRule && flatResponse?.[skipRule.fieldName] === skipRule.value);
}

function getLatestRepeatableRow(candidateRow = null, existingRow = null) {
  if (!existingRow) {
    return candidateRow;
  }

  const candidateTime = Date.parse(candidateRow?.modified || candidateRow?.created || '') || 0;
  const existingTime = Date.parse(existingRow?.modified || existingRow?.created || '') || 0;

  if (candidateTime !== existingTime) {
    return candidateTime > existingTime ? candidateRow : existingRow;
  }

  return Number(candidateRow?.id || 0) > Number(existingRow?.id || 0) ? candidateRow : existingRow;
}

function dedupeRepeatableRows(endpoint, rows = []) {
  if (!endpoint.dedupeBy) {
    return rows;
  }

  const rowsByKey = rows.reduce((accumulator, row) => {
    const key = String(row?.[endpoint.dedupeBy] || '').trim().toLowerCase();
    if (!key) {
      return accumulator;
    }

    accumulator[key] = getLatestRepeatableRow(row, accumulator[key]);
    return accumulator;
  }, {});

  const dedupedKeys = new Set(Object.keys(rowsByKey));

  return [
    ...Object.values(rowsByKey),
    ...rows.filter(row => !dedupedKeys.has(String(row?.[endpoint.dedupeBy] || '').trim().toLowerCase())),
  ];
}

async function getRepeatableBiodataSection(section, repeatable, endpoint, flatResponse = {}) {
  if (shouldSkipRepeatableEndpoint(endpoint, flatResponse)) {
    return {
      storageFieldName: repeatable.storageFieldName,
      rows: [],
      fallbackFields: {},
    };
  }

  try {
    const { data } = await getHttpClient().get(getBiodataEndpointUrl(endpoint.path));
    const rows = dedupeRepeatableRows(endpoint, Array.isArray(data) ? data : data?.results || []);
    const metadataSource = Array.isArray(data) ? rows[0] : data;
    const rowMetadataSource = !metadataSource?.not_applicable && !metadataSource?.is_submitted
      ? rows.find(row => row?.not_applicable !== undefined || row?.is_submitted !== undefined)
      : null;
    const responseMetadata = rowMetadataSource || metadataSource || {};
    const fallbackFields = {
      ...(endpoint.fallbackNaFieldName && responseMetadata.not_applicable !== undefined
        ? { [endpoint.fallbackNaFieldName]: Boolean(responseMetadata.not_applicable) }
        : {}),
      ...(responseMetadata.is_submitted !== undefined
        ? { [getSectionSubmittedFieldName(section.id)]: Boolean(responseMetadata.is_submitted) }
        : {}),
    };

    return {
      storageFieldName: repeatable.storageFieldName,
      rows: rows.map(row => snakeCaseObject(row)),
      fallbackFields,
    };
  } catch (error) {
    if (!isMissingBiodataResponse(error)) {
      logError(error);
    }

    return {
      storageFieldName: repeatable.storageFieldName,
      rows: [],
      fallbackFields: {},
    };
  }
}

async function getBiodataSectionProfile(sectionId) {
  const section = getSectionById(sectionId);

  if (!section) {
    return [];
  }

  const flatResponse = await getFlatBiodataSection(section);
  const repeatableResponses = await Promise.all(
    getSectionRepeatableConfigs(section)
      .map(({ repeatable, endpoint }) => getRepeatableBiodataSection(
        section,
        repeatable,
        endpoint,
        flatResponse || {},
      )),
  );

  const repeatableResponsesByKey = repeatableResponses.reduce((accumulator, { storageFieldName, rows }) => {
    accumulator[storageFieldName] = rows;
    return accumulator;
  }, {});
  const fallbackFields = repeatableResponses.reduce((accumulator, response) => ({
    ...accumulator,
    ...(response.fallbackFields || {}),
  }), {});

  return buildSectionExtendedProfile(sectionId, {
    ...(flatResponse || {}),
    ...fallbackFields,
  }, repeatableResponsesByKey);
}

async function updateRepeatableRows(endpoint, committedRows, draftRows) {
  const endpointPath = endpoint.path;
  const shouldPostRows = endpoint.rowMethod === 'post';

  if (endpoint.batchRows) {
    if (draftRows.length === 0) {
      return;
    }

    const rowValues = draftRows.map(row => row.values);
    const payload = buildBiodataRequestPayload(
      endpoint.batchPayloadKey ? { [endpoint.batchPayloadKey]: rowValues } : rowValues,
    );
    const url = getBiodataEndpointUrl(endpointPath);
    if (payload.headers) {
      await getHttpClient().post(url, payload.data, { headers: payload.headers });
    } else {
      await getHttpClient().post(url, payload.data);
    }
    return;
  }

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
    const payload = buildBiodataRequestPayload(row.values);
    if (row.backendId != null && !shouldPostRows) {
      const url = getBiodataEndpointUrl(`${endpointPath}${row.backendId}/`);
      operations.push(payload.headers
        ? getHttpClient().patch(url, payload.data, { headers: payload.headers })
        : getHttpClient().patch(url, payload.data));
    } else {
      const url = getBiodataEndpointUrl(endpointPath);
      operations.push(payload.headers
        ? getHttpClient().post(url, payload.data, { headers: payload.headers })
        : getHttpClient().post(url, payload.data));
    }
  });

  if (!shouldPostRows) {
    Object.keys(committedRowMap).forEach((backendId) => {
      if (!draftRowMap[backendId]) {
        operations.push(getHttpClient().delete(getBiodataEndpointUrl(`${endpointPath}${backendId}/`)));
      }
    });
  }

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
    const flatResponse = await getFlatBiodataSection(section);
    const repeatableResponses = await Promise.all(
      getSectionRepeatableConfigs(section)
        .map(({ repeatable, endpoint }) => getRepeatableBiodataSection(
          section,
          repeatable,
          endpoint,
          flatResponse || {},
        )),
    );
    const fallbackFields = repeatableResponses.reduce((accumulator, response) => ({
      ...accumulator,
      ...(response.fallbackFields || {}),
    }), {});

    if (flatResponse || Object.keys(fallbackFields).length > 0) {
      flatResponsesBySection[section.id] = {
        ...(flatResponse || {}),
        ...fallbackFields,
      };
    }

    repeatableResponses.forEach(({ storageFieldName, rows }) => {
      repeatableResponsesByKey[storageFieldName] = rows;
    });
  }));

  return buildBiodataExtendedProfile(flatResponsesBySection, repeatableResponsesByKey);
}

export async function getProfileCompletionStatus() {
  const declarationEndpoint = getSectionEndpointConfig(DECLARATION_SECTION_ID)?.flat?.path;
  let complete = false;

  if (declarationEndpoint) {
    try {
      const { data } = await getHttpClient().get(getBiodataEndpointUrl(declarationEndpoint));
      complete = Boolean(snakeCaseObject(data || {}).is_submitted);
    } catch (error) {
      if (!isMissingBiodataResponse(error)) {
        logError(error);
      }
    }
  }

  return {
    required: true,
    complete,
    formType: 'biodata',
    profileUrl: null,
  };
}

export async function saveOutsideHrmsInstructorProfile(sectionData, username = null) {
  setStorageValue(
    getOutsideHrmsInstructorStorageKey(username),
    JSON.stringify(normalizeBiodataPayload(sectionData)),
  );
  setStorageValue(getRequiredProfileCompletionStorageKey(username), 'true');

  return getProfileCompletionStatus(username);
}

export async function saveRequiredProfileCompletion() {
  return getProfileCompletionStatus();
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
      const flatPayload = buildBiodataRequestPayload(mapSectionDataToFlatPayload(section, sectionData));
      const url = getBiodataEndpointUrl(sectionEndpointConfig.flat.path);
      const requestMethod = sectionEndpointConfig.flat.method === 'post' ? 'post' : 'patch';
      if (flatPayload.headers) {
        await getHttpClient()[requestMethod](url, flatPayload.data, { headers: flatPayload.headers });
      } else {
        await getHttpClient()[requestMethod](url, flatPayload.data);
      }
    }

    const repeatablePayloads = mapSectionDataToRepeatablePayloads(section, sectionData);
    const committedRepeatablePayloads = mapSectionDataToRepeatablePayloads(section, committedData || {});

    await Promise.all(repeatablePayloads.map(async (payload) => {
      const extraFieldsEndpointPath = payload.endpoint.extraFieldMap
        ? payload.endpoint.path
        : sectionEndpointConfig.flat?.path;

      if (Object.keys(payload.extraFields).length > 0 && extraFieldsEndpointPath) {
        const extraPayload = buildBiodataRequestPayload(payload.extraFields);
        const url = getBiodataEndpointUrl(extraFieldsEndpointPath);
        const requestMethod = payload.endpoint.extraFieldsMethod === 'post' ? 'post' : 'patch';
        if (extraPayload.headers) {
          await getHttpClient()[requestMethod](url, extraPayload.data, { headers: extraPayload.headers });
        } else {
          await getHttpClient()[requestMethod](url, extraPayload.data);
        }
      }

      const committedRepeatable = committedRepeatablePayloads.find(
        item => item.repeatable.storageFieldName === payload.repeatable.storageFieldName,
      );

      await updateRepeatableRows(
        payload.endpoint,
        committedRepeatable?.rows || [],
        payload.rows,
      );
    }));

    const savedSectionProfile = sectionEndpointConfig.refreshAfterSave === false
      ? getSectionPayload(section, sectionData)
      : await getBiodataSectionProfile(sectionId);
    const profileCompletionStatus = sectionId === DECLARATION_SECTION_ID
      && sectionData?.[DECLARATION_CONFIRMED_FIELD]
      ? await saveRequiredProfileCompletion()
      : await getProfileCompletionStatus();

    return {
      extendedProfile: mergeSectionIntoExtendedProfile(
        sectionId,
        currentExtendedProfile,
        savedSectionProfile,
      ),
      profileCompletionStatus,
    };
  } catch (error) {
    throw normalizeBiodataErrorForSection(error, sectionId);
  }
}
