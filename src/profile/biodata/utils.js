import { getConfig } from '@edx/frontend-platform';

import { BIODATA_SECTION_MAP, PROFILE_FIELD_TYPES } from './config';

let repeatableRowCounter = 0;
const BASIC_INFORMATION_CHILD_FIELD_NAMES = ['number_of_children', 'sons', 'daughters'];
const SPOUSE_FIELD_NAMES = [
  'spouse_name',
  'spouse_education',
  'spouse_occupation',
  'spouse_address',
  'spouse_phone',
];
const EMPLOYMENT_SECTION_ID = 'employment';
const EMPLOYMENT_RECORDS_FIELD_NAME = 'employment_records';
const FIRST_JOB_FIELD_NAME = 'is_first_job';
const FIRST_JOB_GAP_FIELD_NAME = 'first_employment_gap_details_after_education';
const CSS_EXAM_DETAILS_SECTION_ID = 'cssExamDetails';
const CSS_SERVICE_PREFERENCES_FIELD_NAME = 'occupational_service_group_preferences';
const CSS_SUBJECT_MARKS_FIELD_NAME = 'css_subject_marks';
const EDUCATION_SECTION_ID = 'education';
const EDUCATION_RECORDS_FIELD_NAME = 'education_records';
const FOREIGN_VISITS_SECTION_ID = 'foreignVisits';
const FOREIGN_VISITS_FIELD_NAME = 'foreign_visits';
const GOVERNMENT_SERVICE_DETAILS_SECTION_ID = 'governmentServiceDetails';
const OTHER_INCOME_SOURCE_FIELD_NAME = 'other_income_source_besides_salary';
const OTHER_INCOME_DETAILS_FIELD_NAME = 'other_income_details';
const EDUCATION_ATTENDED_TO_DATE_MESSAGE = 'Attended To must be later than Attended From.';
const EDUCATION_YEAR_OF_PASSING_MESSAGE = 'Year of Passing must be the same as the Attended To year.';
const FOREIGN_VISIT_TO_DATE_MESSAGE = 'To date must be on or after From date.';
const EMPLOYMENT_TO_DATE_MESSAGE = 'To date must be on or after From date.';
export const BIODATA_DATE_VALIDATION_MESSAGES = [
  EDUCATION_ATTENDED_TO_DATE_MESSAGE,
  EDUCATION_YEAR_OF_PASSING_MESSAGE,
  FOREIGN_VISIT_TO_DATE_MESSAGE,
  EMPLOYMENT_TO_DATE_MESSAGE,
];
const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CNIC_FORMAT = /^\d{13}$/;
const PAKISTAN_MOBILE_FORMAT = /^(?:\+92|92|0)3[0-9]{9}$/;
const PAKISTAN_MOBILE_VALIDATION_MESSAGE = 'Enter a valid Pakistan mobile number, e.g. +923001234567.';
const PAKISTAN_MOBILE_FIELD_NAMES = [
  'permanent_phone_number',
  'present_phone_number',
  'lahore_phone_number',
  'mobile_number',
  'father_phone_number',
  'mother_phone_number',
  'spouse_phone',
];
const CONDITIONAL_FILE_FIELD_DEPENDENCIES = {
  cnic_front: 'identity_card_number',
  cnic_back: 'identity_card_number',
  domicile_file: 'district_of_domicile',
};

export function getSectionSubmittedFieldName(sectionId) {
  return `${sectionId}_is_submitted`;
}

export function isBrowserFile(value) {
  return typeof File !== 'undefined' && value instanceof File;
}

export function getFileUploadBlob(fileValue) {
  if (isBrowserFile(fileValue)) {
    return fileValue;
  }

  if (isBrowserFile(fileValue?.file)) {
    return fileValue.file;
  }

  return null;
}

export function createFileUploadValue(file) {
  if (!file) {
    return null;
  }

  return {
    name: file.name,
    type: file.type,
    size: file.size,
    file,
    previewUrl: typeof URL !== 'undefined' && URL.createObjectURL
      ? URL.createObjectURL(file)
      : null,
  };
}

