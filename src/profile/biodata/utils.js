import { BIODATA_SECTION_MAP, PROFILE_FIELD_TYPES } from './config';

let repeatableRowCounter = 0;
const BASIC_INFORMATION_CHILD_FIELD_NAMES = ['number_of_children', 'sons', 'daughters'];
const SPOUSE_FIELD_NAMES = [
  'spouse_name',
  'spouse_education',
  'spouse_occupation',
  'spouse_address_phone_number',
];

function buildRepeatableRow(row, repeatableConfig) {
  const normalizedRow = repeatableConfig.columns.reduce((accumulator, column) => {
    accumulator[column.key] = String((row && row[column.key]) || '');
    return accumulator;
  }, {});

  repeatableRowCounter += 1;

  return {
    ...normalizedRow,
    rowId: `row-${repeatableRowCounter}`,
  };
}

export function getExtendedProfileValue(extendedProfile, fieldName) {
  const field = (extendedProfile || []).find((item) => item.fieldName === fieldName);
  return field ? field.fieldValue : '';
}

export function isSingleMaritalStatus(value) {
  return String(value || '').trim() === 'Single';
}

export function normalizeFieldValue(field, storedValue) {
  if (field.type === PROFILE_FIELD_TYPES.CHECKBOX) {
    return String(storedValue).toLowerCase() === 'true';
  }

  return String(storedValue || '');
}

export function parseRepeatableRows(storedValue, repeatableConfig) {
  if (!storedValue) {
    return [buildRepeatableRow(repeatableConfig.emptyRow, repeatableConfig)];
  }

  try {
    const parsed = JSON.parse(storedValue);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((row) => buildRepeatableRow(row, repeatableConfig));
    }
  } catch (error) {
    return [buildRepeatableRow(repeatableConfig.emptyRow, repeatableConfig)];
  }

  return [buildRepeatableRow(repeatableConfig.emptyRow, repeatableConfig)];
}

export function serializeRepeatableRows(rows, repeatableConfig) {
  return JSON.stringify(
    (rows || [])
      .map((row) => repeatableConfig.columns.reduce((accumulator, column) => {
        accumulator[column.key] = String((row && row[column.key]) || '').trim();
        return accumulator;
      }, {}))
      .filter((row) => Object.values(row).some((value) => value.length > 0)),
  );
}

export function parseFileFieldValue(storedValue) {
  if (!storedValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(storedValue);
    if (parsed && parsed.name && parsed.dataUrl) {
      return {
        name: String(parsed.name),
        dataUrl: String(parsed.dataUrl),
      };
    }
  } catch (error) {
    return null;
  }

  return null;
}

export function serializeFileFieldValue(fileValue) {
  if (!fileValue || !fileValue.name || !fileValue.dataUrl) {
    return '';
  }

  return JSON.stringify(fileValue);
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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

  const toggleValues = [
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
  const sanitizedData = { ...sectionData };

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
    }
  });

  if (section.id === 'basicInformation' && isSingleMaritalStatus(sanitizedData.marital_status)) {
    BASIC_INFORMATION_CHILD_FIELD_NAMES.forEach((fieldName) => {
      sanitizedData[fieldName] = '';
    });
  }

  return sanitizedData;
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

function rowHasUserValue(row, repeatable) {
  return repeatable.columns.some((column) => String(row[column.key] || '').trim().length > 0);
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

  const hasFieldValue = (section.fields || []).some((field) => {
    if (field.type === PROFILE_FIELD_TYPES.CHECKBOX) {
      return Boolean(sectionData[field.fieldName]);
    }
    return String(sectionData[field.fieldName] || '').trim().length > 0;
  });

  if (hasFieldValue) {
    return true;
  }

  const hasRepeatableValue = (section.repeatables || []).some((repeatable) => (
    (sectionData[repeatable.storageFieldName] || []).some((row) => (
      rowHasUserValue(row, repeatable)
    ))
  ));

  if (hasRepeatableValue) {
    return true;
  }

  return (section.fileFields || []).some((field) => Boolean(sectionData[field.fieldName]));
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
      .filter((row) => rowHasUserValue(row, repeatable));

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

export function isBiodataForm(formId) {
  return Boolean(getSectionById(formId));
}

export function createEmptyRepeatableRow(repeatableConfig) {
  return buildRepeatableRow(repeatableConfig.emptyRow, repeatableConfig);
}
