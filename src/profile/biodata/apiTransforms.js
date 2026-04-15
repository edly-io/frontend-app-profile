import {
  getConfiguredBiodataSections,
  getFlatUiToApiFieldMap,
  getRepeatableExtraFieldNames,
  getFlatApiToUiFieldMap,
  getRepeatableApiToUiFieldMap,
  getRepeatableUiToApiFieldMap,
  getSectionFlatFieldNames,
  getSectionRepeatableConfigs,
} from './apiConfig';
import {
  PROFILE_FIELD_TYPES,
  BIODATA_SECTION_MAP,
} from './config';
import {
  createEmptyRepeatableRow,
  getSanitizedSectionData,
  isSingleMaritalStatus,
} from './utils';

const FILE_FIELD_KEYS = ['name', 'dataUrl', 'url', 'imageUrl', 'previewUrl'];
const YES_NO_FIELD_NAMES = [
  'applied_for_forthcoming_css_exam',
  'intend_to_sit_for_forthcoming_css_exam',
  'other_income_source_besides_salary',
];

function normalizeMessage(errorValue) {
  if (Array.isArray(errorValue)) {
    return errorValue.join(' ');
  }

  if (typeof errorValue === 'string') {
    return errorValue;
  }

  if (errorValue && typeof errorValue === 'object') {
    if (typeof errorValue.userMessage === 'string') {
      return errorValue.userMessage;
    }
    if (typeof errorValue.message === 'string') {
      return errorValue.message;
    }
    if (Array.isArray(errorValue.detail)) {
      return errorValue.detail.join(' ');
    }
    if (typeof errorValue.detail === 'string') {
      return errorValue.detail;
    }
  }

  return 'Unable to save this section.';
}

function normalizeFieldError(errorValue) {
  if (errorValue && typeof errorValue === 'object' && typeof errorValue.userMessage === 'string') {
    return errorValue;
  }

  return {
    userMessage: normalizeMessage(errorValue),
  };
}

function extractErrorMap(errorData) {
  if (!errorData || typeof errorData !== 'object') {
    return {};
  }

  if (errorData.errors && typeof errorData.errors === 'object') {
    return errorData.errors;
  }

  if (errorData.fieldErrors && typeof errorData.fieldErrors === 'object') {
    return errorData.fieldErrors;
  }

  return errorData;
}

function normalizeFileValue(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return {
      name: value.split('/').pop() || 'file',
      url: value,
    };
  }

  if (typeof value === 'object') {
    const normalizedValue = {};
    FILE_FIELD_KEYS.forEach((key) => {
      if (value[key]) {
        normalizedValue[key] = value[key];
      }
    });

    if (Object.keys(normalizedValue).length > 0) {
      return {
        ...normalizedValue,
        name: normalizedValue.name || value.fileName || value.filename || 'file',
        url: normalizedValue.url || value.fileUrl || value.imageUrl || null,
      };
    }
  }

  return null;
}

function normalizeRepeatableRow(row, repeatable, uiToApiFieldMap = {}) {
  const normalizedRow = repeatable.columns.reduce((accumulator, column) => {
    const apiFieldName = uiToApiFieldMap[column.key] || column.key;
    accumulator[column.key] = row?.[apiFieldName] == null ? '' : String(row[apiFieldName]);
    return accumulator;
  }, {});

  if (row?.id != null) {
    normalizedRow.backendId = row.id;
  } else if (row?.backendId != null) {
    normalizedRow.backendId = row.backendId;
  }

  return normalizedRow;
}

function pickDefinedFields(source = {}, fieldNames = []) {
  return fieldNames.reduce((accumulator, fieldName) => {
    if (source[fieldName] !== undefined) {
      accumulator[fieldName] = source[fieldName];
    }
    return accumulator;
  }, {});
}

function coerceFlatFieldValue(section, fieldName, value) {
  const field = [
    ...(section.fields || []),
    ...(section.fileFields || []),
  ].find(item => item.fieldName === fieldName);

  if (!field) {
    return value;
  }

  if (section.fileFields?.some(item => item.fieldName === fieldName)) {
    return normalizeFileValue(value);
  }

  if (field.type === PROFILE_FIELD_TYPES.CHECKBOX) {
    return Boolean(value);
  }

  if (YES_NO_FIELD_NAMES.includes(fieldName)) {
    if (value === true) {
      return 'Yes';
    }
    if (value === false) {
      return 'No';
    }
    return '';
  }

  return value == null ? '' : String(value);
}

