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
  getRepeatableUiToApiFieldMap,
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
    const { data } = await getHttpClient().get(
      getBiodataEndpointUrl(sectionEndpointConfig.flat.path, { includeTargetUser: true }),
    );
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

function buildRepeatableRowMatchKey(values = {}) {
  return JSON.stringify(
    Object.keys(values || {})
      .sort()
      .reduce((accumulator, key) => {
        accumulator[key] = values[key] ?? '';
        return accumulator;
      }, {}),
  );
}

function extractRepeatableServerRows(data) {
  return Array.isArray(data) ? data : data?.results || [];
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

function rowHasMeaningfulData(row, repeatable, uiToApiFieldMap = {}) {
  const values = snakeCaseObject(row || {});

  return (repeatable.columns || []).some(({ key, type }) => (
    type === 'file'
      ? Boolean(values?.[uiToApiFieldMap[key] || key])
      : String(values?.[uiToApiFieldMap[key] || key] || '').trim().length > 0
  ));
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
    const { data } = await getHttpClient().get(getBiodataEndpointUrl(endpoint.path, { includeTargetUser: true }));
    const rows = dedupeRepeatableRows(endpoint, Array.isArray(data) ? data : data?.results || []);
    const uiToApiFieldMap = getRepeatableUiToApiFieldMap(section.id, repeatable.storageFieldName);
    const meaningfulRows = rows.filter(row => rowHasMeaningfulData(row, repeatable, uiToApiFieldMap));
    const hasMeaningfulRowData = meaningfulRows.length > 0;
    const metadataSource = Array.isArray(data) ? rows[0] : data;
    const rowMetadataSource = !metadataSource?.not_applicable && !metadataSource?.is_submitted
      ? rows.find(row => row?.not_applicable !== undefined || row?.is_submitted !== undefined)
      : null;
    const responseMetadata = rowMetadataSource || metadataSource || {};
    const resolvedNotApplicable = hasMeaningfulRowData
      ? false
      : responseMetadata.not_applicable;
    const fallbackFields = {
      ...(endpoint.fallbackNaFieldName && resolvedNotApplicable !== undefined
        ? { [endpoint.fallbackNaFieldName]: Boolean(resolvedNotApplicable) }
        : {}),
      ...(responseMetadata.is_submitted !== undefined
        ? { [getSectionSubmittedFieldName(section.id)]: Boolean(responseMetadata.is_submitted) }
        : {}),
    };

    return {
      storageFieldName: repeatable.storageFieldName,
      rows: meaningfulRows.map(row => snakeCaseObject(row)),
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

export async function getBiodataSectionProfile(sectionId) {
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
  const shouldDeleteMissingRows = endpoint.allowDelete !== false && !shouldPostRows;
  const matchedCommittedRowIndexes = new Set();
  const committedRowsByMatchKey = committedRows.reduce((accumulator, row, index) => {
    if (row?.backendId == null) {
      return accumulator;
    }

    const matchKey = buildRepeatableRowMatchKey(row.values);
    if (!accumulator[matchKey]) {
      accumulator[matchKey] = [];
    }
    accumulator[matchKey].push(index);
    return accumulator;
  }, {});
  const normalizedDraftRows = draftRows.map((row, index) => {
    if (row.backendId != null) {
      return row;
    }

    const matchKey = buildRepeatableRowMatchKey(row.values);
    const matchingCommittedRowIndexes = committedRowsByMatchKey[matchKey] || [];
    const matchedCommittedRowIndex = matchingCommittedRowIndexes.find(
      committedRowIndex => !matchedCommittedRowIndexes.has(committedRowIndex),
    );

    if (matchedCommittedRowIndex != null) {
      matchedCommittedRowIndexes.add(matchedCommittedRowIndex);
      return {
        ...row,
        backendId: committedRows[matchedCommittedRowIndex].backendId,
      };
    }

    const committedRow = committedRows[index];
    if (
      !committedRow
      || committedRow.backendId == null
      || matchedCommittedRowIndexes.has(index)
    ) {
      return row;
    }

    matchedCommittedRowIndexes.add(index);
    return {
      ...row,
      backendId: committedRow.backendId,
    };
  });

  if (endpoint.batchRows) {
    if (normalizedDraftRows.length === 0) {
      return;
    }

    const rowValues = normalizedDraftRows.map(row => row.values);
    const payload = buildBiodataRequestPayload(
      endpoint.batchPayloadKey ? { [endpoint.batchPayloadKey]: rowValues } : rowValues,
    );
    const url = getBiodataEndpointUrl(endpointPath, { includeTargetUser: true });
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

  const draftRowMap = normalizedDraftRows.reduce((accumulator, row) => {
    if (row.backendId != null) {
      accumulator[String(row.backendId)] = row;
    }
    return accumulator;
  }, {});

  const rowOperations = [];

  normalizedDraftRows.forEach((row) => {
    const payload = buildBiodataRequestPayload(row.values);
    if (row.backendId != null && !shouldPostRows) {
      const url = getBiodataEndpointUrl(`${endpointPath}${row.backendId}/`, { includeTargetUser: true });
      rowOperations.push(payload.headers
        ? getHttpClient().patch(url, payload.data, { headers: payload.headers })
        : getHttpClient().patch(url, payload.data));
    } else {
      const url = getBiodataEndpointUrl(endpointPath, { includeTargetUser: true });
      rowOperations.push(payload.headers
        ? getHttpClient().post(url, payload.data, { headers: payload.headers })
        : getHttpClient().post(url, payload.data));
    }
  });

  const deleteOperations = [];
  if (shouldDeleteMissingRows) {
    Object.keys(committedRowMap).forEach((backendId) => {
      if (!draftRowMap[backendId]) {
        deleteOperations.push(getHttpClient().delete(getBiodataEndpointUrl(`${endpointPath}${backendId}/`, { includeTargetUser: true })));
      }
    });
  }

  const rowResponses = await Promise.all(rowOperations);
  await Promise.all(deleteOperations);

  if (shouldDeleteMissingRows) {
    const { data } = await getHttpClient().get(
      getBiodataEndpointUrl(endpointPath, { includeTargetUser: true }),
    );
    const serverRows = extractRepeatableServerRows(data);
    const matchedServerIds = new Set(
      rowResponses
        .map(response => response?.data?.id)
        .filter(id => id != null)
        .map(id => String(id)),
    );

    normalizedDraftRows.forEach((row) => {
      if (row.backendId != null) {
        matchedServerIds.add(String(row.backendId));
      }
    });

    const cleanupDeletes = serverRows
      .filter(serverRow => serverRow?.id != null && !matchedServerIds.has(String(serverRow.id)))
      .map(serverRow => getHttpClient().delete(
        getBiodataEndpointUrl(`${endpointPath}${serverRow.id}/`, { includeTargetUser: true }),
      ));

    if (cleanupDeletes.length > 0) {
      await Promise.all(cleanupDeletes);
    }
  }
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
      const { data } = await getHttpClient().get(
        getBiodataEndpointUrl(declarationEndpoint, { includeTargetUser: true }),
      );
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

function hasEntryValue(entry) {
  const value = entry?.fieldValue;

  if (typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (value && typeof value === 'object') {
    return Object.keys(value).length > 0;
  }

  return String(value || '').trim().length > 0;
}

function hasLocalFallbackValue(entry) {
  return Boolean(entry) && Object.prototype.hasOwnProperty.call(entry, 'fieldValue');
}

function shouldPreferLocalBooleanValue(existingEntry, localEntry) {
  return typeof existingEntry?.fieldValue === 'boolean'
    && typeof localEntry?.fieldValue === 'boolean'
    && existingEntry.fieldValue !== localEntry.fieldValue;
}

function mergeSavedSectionProfileWithLocalFallback(savedSectionProfile = [], localSectionPayload = []) {
  const mergedEntriesByName = new Map(
    (savedSectionProfile || []).map(entry => [entry.fieldName, entry]),
  );

  (localSectionPayload || []).forEach((entry) => {
    const existingEntry = mergedEntriesByName.get(entry.fieldName);

    if (
      shouldPreferLocalBooleanValue(existingEntry, entry)
      || !existingEntry
      || !hasEntryValue(existingEntry)
    ) {
      if (hasLocalFallbackValue(entry)) {
        mergedEntriesByName.set(entry.fieldName, entry);
      }
    }
  });

  return Array.from(mergedEntriesByName.values());
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
    await getHttpClient().post(getBiodataEndpointUrl(BIODATA_VALIDATE_PATH, { includeTargetUser: true }), payload);
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
      const url = getBiodataEndpointUrl(sectionEndpointConfig.flat.path, { includeTargetUser: true });
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
        const url = getBiodataEndpointUrl(extraFieldsEndpointPath, { includeTargetUser: true });
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
      : mergeSavedSectionProfileWithLocalFallback(
        await getBiodataSectionProfile(sectionId),
        getSectionPayload(section, sectionData),
      );
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
