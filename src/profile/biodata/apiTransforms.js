import {
  getConfiguredBiodataSections,
  getFlatUiToApiFieldMap,
  getRepeatableExtraFieldNames,
  getRepeatableExtraUiToApiFieldMap,
  getFlatApiToUiFieldMap,
  getRepeatableApiToUiFieldMap,
  getRepeatableUiToApiFieldMap,
  getSectionFlatFieldNames,
  getSectionRepeatableConfigs,
  sectionSupportsBackendSubmission,
} from './apiConfig';
import {
  PROFILE_FIELD_TYPES,
  BIODATA_SECTION_MAP,
} from './config';
import {
  createEmptyRepeatableRow,
  getFileUploadBlob,
  getSanitizedSectionData,
  getSectionSubmittedFieldName,
  isSingleMaritalStatus,
  normalizeRepeatableRows,
} from './utils';

const FILE_FIELD_KEYS = ['name', 'type', 'size', 'file', 'url', 'imageUrl', 'previewUrl'];
const YES_NO_FIELD_NAMES = [
  'applied_for_forthcoming_css_exam',
  'intend_to_sit_for_forthcoming_css_exam',
  'other_income_source_besides_salary',
  'is_first_job',
];
const CSS_EXAM_DETAILS_SECTION_ID = 'cssExamDetails';
const CSS_SERVICE_PREFERENCES_API_FIELD = 'service_preferences';
const CSS_SERVICE_PREFERENCES_UI_FIELD = 'occupational_service_group_preferences';
const DEMO_NOT_APPLICABLE_FIELD = 'not_applicable_demo';
const BACKEND_NOT_APPLICABLE_FIELD = 'not_applicable';
const BACKEND_IS_SUBMITTED_FIELD = 'is_submitted';