function normalizeFlatPayloadValue(fieldName, value) {
  if (YES_NO_FIELD_NAMES.includes(fieldName)) {
    if (value === 'Yes') {
      return true;
    }
    if (value === 'No') {
      return false;
    }
    return null;
  }

  return value;
}

export function normalizeBiodataErrorForSection(error, sectionId = null) {
  const processedError = Object.create(error);
  const errorData = error?.response?.data;
  const flatApiToUiFieldMap = sectionId ? getFlatApiToUiFieldMap(sectionId) : {};
  const repeatableApiToUiFieldMaps = sectionId
    ? getSectionRepeatableConfigs(BIODATA_SECTION_MAP[sectionId] || {})
      .reduce((accumulator, { repeatable }) => ({
        ...accumulator,
        ...getRepeatableApiToUiFieldMap(sectionId, repeatable.storageFieldName),
      }), {})
    : {};

  if (!errorData || typeof errorData !== 'object') {
    return error;
  }

  const normalizedFieldErrors = Object.entries(extractErrorMap(errorData)).reduce((accumulator, [fieldName, value]) => {
    accumulator[
      flatApiToUiFieldMap[fieldName]
      || repeatableApiToUiFieldMaps[fieldName]
      || fieldName
    ] = normalizeFieldError(value);
    return accumulator;
  }, {});

  processedError.processedData = {
    fieldErrors: normalizedFieldErrors,
  };

  return processedError;
}

export function normalizeBiodataError(error) {
  return normalizeBiodataErrorForSection(error);
}

function buildSectionEntries(section, flatResponse = {}, repeatableResponsesByKey = {}) {
  const flatFieldNames = getSectionFlatFieldNames(section);
  const flatApiToUiFieldMap = getFlatApiToUiFieldMap(section.id);
  const flatEntries = flatFieldNames.map((fieldName) => ({
    fieldName,
    fieldValue: coerceFlatFieldValue(
      section,
      fieldName,
      flatResponse[getFlatUiToApiFieldMap(section.id)[fieldName] || fieldName]
        ?? flatResponse[flatApiToUiFieldMap[fieldName] || fieldName],
    ),
  }));

  const repeatableEntries = getSectionRepeatableConfigs(section).map(({ repeatable }) => {
    const uiToApiFieldMap = getRepeatableUiToApiFieldMap(section.id, repeatable.storageFieldName);

    return {
      fieldName: repeatable.storageFieldName,
      fieldValue: (repeatableResponsesByKey[repeatable.storageFieldName] || [])
        .map(row => normalizeRepeatableRow(row, repeatable, uiToApiFieldMap)),
    };
  });

  const repeatableExtraEntries = getSectionRepeatableConfigs(section)
    .flatMap(({ repeatable }) => getRepeatableExtraFieldNames(section.id, repeatable.storageFieldName)
      .map((fieldName) => ({
        fieldName,
        fieldValue: Boolean(flatResponse[fieldName] ?? false),
      })));

  return [...flatEntries, ...repeatableEntries, ...repeatableExtraEntries];
}

function getSectionFieldNames(section) {
  return buildSectionEntries(section).map(entry => entry.fieldName);
}

export function buildBiodataExtendedProfile(flatResponsesBySection = {}, repeatableResponsesByKey = {}) {
  return getConfiguredBiodataSections().flatMap((section) => (
    buildSectionEntries(section, flatResponsesBySection[section.id] || {}, repeatableResponsesByKey)
  ));
}

export function buildSectionExtendedProfile(sectionId, flatResponse = {}, repeatableResponsesByKey = {}) {
  const section = BIODATA_SECTION_MAP[sectionId];

  if (!section) {
    return [];
  }

  return buildSectionEntries(section, flatResponse, repeatableResponsesByKey);
}

export function mergeSectionIntoExtendedProfile(sectionId, currentExtendedProfile = [], sectionEntries = []) {
  const section = BIODATA_SECTION_MAP[sectionId];

  if (!section) {
    return currentExtendedProfile;
  }

  const sectionFieldNames = new Set(getSectionFieldNames(section));

  return [
    ...(currentExtendedProfile || []).filter(entry => !sectionFieldNames.has(entry.fieldName)),
    ...sectionEntries,
  ];
}

