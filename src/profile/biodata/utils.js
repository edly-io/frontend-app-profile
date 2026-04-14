import { BIODATA_SECTION_MAP, PROFILE_FIELD_TYPES } from './config';

let repeatableRowCounter = 0;

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

  return {
    ...fieldValues,
    ...repeatableValues,
    ...fileValues,
  };
}

export function getSectionPayload(section, sectionData) {
  return [
    ...(section.fields || []).map((field) => ({
      fieldName: field.fieldName,
      fieldValue: field.type === PROFILE_FIELD_TYPES.CHECKBOX
        ? String(Boolean(sectionData[field.fieldName]))
        : String(sectionData[field.fieldName] || '').trim(),
    })),
    ...(section.repeatables || []).map((repeatable) => ({
      fieldName: repeatable.storageFieldName,
      fieldValue: serializeRepeatableRows(sectionData[repeatable.storageFieldName] || [], repeatable),
    })),
    ...(section.fileFields || []).map((field) => ({
      fieldName: field.fieldName,
      fieldValue: serializeFileFieldValue(sectionData[field.fieldName]),
    })),
  ];
}

export function getSectionById(sectionId) {
  return BIODATA_SECTION_MAP[sectionId] || null;
}

function rowHasUserValue(row, repeatable) {
  return repeatable.columns.some((column) => String(row[column.key] || '').trim().length > 0);
}

export function sectionHasValue(section, sectionData) {
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