function humanizeFieldName(fieldName) {
  return String(fieldName || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function friendlyValidationMessage(message, fieldName = '') {
  const normalizedMessage = String(message || '').trim();
  const lowerMessage = normalizedMessage.toLowerCase();
  const fieldLabel = humanizeFieldName(fieldName);

  if (!normalizedMessage) {
    return fieldLabel ? `Please check ${fieldLabel}.` : 'Please check this field.';
  }

  if (lowerMessage.includes('date has wrong format')) {
    return 'Enter a valid date in YYYY-MM-DD format.';
  }

  if (lowerMessage.includes('this field is required') || lowerMessage === 'required') {
    return fieldLabel ? `${fieldLabel} is required.` : 'This field is required.';
  }

  if (lowerMessage.includes('valid cnic')) {
    return 'Enter a valid 13-digit CNIC number.';
  }

  if (lowerMessage.includes('cannot exceed total marks')) {
    return 'Marks obtained cannot be greater than total marks.';
  }

  if (lowerMessage.includes('enter a valid')) {
    return normalizedMessage;
  }

  return normalizedMessage;
}

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

function normalizeFieldError(errorValue, fieldName = '') {
  if (errorValue && typeof errorValue === 'object' && typeof errorValue.userMessage === 'string') {
    return {
      ...errorValue,
      userMessage: friendlyValidationMessage(errorValue.userMessage, fieldName),
    };
  }

  return {
    userMessage: friendlyValidationMessage(normalizeMessage(errorValue), fieldName),
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
    const file = getFileUploadBlob(value);
    if (file) {
      return {
        ...value,
        file,
        name: value.name || file.name,
        type: value.type || file.type,
        size: value.size || file.size,
      };
    }

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

function normalizeCssServicePreferenceRows(value) {
  const rows = (() => {
    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        return value.split('\n').filter(Boolean).map((item, index) => ({
          value: item,
          preference: index + 1,
        }));
      }
    }

    return [];
  })();

  return rows.map((row, index) => {
    const serviceGroup = row?.value
      ?? row?.service_group
      ?? row?.service_group_preference
      ?? row?.label
      ?? row?.name
      ?? row?.group
      ?? '';

    return {
      service_group_preference: serviceGroup == null ? '' : String(serviceGroup),
      priority: String(index + 1),
      ...(row?.id != null ? { backendId: row.id } : {}),
      ...(row?.backendId != null ? { backendId: row.backendId } : {}),
    };
  });
}

function getMappedFlatValue(section, flatResponse, fieldName) {
  const uiToApiFieldMap = getFlatUiToApiFieldMap(section.id);
  const flatApiToUiFieldMap = getFlatApiToUiFieldMap(section.id);

  return flatResponse[uiToApiFieldMap[fieldName] || fieldName]
    ?? flatResponse[flatApiToUiFieldMap[fieldName] || fieldName];
}

function normalizeRepeatableRow(row, repeatable, uiToApiFieldMap = {}) {
  const normalizedRow = repeatable.columns.reduce((accumulator, column) => {
    const apiFieldName = uiToApiFieldMap[column.key] || column.key;
    if (column.type === PROFILE_FIELD_TYPES.FILE) {
      accumulator[column.key] = normalizeFileValue(row?.[apiFieldName]);
      return accumulator;
    }

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

function mapRepeatableExtraFieldsToPayload(sectionId, storageFieldName, extraFields = {}) {
  const extraUiToApiFieldMap = getRepeatableExtraUiToApiFieldMap(sectionId, storageFieldName);

  return Object.entries(extraFields).reduce((accumulator, [fieldName, value]) => {
    const apiFieldName = extraUiToApiFieldMap[fieldName] || fieldName;
    accumulator[apiFieldName] = normalizeFlatPayloadValue(fieldName, value);
    return accumulator;
  }, {});
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
      (sectionId === CSS_EXAM_DETAILS_SECTION_ID && fieldName === CSS_SERVICE_PREFERENCES_API_FIELD
        ? CSS_SERVICE_PREFERENCES_UI_FIELD
        : null)
      || flatApiToUiFieldMap[fieldName]
      || repeatableApiToUiFieldMaps[fieldName]
      || fieldName
    ] = normalizeFieldError(value, fieldName);
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
  const flatEntries = flatFieldNames.map((fieldName) => {
    const rawValue = getMappedFlatValue(section, flatResponse, fieldName);
    const shouldDeferEmploymentChoice = section.id === 'employment'
      && fieldName === 'is_first_job'
      && rawValue === false
      && flatResponse[BACKEND_IS_SUBMITTED_FIELD] !== true;

    return {
      fieldName,
      fieldValue: shouldDeferEmploymentChoice ? '' : coerceFlatFieldValue(
        section,
        fieldName,
        rawValue,
      ),
    };
  });
  const sectionNaEntries = section.naFieldName
    ? [{
      fieldName: section.naFieldName,
      fieldValue: Boolean(
        getMappedFlatValue(section, flatResponse, section.naFieldName)
        ?? flatResponse[BACKEND_NOT_APPLICABLE_FIELD]
        ?? flatResponse[DEMO_NOT_APPLICABLE_FIELD]
        ?? false,
      ),
    }]
    : [];
  const submittedFieldName = getSectionSubmittedFieldName(section.id);
  const submissionEntries = (
    sectionSupportsBackendSubmission(section.id)
    || flatResponse[submittedFieldName] !== undefined
    || flatResponse[BACKEND_IS_SUBMITTED_FIELD] !== undefined
  )
    ? [{
      fieldName: submittedFieldName,
      fieldValue: Boolean(flatResponse[submittedFieldName] ?? flatResponse[BACKEND_IS_SUBMITTED_FIELD]),
    }]
    : [];

  const configuredRepeatableStorageFieldNames = new Set(
    getSectionRepeatableConfigs(section).map(({ repeatable }) => repeatable.storageFieldName),
  );
  const embeddedRepeatableEntries = section.id === CSS_EXAM_DETAILS_SECTION_ID
    && !configuredRepeatableStorageFieldNames.has(CSS_SERVICE_PREFERENCES_UI_FIELD)
    ? [{
      fieldName: CSS_SERVICE_PREFERENCES_UI_FIELD,
      fieldValue: normalizeCssServicePreferenceRows(flatResponse[CSS_SERVICE_PREFERENCES_API_FIELD]),
    }]
    : [];
  const repeatableEntries = getSectionRepeatableConfigs(section).map(({ repeatable }) => {
    const uiToApiFieldMap = getRepeatableUiToApiFieldMap(section.id, repeatable.storageFieldName);

    return {
      fieldName: repeatable.storageFieldName,
      fieldValue: (repeatableResponsesByKey[repeatable.storageFieldName] || [])
        .map(row => normalizeRepeatableRow(row, repeatable, uiToApiFieldMap)),
    };
  });
  const localRepeatableEntries = (section.repeatables || [])
    .filter(repeatable => !configuredRepeatableStorageFieldNames.has(repeatable.storageFieldName))
    .filter(repeatable => (
      section.id !== CSS_EXAM_DETAILS_SECTION_ID
      || repeatable.storageFieldName !== CSS_SERVICE_PREFERENCES_UI_FIELD
    ))
    .map(repeatable => ({
      fieldName: repeatable.storageFieldName,
      fieldValue: [],
    }));

  const repeatableExtraEntries = getSectionRepeatableConfigs(section)
    .flatMap(({ repeatable }) => getRepeatableExtraFieldNames(section.id, repeatable.storageFieldName)
      .map((fieldName) => ({
        fieldName,
        fieldValue: Boolean(flatResponse[fieldName] ?? false),
      })));
  const repeatableNaEntries = (section.repeatables || [])
    .filter(repeatable => repeatable.naFieldName)
    .map(repeatable => ({
      fieldName: repeatable.naFieldName,
      fieldValue: Boolean(flatResponse[repeatable.naFieldName] ?? false),
    }));

  return [
    ...sectionNaEntries,
    ...submissionEntries,
    ...flatEntries,
    ...embeddedRepeatableEntries,
    ...repeatableEntries,
    ...localRepeatableEntries,
    ...repeatableExtraEntries,
    ...repeatableNaEntries,
  ];
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

  const payload = fieldNames.reduce((accumulator, fieldName) => {
    if (sanitizedData[fieldName] === undefined) {
      return accumulator;
    }

    const field = [
      ...(section.fields || []),
      ...(section.fileFields || []),
    ].find(item => item.fieldName === fieldName);
    const apiFieldName = flatUiToApiFieldMap[fieldName] || fieldName;
    if (field && section.fileFields?.some(item => item.fieldName === fieldName)) {
      if (getFileUploadBlob(sanitizedData[fieldName])) {
        accumulator[apiFieldName] = normalizeFileValue(sanitizedData[fieldName]);
      }
      return accumulator;
    }

    accumulator[apiFieldName] = normalizeFlatPayloadValue(fieldName, sanitizedData[fieldName]);
    return accumulator;
  }, {});

  if (section.naFieldName) {
    const apiFieldName = flatUiToApiFieldMap[section.naFieldName]
      || BACKEND_NOT_APPLICABLE_FIELD;

    payload[apiFieldName] = Boolean(sanitizedData[section.naFieldName]);
  }

  if (section.id === 'employment') {
    payload[BACKEND_NOT_APPLICABLE_FIELD] = sanitizedData.is_first_job === 'Yes';
  }

  return payload;
}

export function mapSectionDataToRepeatablePayloads(section, sectionData) {
  const sanitizedData = getSanitizedSectionData(section, sectionData);

  return getSectionRepeatableConfigs(section).filter(({ endpoint }) => {
    const skipRule = endpoint.skipWhenFieldEquals;

    return !skipRule || sanitizedData[skipRule.fieldName] !== skipRule.value;
  }).map(({ repeatable, endpoint }) => {
    const extraFields = mapRepeatableExtraFieldsToPayload(
      section.id,
      repeatable.storageFieldName,
      pickDefinedFields(
        sanitizedData,
        getRepeatableExtraFieldNames(section.id, repeatable.storageFieldName),
      ),
    );
    const rows = (sanitizedData[repeatable.storageFieldName] || [])
      .filter((row) => repeatable.columns.some(({ key, type }) => (
        type === PROFILE_FIELD_TYPES.FILE
          ? Boolean(row?.[key])
          : String(row?.[key] || '').trim().length > 0
      )))
      .map((row) => ({
        backendId: row.backendId ?? row.id ?? null,
        values: repeatable.columns.reduce((accumulator, { key, type }) => {
          const apiFieldName = getRepeatableUiToApiFieldMap(section.id, repeatable.storageFieldName)[key] || key;
          if (type === PROFILE_FIELD_TYPES.FILE) {
            if (getFileUploadBlob(row?.[key])) {
              accumulator[apiFieldName] = normalizeFileValue(row?.[key]);
            }
            return accumulator;
          }

          accumulator[apiFieldName] = row?.[key] ?? '';
          return accumulator;
        }, {}),
      }));
    const shouldMergeExtraFieldsIntoRows = endpoint.mergeExtraFieldsIntoRows && rows.length > 0;

    return {
      repeatable,
      endpoint,
      extraFields: shouldMergeExtraFieldsIntoRows ? {} : extraFields,
      rows: shouldMergeExtraFieldsIntoRows
        ? rows.map(row => ({
          ...row,
          values: {
            ...extraFields,
            ...row.values,
          },
        }))
        : rows,
    };
  });
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
    const defaultRows = repeatable.defaultRows || [];
    let draftRows = rows;

    if (draftRows.length === 0 && defaultRows.length > 0) {
      draftRows = defaultRows.map(row => createEmptyRepeatableRow({ ...repeatable, emptyRow: row }));
    }

    if (draftRows.length === 0) {
      draftRows = [createEmptyRepeatableRow(repeatable)];
    }

    accumulator[repeatable.storageFieldName] = normalizeRepeatableRows(draftRows, repeatable);

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