export function mapSectionDataToFlatPayload(section, sectionData) {
  const sanitizedData = getSanitizedSectionData(section, sectionData);
  const fieldNames = getSectionFlatFieldNames(section);
  const flatUiToApiFieldMap = getFlatUiToApiFieldMap(section.id);

  return fieldNames.reduce((accumulator, fieldName) => {
    if (sanitizedData[fieldName] === undefined) {
      return accumulator;
    }

    const apiFieldName = flatUiToApiFieldMap[fieldName] || fieldName;
    accumulator[apiFieldName] = normalizeFlatPayloadValue(fieldName, sanitizedData[fieldName]);
    return accumulator;
  }, {});
}

export function mapSectionDataToRepeatablePayloads(section, sectionData) {
  const sanitizedData = getSanitizedSectionData(section, sectionData);

  return getSectionRepeatableConfigs(section).map(({ repeatable, endpoint }) => ({
    repeatable,
    endpoint,
    extraFields: pickDefinedFields(
      sanitizedData,
      getRepeatableExtraFieldNames(section.id, repeatable.storageFieldName),
    ),
    rows: (sanitizedData[repeatable.storageFieldName] || [])
      .filter((row) => repeatable.columns.some(({ key }) => String(row?.[key] || '').trim().length > 0))
      .map((row) => ({
        backendId: row.backendId ?? row.id ?? null,
        values: repeatable.columns.reduce((accumulator, { key }) => {
          const apiFieldName = getRepeatableUiToApiFieldMap(section.id, repeatable.storageFieldName)[key] || key;
          accumulator[apiFieldName] = row?.[key] ?? '';
          return accumulator;
        }, {}),
      })),
  }));
}

export function buildSectionDraftFromExtendedProfile(sectionId, extendedProfile) {
  const section = BIODATA_SECTION_MAP[sectionId];

  if (!section) {
    return {};
  }

  const fieldMap = (extendedProfile || []).reduce((accumulator, entry) => {
    accumulator[entry.fieldName] = entry.fieldValue;
    return accumulator;
  }, {});

  const baseDraft = {
    ...(section.naFieldName ? { [section.naFieldName]: Boolean(fieldMap[section.naFieldName]) } : {}),
    ...((section.fields || []).reduce((accumulator, field) => {
      accumulator[field.fieldName] = coerceFlatFieldValue(section, field.fieldName, fieldMap[field.fieldName]);
      return accumulator;
    }, {})),
    ...((section.fileFields || []).reduce((accumulator, field) => {
      accumulator[field.fieldName] = normalizeFileValue(fieldMap[field.fieldName]);
      return accumulator;
    }, {})),
  };

  const repeatableDraft = (section.repeatables || []).reduce((accumulator, repeatable) => {
    const uiToApiFieldMap = getRepeatableUiToApiFieldMap(sectionId, repeatable.storageFieldName);
    const rows = Array.isArray(fieldMap[repeatable.storageFieldName])
      ? fieldMap[repeatable.storageFieldName].map(row => normalizeRepeatableRow(row, repeatable, uiToApiFieldMap))
      : [];

    accumulator[repeatable.storageFieldName] = rows.length > 0
      ? rows
      : [createEmptyRepeatableRow(repeatable)];

    if (repeatable.naFieldName) {
      accumulator[repeatable.naFieldName] = Boolean(fieldMap[repeatable.naFieldName]);
    }

    return accumulator;
  }, {});

  const draft = {
    ...baseDraft,
    ...repeatableDraft,
  };

  if (sectionId === 'basicInformation' && isSingleMaritalStatus(draft.marital_status)) {
    draft.number_of_children = '';
    draft.sons = '';
    draft.daughters = '';
  }

  return getSanitizedSectionData(section, draft);
}

export function buildValidationPayload(section, sectionData) {
  return {
    section: section.id,
    flat: mapSectionDataToFlatPayload(section, sectionData),
    repeatables: mapSectionDataToRepeatablePayloads(section, sectionData).map((item) => ({
      path: item.endpoint.path,
      extraFields: item.extraFields,
      rows: item.rows,
    })),
  };
}