function getFileExtension(value) {
  const normalizedValue = String(value || '').split(/[?#]/)[0].trim();
  const extensionMatch = normalizedValue.match(/\.([a-z0-9]+)$/i);
  return extensionMatch ? extensionMatch[1].toLowerCase() : '';
}

function getFileNameFromUrl(url) {
  const filename = String(url || '').split(/[?#]/)[0].split('/').pop();
  if (!filename) {
    return 'file';
  }

  try {
    return decodeURIComponent(filename);
  } catch (error) {
    return filename;
  }
}

function getLmsBaseUrl() {
  try {
    return getConfig().LMS_BASE_URL || '';
  } catch (error) {
    return '';
  }
}

function resolveFilePreviewUrl(url) {
  const normalizedUrl = String(url || '').trim();

  if (!normalizedUrl) {
    return '';
  }

  if (/^(https?:|blob:|data:)/i.test(normalizedUrl)) {
    return normalizedUrl;
  }

  const lmsBaseUrl = getLmsBaseUrl();
  if (!lmsBaseUrl) {
    return normalizedUrl.startsWith('/') ? normalizedUrl : `/${normalizedUrl}`;
  }

  return `${lmsBaseUrl.replace(/\/$/, '')}/${normalizedUrl.replace(/^\//, '')}`;
}

function getFilePreviewKind(isImage, isPdf) {
  if (isImage) {
    return 'image';
  }

  if (isPdf) {
    return 'pdf';
  }

  return 'document';
}

export function revokeFilePreviewUrl(fileValue) {
  if (
    fileValue?.previewUrl
    && String(fileValue.previewUrl).startsWith('blob:')
    && typeof URL !== 'undefined'
    && URL.revokeObjectURL
  ) {
    URL.revokeObjectURL(fileValue.previewUrl);
  }
}

export function getFilePreview(fileValue) {
  if (!fileValue) {
    return null;
  }

  if (typeof fileValue === 'string') {
    const url = resolveFilePreviewUrl(fileValue);
    const name = getFileNameFromUrl(url);
    const extension = getFileExtension(url);
    const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension);
    const isPdf = extension === 'pdf';

    return {
      name,
      url,
      kind: getFilePreviewKind(isImage, isPdf),
      canOpen: Boolean(url),
    };
  }

  const fileBlob = getFileUploadBlob(fileValue);
  const rawUrl = fileValue.previewUrl || fileValue.url || fileValue.imageUrl || '';
  const url = resolveFilePreviewUrl(rawUrl);
  const name = fileValue.name || fileBlob?.name || getFileNameFromUrl(url);
  const mimeType = String(fileValue.type || fileBlob?.type || '').toLowerCase();
  const extension = getFileExtension(name) || getFileExtension(url);
  const isImage = mimeType.startsWith('image/')
    || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension);
  const isPdf = mimeType === 'application/pdf' || extension === 'pdf';

  return {
    name,
    url,
    kind: getFilePreviewKind(isImage, isPdf),
    canOpen: Boolean(url),
  };
}

function normalizeFileFieldValue(storedValue) {
  if (!storedValue) {
    return null;
  }

  if (isBrowserFile(storedValue)) {
    return createFileUploadValue(storedValue);
  }

  if (typeof storedValue === 'object') {
    if (getFileUploadBlob(storedValue)) {
      return {
        ...storedValue,
        name: storedValue.name || storedValue.file.name,
        type: storedValue.type || storedValue.file.type,
        size: storedValue.size || storedValue.file.size,
      };
    }

    if (storedValue.name && (storedValue.url || storedValue.imageUrl || storedValue.previewUrl)) {
      return {
        name: String(storedValue.name),
        ...(storedValue.url ? { url: String(storedValue.url) } : {}),
        ...(storedValue.imageUrl ? { imageUrl: String(storedValue.imageUrl) } : {}),
        ...(storedValue.previewUrl ? { previewUrl: String(storedValue.previewUrl) } : {}),
        ...(storedValue.type ? { type: String(storedValue.type) } : {}),
        ...(storedValue.size ? { size: storedValue.size } : {}),
      };
    }
    return null;
  }

  try {
    const parsed = JSON.parse(storedValue);
    if (parsed && parsed.name && (parsed.url || parsed.imageUrl || parsed.previewUrl)) {
      return {
        name: String(parsed.name),
        ...(parsed.url ? { url: String(parsed.url) } : {}),
        ...(parsed.imageUrl ? { imageUrl: String(parsed.imageUrl) } : {}),
        ...(parsed.previewUrl ? { previewUrl: String(parsed.previewUrl) } : {}),
        ...(parsed.type ? { type: String(parsed.type) } : {}),
        ...(parsed.size ? { size: parsed.size } : {}),
      };
    }
  } catch (error) {
    return {
      name: String(storedValue).split('/').pop() || 'file',
      url: String(storedValue),
    };
  }

  return null;
}

function normalizeCnicValue(value) {
  return String(value || '').trim().replace(/^(\d{5})\s+(\d{7}-\d)$/, '$1-$2');
}

function compactPhoneValue(value) {
  return String(value || '').trim();
}

export function isValidPakistanMobileNumber(value) {
  return PAKISTAN_MOBILE_FORMAT.test(compactPhoneValue(value));
}

export function normalizePakistanMobileValue(value) {
  const compactValue = compactPhoneValue(value);

  if (!isValidPakistanMobileNumber(compactValue)) {
    return String(value || '').trim();
  }

  if (compactValue.startsWith('+92')) {
    return compactValue;
  }

  if (compactValue.startsWith('92')) {
    return `+${compactValue}`;
  }

  return `+92${compactValue.slice(1)}`;
}

function normalizePhoneFields(sanitizedData) {
  const normalizedData = { ...sanitizedData };

  PAKISTAN_MOBILE_FIELD_NAMES.forEach((fieldName) => {
    if (sanitizedData[fieldName] !== undefined) {
      normalizedData[fieldName] = normalizePakistanMobileValue(sanitizedData[fieldName]);
    }
  });

  return normalizedData;
}

function buildRepeatableRow(row, repeatableConfig) {
  const normalizedRow = repeatableConfig.columns.reduce((accumulator, column) => {
    if (column.type === PROFILE_FIELD_TYPES.FILE) {
      accumulator[column.key] = normalizeFileFieldValue(row && row[column.key]);
      return accumulator;
    }

    accumulator[column.key] = String((row && row[column.key]) || '');
    return accumulator;
  }, {});

  repeatableRowCounter += 1;

  return {
    ...normalizedRow,
    ...(row?.backendId != null ? { backendId: row.backendId } : {}),
    ...(row?.id != null ? { backendId: row.id } : {}),
    rowId: `row-${repeatableRowCounter}`,
  };
}

function normalizeProtectedRowValue(value) {
  return String(value || '').trim().toLowerCase();
}

function hasProtectedRows(repeatableConfig) {
  return Boolean(
    repeatableConfig.protectedRowKey
    && Array.isArray(repeatableConfig.protectedRows)
    && repeatableConfig.protectedRows.length > 0,
  );
}

export function isProtectedRepeatableRow(row, repeatableConfig) {
  if (!hasProtectedRows(repeatableConfig)) {
    return false;
  }

  const protectedValues = repeatableConfig.protectedRows.map(protectedRow => (
    normalizeProtectedRowValue(protectedRow[repeatableConfig.protectedRowKey])
  ));

  return protectedValues.includes(normalizeProtectedRowValue(row?.[repeatableConfig.protectedRowKey]));
}

export function isProtectedRepeatableColumn(row, repeatableConfig, columnKey) {
  return isProtectedRepeatableRow(row, repeatableConfig)
    && (repeatableConfig.protectedColumns || []).includes(columnKey);
}

function normalizeProtectedRepeatableRows(rows, repeatableConfig) {
  if (!hasProtectedRows(repeatableConfig)) {
    return rows;
  }

  const protectedColumns = repeatableConfig.protectedColumns || [];
  const protectedRows = repeatableConfig.protectedRows.map((protectedRow) => {
    const matchingRow = rows.find(row => (
      normalizeProtectedRowValue(row?.[repeatableConfig.protectedRowKey])
      === normalizeProtectedRowValue(protectedRow[repeatableConfig.protectedRowKey])
    ));

    if (!matchingRow) {
      return buildRepeatableRow({
        ...repeatableConfig.emptyRow,
        ...protectedRow,
      }, repeatableConfig);
    }

    return protectedColumns.reduce((accumulator, columnKey) => ({
      ...accumulator,
      [columnKey]: String(protectedRow[columnKey] || ''),
    }), { ...matchingRow });
  });

  const protectedValues = new Set(repeatableConfig.protectedRows.map(protectedRow => (
    normalizeProtectedRowValue(protectedRow[repeatableConfig.protectedRowKey])
  )));
  const customRows = rows.filter(row => (
    !protectedValues.has(normalizeProtectedRowValue(row?.[repeatableConfig.protectedRowKey]))
  ));

  return [...protectedRows, ...customRows];
}

export function normalizeAutoPriorityRows(rows, repeatableConfig) {
  if (!repeatableConfig.autoPriorityKey) {
    return rows;
  }

  return (rows || []).map((row, index) => ({
    ...row,
    [repeatableConfig.autoPriorityKey]: String(index + 1),
  }));
}

export function normalizeRepeatableRows(rows, repeatableConfig) {
  return normalizeAutoPriorityRows(
    normalizeProtectedRepeatableRows(rows, repeatableConfig),
    repeatableConfig,
  );
}

export function getExtendedProfileValue(extendedProfile, fieldName) {
  const field = (extendedProfile || []).find((item) => item.fieldName === fieldName);
  return field ? field.fieldValue : '';
}

export function isSingleMaritalStatus(value) {
  return String(value || '').trim().toLowerCase() === 'single';
}

export function shouldShowSpouseInformation(value) {
  return String(value || '').trim().length > 0 && !isSingleMaritalStatus(value);
}

export function isFirstJob(value) {
  return String(value || '').trim().toLowerCase() === 'yes';
}

export function hasPreviousEmployment(value) {
  return String(value || '').trim().toLowerCase() === 'no';
}

export function hasOtherIncome(value) {
  return String(value || '').trim().toLowerCase() === 'yes';
}

export function normalizeFieldValue(field, storedValue) {
  if (field.type === PROFILE_FIELD_TYPES.CHECKBOX) {
    return String(storedValue).toLowerCase() === 'true';
  }

  return String(storedValue || '');
}

export function parseRepeatableRows(storedValue, repeatableConfig) {
  const defaultRows = repeatableConfig.defaultRows || [];
  const buildRows = rows => normalizeRepeatableRows(
    rows.map(row => buildRepeatableRow(row, repeatableConfig)),
    repeatableConfig,
  );
  const buildEmptyRows = () => buildRows([repeatableConfig.emptyRow]);

  if (!storedValue) {
    if (defaultRows.length > 0) {
      return buildRows(defaultRows);
    }
    return buildEmptyRows();
  }

  if (Array.isArray(storedValue)) {
    if (storedValue.length > 0) {
      return buildRows(storedValue);
    }
    if (defaultRows.length > 0) {
      return buildRows(defaultRows);
    }
    return buildEmptyRows();
  }

  try {
    const parsed = JSON.parse(storedValue);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return buildRows(parsed);
    }
    if (Array.isArray(parsed) && defaultRows.length > 0) {
      return buildRows(defaultRows);
    }
  } catch (error) {
    return buildEmptyRows();
  }

  if (defaultRows.length > 0) {
    return buildRows(defaultRows);
  }

  return buildEmptyRows();
}

export function serializeRepeatableRows(rows, repeatableConfig) {
  return JSON.stringify((rows || [])
    .map((row) => {
      const normalizedRow = repeatableConfig.columns.reduce((accumulator, column) => {
        if (column.type === PROFILE_FIELD_TYPES.FILE) {
          const fileValue = normalizeFileFieldValue(row && row[column.key]);
          accumulator[column.key] = fileValue?.url || fileValue?.name || '';
          return accumulator;
        }

        accumulator[column.key] = String((row && row[column.key]) || '').trim();
        return accumulator;
      }, {});

      if (row?.backendId != null) {
        normalizedRow.backendId = row.backendId;
      }

      return normalizedRow;
    })
    .filter((row) => Object.entries(row)
      .some(([key, value]) => key === 'backendId' || String(value || '').length > 0)));
}

export function parseFileFieldValue(storedValue) {
  return normalizeFileFieldValue(storedValue);
}

export function serializeFileFieldValue(fileValue) {
  const normalizedValue = normalizeFileFieldValue(fileValue);

  return normalizedValue?.url || normalizedValue?.name || '';
}

export function getSectionInitialData(section, extendedProfile) {
  const fieldValues = (section.fields || []).reduce((accumulator, field) => {
    accumulator[field.fieldName] = normalizeFieldValue(
      field,
      getExtendedProfileValue(extendedProfile, field.fieldName),
    );
    return accumulator;
  }, {});

  const repeatableValues = (section.repeatables || []).reduce((accumulator, repeatable) => {
    accumulator[repeatable.storageFieldName] = parseRepeatableRows(
      getExtendedProfileValue(extendedProfile, repeatable.storageFieldName),
      repeatable,
    );
    return accumulator;
  }, {});

  const fileValues = (section.fileFields || []).reduce((accumulator, field) => {
    accumulator[field.fieldName] = parseFileFieldValue(
      getExtendedProfileValue(extendedProfile, field.fieldName),
    );
    return accumulator;
  }, {});

  const submittedFieldName = getSectionSubmittedFieldName(section.id);
  const hasSubmittedField = (extendedProfile || []).some(entry => entry.fieldName === submittedFieldName);
  const toggleValues = [
    ...(hasSubmittedField ? [{ fieldName: submittedFieldName, type: PROFILE_FIELD_TYPES.CHECKBOX }] : []),
    ...(section.naFieldName ? [{ fieldName: section.naFieldName, type: PROFILE_FIELD_TYPES.CHECKBOX }] : []),
    ...((section.repeatables || [])
      .filter((repeatable) => repeatable.naFieldName)
      .map((repeatable) => ({
        fieldName: repeatable.naFieldName,
        type: PROFILE_FIELD_TYPES.CHECKBOX,
      }))),
  ].reduce((accumulator, field) => {
    accumulator[field.fieldName] = normalizeFieldValue(
      field,
      getExtendedProfileValue(extendedProfile, field.fieldName),
    );
    return accumulator;
  }, {});

  return {
    ...toggleValues,
    ...fieldValues,
    ...repeatableValues,
    ...fileValues,
  };
}

export function getSanitizedSectionData(section, sectionData) {
  let sanitizedData = { ...sectionData };

  if (section.id === 'basicInformation') {
    sanitizedData.identity_card_number = normalizeCnicValue(sanitizedData.identity_card_number);
  }

  sanitizedData = normalizePhoneFields(sanitizedData);

  if (section.naFieldName && sanitizedData[section.naFieldName]) {
    (section.fields || []).forEach((field) => {
      sanitizedData[field.fieldName] = field.type === PROFILE_FIELD_TYPES.CHECKBOX ? false : '';
    });
    (section.repeatables || []).forEach((repeatable) => {
      sanitizedData[repeatable.storageFieldName] = [buildRepeatableRow(repeatable.emptyRow, repeatable)];
    });
    (section.fileFields || []).forEach((field) => {
      sanitizedData[field.fieldName] = null;
    });
  }

  (section.repeatables || []).forEach((repeatable) => {
    if (repeatable.naFieldName && sanitizedData[repeatable.naFieldName]) {
      sanitizedData[repeatable.storageFieldName] = [buildRepeatableRow(repeatable.emptyRow, repeatable)];
    } else {
      sanitizedData[repeatable.storageFieldName] = normalizeRepeatableRows(
        sanitizedData[repeatable.storageFieldName] || [],
        repeatable,
      );
    }
  });

  if (section.id === 'basicInformation' && isSingleMaritalStatus(sanitizedData.marital_status)) {
    BASIC_INFORMATION_CHILD_FIELD_NAMES.forEach((fieldName) => {
      sanitizedData[fieldName] = '0';
    });
  }

  if (section.id === 'employment') {
    if (isFirstJob(sanitizedData[FIRST_JOB_FIELD_NAME])) {
      const employmentRepeatable = section.repeatables?.find(
        repeatable => repeatable.storageFieldName === EMPLOYMENT_RECORDS_FIELD_NAME,
      );
      if (employmentRepeatable) {
        sanitizedData[EMPLOYMENT_RECORDS_FIELD_NAME] = [buildRepeatableRow(
          employmentRepeatable.emptyRow,
          employmentRepeatable,
        )];
      }
    } else if (hasPreviousEmployment(sanitizedData[FIRST_JOB_FIELD_NAME])) {
      sanitizedData[FIRST_JOB_GAP_FIELD_NAME] = '';
    } else {
      sanitizedData[FIRST_JOB_GAP_FIELD_NAME] = '';
    }
  }

  if (
    section.id === GOVERNMENT_SERVICE_DETAILS_SECTION_ID
    && !hasOtherIncome(sanitizedData[OTHER_INCOME_SOURCE_FIELD_NAME])
  ) {
    sanitizedData[OTHER_INCOME_DETAILS_FIELD_NAME] = '';
  }

  return sanitizedData;
}

export function getVisibleSectionFields(section, sectionData) {
  return (section.fields || []).filter((field) => (
    (
      section.id !== 'basicInformation'
      || !BASIC_INFORMATION_CHILD_FIELD_NAMES.includes(field.fieldName)
      || shouldShowSpouseInformation(sectionData.marital_status)
    )
    && (
      section.id !== 'employment'
      || field.fieldName === FIRST_JOB_FIELD_NAME
      || (field.fieldName === FIRST_JOB_GAP_FIELD_NAME && isFirstJob(sectionData[FIRST_JOB_FIELD_NAME]))
    )
    && (
      section.id !== GOVERNMENT_SERVICE_DETAILS_SECTION_ID
      || field.fieldName !== OTHER_INCOME_DETAILS_FIELD_NAME
      || hasOtherIncome(sectionData[OTHER_INCOME_SOURCE_FIELD_NAME])
    )
  ));
}

export function getVisibleSectionRepeatables(section, sectionData) {
  return (section.repeatables || []).filter((repeatable) => (
    section.id !== 'employment'
    || repeatable.storageFieldName !== EMPLOYMENT_RECORDS_FIELD_NAME
    || hasPreviousEmployment(sectionData[FIRST_JOB_FIELD_NAME])
  ));
}

function hasFieldValue(value) {
  return String(value ?? '').trim().length > 0;
}

function getRequiredFieldMessage(label) {
  return `${label} is required.`;
}

export function getRepeatableFieldErrorKey(repeatable, row, fieldName) {
  return `${repeatable.storageFieldName}.${row?.rowId || 'row'}.${fieldName}`;
}

function getRepeatableFieldError(repeatable, row, fieldName, userMessage) {
  return {
    fieldName: getRepeatableFieldErrorKey(repeatable, row, fieldName),
    userMessage,
  };
}

function isValidDateValue(value) {
  return DATE_FORMAT.test(String(value ?? '').trim());
}

function getYearFromDateValue(value) {
  return String(value || '').slice(0, 4);
}

function validateFieldFormat(field, value) {
  const trimmedValue = String(value ?? '').trim();

  if (!trimmedValue) {
    return '';
  }

  if (field.type === PROFILE_FIELD_TYPES.DATE && !DATE_FORMAT.test(trimmedValue)) {
    return 'Enter a valid date in YYYY-MM-DD format.';
  }

  if (field.fieldName === 'identity_card_number' && !CNIC_FORMAT.test(trimmedValue)) {
    return 'Enter a valid 13-digit CNIC number.';
  }

  if (field.fieldName === 'contact_email' && !EMAIL_FORMAT.test(trimmedValue)) {
    return 'Enter a valid email address.';
  }

  if (PAKISTAN_MOBILE_FIELD_NAMES.includes(field.fieldName) && !isValidPakistanMobileNumber(trimmedValue)) {
    return PAKISTAN_MOBILE_VALIDATION_MESSAGE;
  }

  if (field.type === PROFILE_FIELD_TYPES.NUMBER && Number.isNaN(Number(trimmedValue))) {
    return `${field.label} must be a number.`;
  }

  return '';
}

function validateEducationRowDateRules(repeatable, row) {
  const validationErrors = {};
  const attendedFrom = String(row.attended_from || '').trim();
  const attendedTo = String(row.attended_to || '').trim();
  const yearOfPassing = String(row.year_of_passing || '').trim();

  if (isValidDateValue(attendedFrom) && isValidDateValue(attendedTo) && attendedTo < attendedFrom) {
    const error = getRepeatableFieldError(repeatable, row, 'attended_to', EDUCATION_ATTENDED_TO_DATE_MESSAGE);
    validationErrors[error.fieldName] = { userMessage: error.userMessage };
  }

  if (isValidDateValue(attendedTo) && yearOfPassing && yearOfPassing !== getYearFromDateValue(attendedTo)) {
    const error = getRepeatableFieldError(repeatable, row, 'year_of_passing', EDUCATION_YEAR_OF_PASSING_MESSAGE);
    validationErrors[error.fieldName] = { userMessage: error.userMessage };
  }

  return validationErrors;
}

function validateEmploymentRowDateRules(repeatable, row) {
  const validationErrors = {};
  const fromDate = String(row.from || '').trim();
  const toDate = String(row.to || '').trim();

  if (isValidDateValue(fromDate) && isValidDateValue(toDate) && toDate < fromDate) {
    const error = getRepeatableFieldError(repeatable, row, 'to', EMPLOYMENT_TO_DATE_MESSAGE);
    validationErrors[error.fieldName] = { userMessage: error.userMessage };
  }

  return validationErrors;
}

function validateForeignVisitRowDateRules(repeatable, row) {
  const validationErrors = {};
  const fromDate = String(row.from || '').trim();
  const toDate = String(row.to || '').trim();

  if (isValidDateValue(fromDate) && isValidDateValue(toDate) && toDate < fromDate) {
    const error = getRepeatableFieldError(repeatable, row, 'to', FOREIGN_VISIT_TO_DATE_MESSAGE);
    validationErrors[error.fieldName] = { userMessage: error.userMessage };
  }

  return validationErrors;
}

export function validateSectionDateRules(section, sectionData) {
  const validationErrors = {};

  if (section.id === EDUCATION_SECTION_ID) {
    const educationRepeatable = (section.repeatables || [])
      .find(repeatable => repeatable.storageFieldName === EDUCATION_RECORDS_FIELD_NAME);

    (sectionData[EDUCATION_RECORDS_FIELD_NAME] || []).forEach((row) => {
      Object.assign(validationErrors, validateEducationRowDateRules(educationRepeatable, row));
    });
  }

  if (section.id === FOREIGN_VISITS_SECTION_ID) {
    const foreignVisitsRepeatable = (section.repeatables || [])
      .find(repeatable => repeatable.storageFieldName === FOREIGN_VISITS_FIELD_NAME);

    if (!sectionData[section.naFieldName]) {
      (sectionData[FOREIGN_VISITS_FIELD_NAME] || []).forEach((row) => {
        Object.assign(validationErrors, validateForeignVisitRowDateRules(foreignVisitsRepeatable, row));
      });
    }
  }

  if (section.id === EMPLOYMENT_SECTION_ID) {
    const employmentRepeatable = (section.repeatables || [])
      .find(repeatable => repeatable.storageFieldName === EMPLOYMENT_RECORDS_FIELD_NAME);

    (sectionData[EMPLOYMENT_RECORDS_FIELD_NAME] || []).forEach((row) => {
      Object.assign(validationErrors, validateEmploymentRowDateRules(employmentRepeatable, row));
    });
  }

  return validationErrors;
}

export function validateSectionDraft(section, sectionData) {
  const sanitizedData = getSanitizedSectionData(section, sectionData);
  const validationErrors = {
    ...validateSectionDateRules(section, sanitizedData),
  };

  if (section.naFieldName && sanitizedData[section.naFieldName]) {
    return validationErrors;
  }

  getVisibleSectionFields(section, sanitizedData).forEach((field) => {
    const value = sanitizedData[field.fieldName];

    if (field.type === PROFILE_FIELD_TYPES.CHECKBOX) {
      if (!value) {
        validationErrors[field.fieldName] = {
          userMessage: getRequiredFieldMessage(field.label),
        };
      }
      return;
    }

    if (!hasFieldValue(value)) {
      validationErrors[field.fieldName] = {
        userMessage: getRequiredFieldMessage(field.label),
      };
      return;
    }

    const formatError = validateFieldFormat(field, value);
    if (formatError) {
      validationErrors[field.fieldName] = {
        userMessage: formatError,
      };
    }
  });

  getVisibleSectionRepeatables(section, sanitizedData).forEach((repeatable) => {
    if (repeatable.naFieldName && sanitizedData[repeatable.naFieldName]) {
      return;
    }

    const rows = sanitizedData[repeatable.storageFieldName] || [];
    if (rows.length === 0) {
      validationErrors[repeatable.storageFieldName] = {
        userMessage: `${repeatable.itemLabel} is required.`,
      };
      return;
    }

    rows.forEach((row) => {
      repeatable.columns.forEach((column) => {
        const value = row[column.key];

        if (column.type === PROFILE_FIELD_TYPES.FILE) {
          if (!value) {
            validationErrors[column.key] = {
              userMessage: `Upload ${column.label}.`,
            };
          }
          return;
        }

        if (!hasFieldValue(value)) {
          validationErrors[column.key] = {
            userMessage: getRequiredFieldMessage(column.label),
          };
          return;
        }

        const formatError = validateFieldFormat(
          {
            ...column,
            fieldName: column.key,
          },
          value,
        );
        if (formatError) {
          validationErrors[column.key] = {
            userMessage: formatError,
          };
          return;
        }

        if (column.validate) {
          const customError = column.validate(value, row);
          if (customError) {
            validationErrors[column.key] = { userMessage: customError };
          }
        }
      });
    });
  });

  (section.fileFields || []).forEach((field) => {
    const dependencyFieldName = CONDITIONAL_FILE_FIELD_DEPENDENCIES[field.fieldName];
    const shouldRequireFile = dependencyFieldName
      ? hasFieldValue(sanitizedData[dependencyFieldName])
      : true;

    if (!shouldRequireFile) {
      return;
    }

    if (!sanitizedData[field.fieldName]) {
      validationErrors[field.fieldName] = {
        userMessage: `Upload ${field.label}.`,
      };
    }
  });

  return validationErrors;
}

export function getSectionPayload(section, sectionData) {
  const sanitizedData = getSanitizedSectionData(section, sectionData);

  return [
    ...(section.naFieldName ? [{
      fieldName: section.naFieldName,
      fieldValue: String(Boolean(sanitizedData[section.naFieldName])),
    }] : []),
    ...((section.repeatables || [])
      .filter((repeatable) => repeatable.naFieldName)
      .map((repeatable) => ({
        fieldName: repeatable.naFieldName,
        fieldValue: String(Boolean(sanitizedData[repeatable.naFieldName])),
      }))),
    ...(section.fields || []).map((field) => ({
      fieldName: field.fieldName,
      fieldValue: field.type === PROFILE_FIELD_TYPES.CHECKBOX
        ? String(Boolean(sanitizedData[field.fieldName]))
        : String(sanitizedData[field.fieldName] || '').trim(),
    })),
    ...(section.repeatables || []).map((repeatable) => ({
      fieldName: repeatable.storageFieldName,
      fieldValue: serializeRepeatableRows(sanitizedData[repeatable.storageFieldName] || [], repeatable),
    })),
    ...(section.fileFields || []).map((field) => ({
      fieldName: field.fieldName,
      fieldValue: serializeFileFieldValue(sanitizedData[field.fieldName]),
    })),
    ...(section.id === 'basicInformation' && isSingleMaritalStatus(sanitizedData.marital_status)
      ? SPOUSE_FIELD_NAMES.map((fieldName) => ({
        fieldName,
        fieldValue: '',
      }))
      : []),
  ];
}

export function getSectionById(sectionId) {
  return BIODATA_SECTION_MAP[sectionId] || null;
}

function isDefaultRepeatableRow(row, repeatable, rowIndex) {
  const defaultRow = repeatable.defaultRows?.[rowIndex];

  if (!defaultRow) {
    return false;
  }

  return repeatable.columns.every((column) => {
    if (column.type === PROFILE_FIELD_TYPES.FILE) {
      return !row[column.key] && !defaultRow[column.key];
    }

    return String(row[column.key] || '').trim() === String(defaultRow[column.key] || '').trim();
  });
}

function rowHasUserValue(row, repeatable, rowIndex = null) {
  if (rowIndex !== null && isDefaultRepeatableRow(row, repeatable, rowIndex)) {
    return false;
  }

  return repeatable.columns.some((column) => {
    if (column.displayOnly || isProtectedRepeatableColumn(row, repeatable, column.key)) {
      return false;
    }

    if (column.type === PROFILE_FIELD_TYPES.FILE) {
      return Boolean(row[column.key]);
    }

    return String(row[column.key] || '').trim().length > 0;
  });
}

function isFilled(value) {
  return String(value ?? '').trim().length > 0;
}

function findRepeatable(section, storageFieldName) {
  return (section.repeatables || []).find(repeatable => repeatable.storageFieldName === storageFieldName);
}

function hasCompleteCssServicePreferences(section, sectionData) {
  const servicePreferenceRepeatable = findRepeatable(section, CSS_SERVICE_PREFERENCES_FIELD_NAME);

  if (!servicePreferenceRepeatable) {
    return true;
  }

  return (sectionData[CSS_SERVICE_PREFERENCES_FIELD_NAME] || []).some(row => (
    isFilled(row.service_group) || isFilled(row.service_group_preference)
  ));
}

function hasCompleteCompulsoryCssSubjectMarks(section, sectionData) {
  const subjectMarksRepeatable = findRepeatable(section, CSS_SUBJECT_MARKS_FIELD_NAME);

  if (!subjectMarksRepeatable?.protectedRows?.length) {
    return true;
  }

  const subjectRows = sectionData[CSS_SUBJECT_MARKS_FIELD_NAME] || [];

  return subjectMarksRepeatable.protectedRows.every((protectedRow) => {
    const matchingRow = subjectRows.find(row => (
      normalizeProtectedRowValue(row?.[subjectMarksRepeatable.protectedRowKey])
      === normalizeProtectedRowValue(protectedRow[subjectMarksRepeatable.protectedRowKey])
    ));

    return Boolean(matchingRow) && isFilled(matchingRow.marks_obtained);
  });
}

function cssExamDetailsHasRequiredValues(section, sectionData) {
  const sanitizedData = getSanitizedSectionData(section, sectionData);
  const hasRequiredFlatFields = getVisibleSectionFields(section, sanitizedData).every(field => (
    field.type === PROFILE_FIELD_TYPES.CHECKBOX
      ? Boolean(sanitizedData[field.fieldName])
      : isFilled(sanitizedData[field.fieldName])
  ));

  return hasRequiredFlatFields
    && hasCompleteCssServicePreferences(section, sanitizedData)
    && hasCompleteCompulsoryCssSubjectMarks(section, sanitizedData);
}

function employmentHasRequiredValues(section, sectionData) {
  const sanitizedData = getSanitizedSectionData(section, sectionData);

  if (isFirstJob(sanitizedData[FIRST_JOB_FIELD_NAME])) {
    return isFilled(sanitizedData[FIRST_JOB_GAP_FIELD_NAME]);
  }

  if (hasPreviousEmployment(sanitizedData[FIRST_JOB_FIELD_NAME])) {
    const employmentRepeatable = findRepeatable(section, EMPLOYMENT_RECORDS_FIELD_NAME);

    return (sanitizedData[EMPLOYMENT_RECORDS_FIELD_NAME] || [])
      .some((row, rowIndex) => rowHasUserValue(row, employmentRepeatable, rowIndex));
  }

  return false;
}

export function sectionHasValue(section, sectionData) {
  if (section.naFieldName && Boolean(sectionData[section.naFieldName])) {
    return true;
  }

  const hasRepeatableNaState = (section.repeatables || []).some((repeatable) => (
    repeatable.naFieldName && Boolean(sectionData[repeatable.naFieldName])
  ));

  if (hasRepeatableNaState) {
    return true;
  }

  const hasCompletedField = (section.fields || []).some((field) => {
    if (field.type === PROFILE_FIELD_TYPES.CHECKBOX) {
      return Boolean(sectionData[field.fieldName]);
    }
    return String(sectionData[field.fieldName] || '').trim().length > 0;
  });

  if (hasCompletedField) {
    return true;
  }

  const hasRepeatableValue = (section.repeatables || []).some((repeatable) => (
    (sectionData[repeatable.storageFieldName] || []).some((row, rowIndex) => (
      rowHasUserValue(row, repeatable, rowIndex)
    ))
  ));

  if (hasRepeatableValue) {
    return true;
  }

  return (section.fileFields || []).some((field) => Boolean(sectionData[field.fieldName]));
}

export function sectionIsComplete(section, sectionData) {
  let locallyComplete = sectionHasValue(section, sectionData);

  if (section.id === CSS_EXAM_DETAILS_SECTION_ID) {
    locallyComplete = cssExamDetailsHasRequiredValues(section, sectionData);
  }

  if (section.id === 'employment') {
    locallyComplete = employmentHasRequiredValues(section, sectionData);
  }

  const submittedFieldName = getSectionSubmittedFieldName(section.id);

  if (Object.prototype.hasOwnProperty.call(sectionData || {}, submittedFieldName)) {
    return locallyComplete && Boolean(sectionData[submittedFieldName]);
  }

  return locallyComplete;
}

export function getSectionSummary(section, sectionData) {
  if (section.naFieldName && Boolean(sectionData[section.naFieldName])) {
    return 'N/A';
  }

  const firstFilledField = (section.fields || []).find((field) => {
    if (field.type === PROFILE_FIELD_TYPES.CHECKBOX) {
      return Boolean(sectionData[field.fieldName]);
    }
    return String(sectionData[field.fieldName] || '').trim().length > 0;
  });

  if (firstFilledField) {
    if (firstFilledField.type === PROFILE_FIELD_TYPES.CHECKBOX) {
      return firstFilledField.label;
    }

    return String(sectionData[firstFilledField.fieldName]).trim();
  }

  for (let index = 0; index < (section.repeatables || []).length; index += 1) {
    const repeatable = section.repeatables[index];
    const filledRows = (sectionData[repeatable.storageFieldName] || [])
      .filter((row, rowIndex) => rowHasUserValue(row, repeatable, rowIndex));

    if (filledRows.length > 0) {
      const previewColumn = repeatable.columns.find((column) => (
        String(filledRows[0][column.key] || '').trim().length > 0
      ));
      const previewValue = previewColumn ? String(filledRows[0][previewColumn.key]).trim() : repeatable.itemLabel;

      if (filledRows.length > 1) {
        return `${previewValue} +${filledRows.length - 1} more`;
      }
      return previewValue;
    }
  }

  const uploadedFile = (section.fileFields || []).find((field) => Boolean(sectionData[field.fieldName]));
  if (uploadedFile) {
    return sectionData[uploadedFile.fieldName].name || uploadedFile.label;
  }

  const hasRepeatableNaState = (section.repeatables || []).some((repeatable) => (
    repeatable.naFieldName && Boolean(sectionData[repeatable.naFieldName])
  ));
  if (hasRepeatableNaState) {
    return 'N/A';
  }

  return 'No information added';
}

export function getSectionError(section, errors) {
  const fieldError = (section.fields || []).find((field) => errors[field.fieldName]);
  if (fieldError) {
    return errors[fieldError.fieldName];
  }

  const repeatableError = (section.repeatables || []).find((repeatable) => errors[repeatable.storageFieldName]);
  if (repeatableError) {
    return errors[repeatableError.storageFieldName];
  }

  const fileError = (section.fileFields || []).find((field) => errors[field.fieldName]);
  if (fileError) {
    return errors[fileError.fieldName];
  }

  return errors.extendedProfile || errors[section.id] || null;
}

export function getSectionErrorFields(section, errors = {}, sectionData = null) {
  const sanitizedData = sectionData ? getSanitizedSectionData(section, sectionData) : null;
  const visibleFields = sanitizedData ? getVisibleSectionFields(section, sanitizedData) : (section.fields || []);
  const visibleRepeatables = sanitizedData
    ? getVisibleSectionRepeatables(section, sanitizedData)
    : (section.repeatables || []);

  return [
    ...(visibleFields.map(({ fieldName, label }) => ({
      fieldName,
      label,
    }))),
    ...(visibleRepeatables.flatMap((repeatable) => [
      {
        fieldName: repeatable.storageFieldName,
        label: repeatable.itemLabel,
      },
      ...repeatable.columns.map(({ key, label }) => ({
        fieldName: key,
        label,
      })),
    ])),
    ...((section.fileFields || []).map(({ fieldName, label }) => ({
      fieldName,
      label,
    }))),
  ].filter(({ fieldName }) => (
    Boolean(errors[fieldName])
    || Object.keys(errors).some(errorFieldName => errorFieldName.endsWith(`.${fieldName}`))
  ));
}

export function getSectionErrorSummary(section, errors = {}, sectionData = null) {
  const errorFields = getSectionErrorFields(section, errors, sectionData);

  if (errorFields.length === 0 && getSectionError(section, errors)) {
    return 'Please review this section before continuing.';
  }

  if (errorFields.length === 0) {
    return '';
  }

  if (errorFields.length === 1) {
    return `Please fix ${errorFields[0].label}.`;
  }

  return `Please fix ${errorFields.length} fields in this section.`;
}

export function isBiodataForm(formId) {
  return Boolean(getSectionById(formId));
}

export function createEmptyRepeatableRow(repeatableConfig) {
  return buildRepeatableRow(repeatableConfig.emptyRow, repeatableConfig);
}
