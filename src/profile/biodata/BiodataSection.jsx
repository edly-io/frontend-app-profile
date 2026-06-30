import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Button, Form, StatefulButton,
} from '@openedx/paragon';

import SwitchContent from '../forms/elements/SwitchContent';

import { PROFILE_FIELD_TYPES } from './config';
import { BiodataFileActions, BiodataFilePreview } from './BiodataFilePreview';
import RepeatableFieldGroup from './RepeatableFieldGroup';
import {
  createFileUploadValue,
  createEmptyRepeatableRow,
  FIELD_NAMES_REQUIRING_NON_NEGATIVE_NUMBERS,
  FIELD_NAMES_REQUIRING_VALID_YEAR,
  fieldAllowsOnlyDigits,
  fieldDisallowsDigits,
  fieldDisallowsSpecialCharacters,
  getRepeatableFieldErrorKey,
  getRepeatableFieldValidationError,
  getSectionError,
  getSectionErrorFields,
  getSectionErrorSummary,
  getSectionInitialData,
  getSanitizedSectionData,
  getCssExamMarksSummary,
  getVisibleSectionFields,
  getVisibleSectionRepeatables,
  isProtectedRepeatableColumn,
  isProtectedRepeatableRow,
  normalizeRepeatableRows,
  removeDigitsFromValue,
  removeNonDigitsFromValue,
  removeSpecialCharactersFromValue,
  revokeFilePreviewUrl,
  sectionHasValue,
  shouldShowSpouseInformation,
  validateSectionDraft,
} from './utils';

const TODAY_DATE = new Date().toISOString().slice(0, 10);
const DATE_FIELDS_WITH_MAX_TODAY = new Set([
  'last_annual_medical_checkup',
  'attended_from',
  'attended_to',
]);

function getRepeatableNaBackupFieldName(storageFieldName) {
  return `__${storageFieldName}_backup_rows`;
}

function rowHasMeaningfulValues(row, repeatable) {
  return (repeatable.columns || []).some(({ key, type }) => {
    const value = row?.[key];

    if (type === PROFILE_FIELD_TYPES.FILE) {
      return Boolean(value);
    }

    return String(value || '').trim().length > 0;
  });
}

function getFieldInputAttributes(field) {
  if (field.type === PROFILE_FIELD_TYPES.DATE && DATE_FIELDS_WITH_MAX_TODAY.has(field.fieldName)) {
    return { max: TODAY_DATE };
  }

  if (FIELD_NAMES_REQUIRING_VALID_YEAR.has(field.fieldName)) {
    return {
      inputMode: 'numeric',
      pattern: '\\d{4}',
      maxLength: 4,
    };
  }

  if (
    field.type === PROFILE_FIELD_TYPES.NUMBER
    && FIELD_NAMES_REQUIRING_NON_NEGATIVE_NUMBERS.has(field.fieldName)
  ) {
    return {
      min: 0,
      inputMode: 'numeric',
    };
  }

  if (
    (field.type === PROFILE_FIELD_TYPES.TEXT || field.type === PROFILE_FIELD_TYPES.TEXTAREA || !field.type)
    && fieldAllowsOnlyDigits(field.fieldName)
  ) {
    return { inputMode: 'tel' };
  }

  if (
    (field.type === PROFILE_FIELD_TYPES.TEXT || field.type === PROFILE_FIELD_TYPES.TEXTAREA || !field.type)
    && fieldDisallowsDigits(field.fieldName)
  ) {
    return { inputMode: 'text' };
  }

  return {};
}

function normalizeFieldInputValue(field, value) {
  let nextValue = value;

  if (
    field.type === PROFILE_FIELD_TYPES.NUMBER
    && FIELD_NAMES_REQUIRING_NON_NEGATIVE_NUMBERS.has(field.fieldName)
  ) {
    nextValue = removeNonDigitsFromValue(nextValue);
  }

  if (
    (field.type === PROFILE_FIELD_TYPES.TEXT || field.type === PROFILE_FIELD_TYPES.TEXTAREA || !field.type)
    && fieldAllowsOnlyDigits(field.fieldName)
  ) {
    nextValue = removeNonDigitsFromValue(nextValue);
  }

  if (
    (field.type === PROFILE_FIELD_TYPES.TEXT || field.type === PROFILE_FIELD_TYPES.TEXTAREA || !field.type)
    && fieldDisallowsDigits(field.fieldName)
  ) {
    nextValue = removeDigitsFromValue(nextValue);
  }

  if (
    (field.type === PROFILE_FIELD_TYPES.TEXT || field.type === PROFILE_FIELD_TYPES.TEXTAREA || !field.type)
    && fieldDisallowsSpecialCharacters(field.fieldName)
  ) {
    nextValue = removeSpecialCharactersFromValue(nextValue);
  }

  return nextValue;
}

function renderFieldControl(
  field,
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
  onNativeValidationChange = () => {},
) {
  const syncNativeValidationState = (event) => {
    const { currentTarget } = event;
    onNativeValidationChange(currentTarget.validity.valid ? '' : currentTarget.validationMessage);
  };

  if (field.type === PROFILE_FIELD_TYPES.CHECKBOX) {
    return (
      <Form.Checkbox
        checked={Boolean(value)}
        onChange={(event) => onChange(event.target.checked)}
        isInvalid={Boolean(error)}
        disabled={disabled}
      >
        {field.label}
      </Form.Checkbox>
    );
  }

  if (field.type === PROFILE_FIELD_TYPES.SELECT) {
    return (
      <Form.Control
        as="select"
        value={value}
        isInvalid={Boolean(error)}
        disabled={disabled}
        {...getFieldInputAttributes(field)}
        onBlur={onBlur}
        onFocus={syncNativeValidationState}
        onInvalid={(event) => onNativeValidationChange(event.currentTarget.validationMessage)}
        onChange={(event) => {
          syncNativeValidationState(event);
          onChange(normalizeFieldInputValue(field, event.target.value));
        }}
      >
        {(field.options || []).map((option) => (
          <option key={`${field.fieldName}-${option.value || 'blank'}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </Form.Control>
    );
  }

  if (field.type === PROFILE_FIELD_TYPES.TEXTAREA) {
    return (
      <Form.Control
        as="textarea"
        rows={field.rows || 3}
        value={value}
        placeholder={field.placeholder}
        isInvalid={Boolean(error)}
        disabled={disabled}
        {...getFieldInputAttributes(field)}
        onBlur={onBlur}
        onFocus={syncNativeValidationState}
        onInvalid={(event) => onNativeValidationChange(event.currentTarget.validationMessage)}
        onChange={(event) => {
          syncNativeValidationState(event);
          onChange(normalizeFieldInputValue(field, event.target.value));
        }}
      />
    );
  }

  return (
    <Form.Control
      type={field.type || PROFILE_FIELD_TYPES.TEXT}
      value={value}
      placeholder={field.placeholder}
      isInvalid={Boolean(error)}
      disabled={disabled}
      {...getFieldInputAttributes(field)}
      onBlur={onBlur}
      onFocus={syncNativeValidationState}
      onInvalid={(event) => onNativeValidationChange(event.currentTarget.validationMessage)}
      onChange={(event) => {
        syncNativeValidationState(event);
        onChange(normalizeFieldInputValue(field, event.target.value));
      }}
    />
  );
}

function renderReadonlyFile(field, fileValue) {
  if (!fileValue) {
    return (
      <div className="border rounded p-3 mb-3 bg-light-200">
        <p className="h6 font-weight-bold mb-2">{field.label}</p>
        <p className="small text-muted mb-0">No file uploaded</p>
      </div>
    );
  }

  return (
    <div className="border rounded p-3 mb-3 bg-light-200">
      <p className="h6 font-weight-bold mb-2">{field.label}</p>
      <BiodataFileActions
        field={field}
        fileValue={fileValue}
        disabled
        onReplace={() => {}}
        onRemove={() => {}}
      />
      <BiodataFilePreview field={field} fileValue={fileValue} />
    </div>
  );
}

function revokeSectionFilePreviews(section, data) {
  (section.fileFields || []).forEach((field) => {
    revokeFilePreviewUrl(data?.[field.fieldName]);
  });

  (section.repeatables || []).forEach((repeatable) => {
    (data?.[repeatable.storageFieldName] || []).forEach((row) => {
      (repeatable.columns || []).forEach((column) => {
        if (column.type === PROFILE_FIELD_TYPES.FILE) {
          revokeFilePreviewUrl(row?.[column.key]);
        }
      });
    });
  });
}

function revokeRepeatableRowFilePreviews(row, repeatable) {
  (repeatable.columns || []).forEach((column) => {
    if (column.type === PROFILE_FIELD_TYPES.FILE) {
      revokeFilePreviewUrl(row?.[column.key]);
    }
  });
}

const BiodataSection = ({
  section,
  extendedProfile,
  draftValue,
  errors,
  saveState,
  isAuthenticatedUserProfile,
  isEditing,
  onClose,
  onSubmit,
  onDraftChange,
  spacingClassName,
  showInlineTitle,
  forceEditingWhenEmpty,
  showCancelButton,
  showSubmitButton,
  submitLabels,
  isLocked,
}) => {
  const committedData = useMemo(
    () => getSectionInitialData(section, extendedProfile),
    [section, extendedProfile],
  );
  const formData = useMemo(
    () => getSanitizedSectionData(section, draftValue || committedData),
    [section, draftValue, committedData],
  );
  const formDataRef = useRef(formData);
  const sectionRef = useRef(section);
  const [localErrors, setLocalErrors] = useState({});
  const [nativeValidationErrors, setNativeValidationErrors] = useState({});
  const mergedErrors = useMemo(() => ({ ...errors, ...localErrors }), [errors, localErrors]);
  const hasContent = sectionHasValue(section, committedData);
  const sectionError = getSectionError(section, mergedErrors);
  const sectionErrorSummary = getSectionErrorSummary(section, mergedErrors, formData);
  const sectionErrorFields = getSectionErrorFields(section, mergedErrors, formData);

  useEffect(() => {
    formDataRef.current = formData;
    sectionRef.current = section;
  }, [formData, section]);

  useEffect(() => () => {
    revokeSectionFilePreviews(sectionRef.current, formDataRef.current);
  }, []);

  useEffect(() => {
    setLocalErrors({});
  }, [section.id]);

  if (!isAuthenticatedUserProfile && !hasContent) {
    return null;
  }

  let editMode = 'editing';
  if (!isAuthenticatedUserProfile) {
    editMode = 'static';
  } else if (isLocked) {
    editMode = 'readonly';
  } else if (isEditing) {
    editMode = 'editing';
  } else if (hasContent) {
    editMode = 'readonly';
  } else if (forceEditingWhenEmpty) {
    editMode = 'editing';
  }

  const handleFieldChange = (fieldName, value) => {
    const nextFormData = {
      ...formData,
      [fieldName]: value,
    };

    if (section.id === 'basicInformation' && fieldName === 'marital_status' && !shouldShowSpouseInformation(value)) {
      nextFormData.number_of_children = '0';
      nextFormData.sons = '0';
      nextFormData.daughters = '0';
    }

    onDraftChange(section.id, getSanitizedSectionData(section, nextFormData));
  };

  const handleFieldBlur = (fieldName) => {
    const validationErrors = validateSectionDraft(section, formData);
    const nextFieldError = validationErrors[fieldName];

    setLocalErrors((previousErrors) => {
      const nextErrors = { ...previousErrors };

      if (nextFieldError) {
        nextErrors[fieldName] = nextFieldError;
      } else {
        delete nextErrors[fieldName];
      }

      return nextErrors;
    });
  };

  const handleNativeValidationChange = (fieldName, validationMessage) => {
    setNativeValidationErrors((previousErrors) => {
      if (!validationMessage) {
        if (!previousErrors[fieldName]) {
          return previousErrors;
        }

        const nextErrors = { ...previousErrors };
        delete nextErrors[fieldName];
        return nextErrors;
      }

      if (previousErrors[fieldName] === validationMessage) {
        return previousErrors;
      }

      return {
        ...previousErrors,
        [fieldName]: validationMessage,
      };
    });
  };

  const handleRepeatableChange = (repeatable, action, payload = {}) => {
    const currentRows = formData[repeatable.storageFieldName] || [createEmptyRepeatableRow(repeatable)];
    let nextRows = currentRows;

    if (action === 'addRow') {
      const nextRow = createEmptyRepeatableRow(repeatable);
      nextRows = [...currentRows, nextRow];
    } else if (action === 'removeRow') {
      if (isProtectedRepeatableRow(currentRows[payload.rowIndex], repeatable)) {
        return;
      }
      revokeRepeatableRowFilePreviews(currentRows[payload.rowIndex], repeatable);
      nextRows = currentRows.filter((_, index) => index !== payload.rowIndex);
      if (nextRows.length === 0) {
        nextRows = [createEmptyRepeatableRow(repeatable)];
      }
    } else if (action === 'updateCell') {
      if (
        payload.columnKey === repeatable.autoPriorityKey
        || isProtectedRepeatableColumn(currentRows[payload.rowIndex], repeatable, payload.columnKey)
      ) {
        return;
      }
      const currentRow = currentRows[payload.rowIndex];
      const currentFieldErrorKey = getRepeatableFieldErrorKey(repeatable, currentRow, payload.columnKey);
      nextRows = currentRows.map((row, index) => (
        index === payload.rowIndex ? { ...row, [payload.columnKey]: payload.value } : row
      ));
      setLocalErrors((previousErrors) => {
        if (!previousErrors[currentFieldErrorKey]) {
          return previousErrors;
        }

        const nextErrors = { ...previousErrors };
        delete nextErrors[currentFieldErrorKey];
        return nextErrors;
      });
    }

    nextRows = normalizeRepeatableRows(nextRows, repeatable);

    onDraftChange(section.id, {
      ...formData,
      [repeatable.storageFieldName]: nextRows,
    });
  };

  const handleRepeatableFieldBlur = (repeatable, rowIndex, columnKey) => {
    const row = (formData[repeatable.storageFieldName] || [])[rowIndex];
    const column = repeatable.columns.find(item => item.key === columnKey);

    if (!row || !column) {
      return;
    }

    const fieldErrorKey = getRepeatableFieldErrorKey(repeatable, row, columnKey);
    const fieldValidationError = getRepeatableFieldValidationError(repeatable, row, column);

    setLocalErrors((previousErrors) => {
      const nextErrors = { ...previousErrors };

      if (fieldValidationError) {
        nextErrors[fieldErrorKey] = {
          userMessage: fieldValidationError.userMessage,
        };
      } else {
        delete nextErrors[fieldErrorKey];
      }

      return nextErrors;
    });
  };

  const handleFileChange = async (fieldName, file) => {
    if (!file) {
      return;
    }

    revokeFilePreviewUrl(formData[fieldName]);

    onDraftChange(section.id, {
      ...formData,
      [fieldName]: {
        ...createFileUploadValue(file),
      },
    });
  };

  const handleFileRemove = (fieldName) => {
    revokeFilePreviewUrl(formData[fieldName]);
    handleFieldChange(fieldName, null);
  };

  const handleSectionNaChange = (value) => {
    onDraftChange(section.id, getSanitizedSectionData(section, {
      ...formData,
      [section.naFieldName]: value,
    }));
  };

  const handleRepeatableNaChange = (repeatable, value) => {
    const backupFieldName = getRepeatableNaBackupFieldName(repeatable.storageFieldName);
    const currentRows = formData[repeatable.storageFieldName] || [];
    const meaningfulCurrentRows = currentRows.filter(row => rowHasMeaningfulValues(row, repeatable));
    const savedBackupRows = Array.isArray(formData[backupFieldName]) ? formData[backupFieldName] : [];
    const nextRows = value || savedBackupRows.length === 0
      ? currentRows
      : savedBackupRows;
    const nextBackupRows = value && meaningfulCurrentRows.length > 0
      ? meaningfulCurrentRows
      : savedBackupRows;

    onDraftChange(section.id, getSanitizedSectionData(section, {
      ...formData,
      [repeatable.naFieldName]: value,
      [repeatable.storageFieldName]: nextRows,
      [backupFieldName]: nextBackupRows,
    }));
  };

  const isSectionDisabled = Boolean(section.naFieldName && formData[section.naFieldName]);
  const visibleFields = getVisibleSectionFields(section, formData);
  const visibleRepeatables = getVisibleSectionRepeatables(section, formData);
  const cssExamMarksSummary = section.id === 'cssExamDetails'
    ? getCssExamMarksSummary(section, formData)
    : null;
  const renderFormFields = (disabled = false) => (
    <>
      {section.naFieldName && (
        <Form.Group className="mb-3">
          <Form.Checkbox
            checked={Boolean(formData[section.naFieldName])}
            onChange={(event) => handleSectionNaChange(event.target.checked)}
            disabled={disabled}
          >
            {section.naLabel || 'N/A'}
          </Form.Checkbox>
        </Form.Group>
      )}
      <div className="row">
        {visibleFields.map((field) => {
          const error = mergedErrors[field.fieldName];
          return (
            <Form.Group
              key={field.fieldName}
              className={field.type === PROFILE_FIELD_TYPES.TEXTAREA || field.type === PROFILE_FIELD_TYPES.CHECKBOX ? 'col-12 mb-3' : 'col-md-6 mb-3'}
            >
              {field.type !== PROFILE_FIELD_TYPES.CHECKBOX && (
                <Form.Label>{field.label}</Form.Label>
              )}
              {renderFieldControl(
                field,
                formData[field.fieldName],
                (value) => handleFieldChange(field.fieldName, value),
                () => handleFieldBlur(field.fieldName),
                error,
                disabled || isSectionDisabled,
                (validationMessage) => handleNativeValidationChange(field.fieldName, validationMessage),
              )}
              {!disabled && error && error.userMessage && !nativeValidationErrors[field.fieldName] && (
                <Form.Control.Feedback hasIcon={false} className="d-block text-danger small mt-1">
                  {error.userMessage}
                </Form.Control.Feedback>
              )}
            </Form.Group>
          );
        })}
      </div>
      {cssExamMarksSummary && (
        <div className="row">
          <Form.Group className="col-md-6 mb-3">
            <Form.Label>Total Marks</Form.Label>
            <Form.Control type="number" value={cssExamMarksSummary.totalMarks} disabled readOnly />
            <Form.Text className="text-muted">
              Required collective total: {cssExamMarksSummary.requiredTotalMarks} (100 per subject, 300 for viva)
            </Form.Text>
          </Form.Group>
          <Form.Group className="col-md-6 mb-3">
            <Form.Label>Total Obtained Marks</Form.Label>
            <Form.Control type="number" value={cssExamMarksSummary.obtainedMarks} disabled readOnly />
          </Form.Group>
        </div>
      )}
      {visibleRepeatables.map((repeatable) => (
        <div key={repeatable.storageFieldName} className="mb-3">
          {repeatable.naFieldName && (
            <Form.Group className="mb-2">
              <Form.Checkbox
                checked={Boolean(formData[repeatable.naFieldName])}
                onChange={(event) => handleRepeatableNaChange(repeatable, event.target.checked)}
                disabled={disabled}
              >
                {repeatable.naLabel || 'N/A'}
              </Form.Checkbox>
            </Form.Group>
          )}
          <p className="h6 font-weight-bold mb-2">{repeatable.itemLabel}s</p>
          {!(repeatable.naFieldName && formData[repeatable.naFieldName]) && (
            <RepeatableFieldGroup
              repeatable={repeatable}
              rows={formData[repeatable.storageFieldName] || [createEmptyRepeatableRow(repeatable)]}
              errors={mergedErrors}
              onChange={(action, payload) => handleRepeatableChange(repeatable, action, payload)}
              onBlur={(rowIndex, columnKey) => handleRepeatableFieldBlur(repeatable, rowIndex, columnKey)}
              disabled={disabled || isSectionDisabled}
            />
          )}
        </div>
      ))}
      {(section.fileFields || []).map((field) => {
        const fileValue = formData[field.fieldName];
        const error = mergedErrors[field.fieldName];
        if (disabled || isSectionDisabled) {
          return <div key={field.fieldName}>{renderReadonlyFile(field, fileValue)}</div>;
        }

        return (
          <div
            key={field.fieldName}
            className={`border rounded p-3 mb-3 bg-light-200${error ? ' border-danger' : ''}`}
          >
            <p className="h6 font-weight-bold mb-2">{field.label}</p>
            <BiodataFileActions
              field={field}
              fileValue={fileValue}
              disabled={disabled || isSectionDisabled}
              onReplace={() => {
                const input = document.getElementById(`${section.id}-${field.fieldName}`);
                if (input) {
                  input.click();
                }
              }}
              onRemove={() => handleFileRemove(field.fieldName)}
            />
            <input
              id={`${section.id}-${field.fieldName}`}
              type="file"
              accept={field.accept}
              className="d-none"
              disabled={disabled || isSectionDisabled}
              onChange={(event) => {
                const input = event.currentTarget;
                handleFileChange(field.fieldName, event.target.files && event.target.files[0]);
                input.value = '';
              }}
            />
            {error && error.userMessage && (
              <Form.Control.Feedback hasIcon={false} className="d-block text-danger small mt-2">
                {error.userMessage}
              </Form.Control.Feedback>
            )}
            {fileValue && (
              <BiodataFilePreview field={field} fileValue={fileValue} />
            )}
          </div>
        );
      })}
    </>
  );

  return (
    <SwitchContent
      className={spacingClassName}
      expression={editMode}
      cases={{
        editing: (
          <div role="dialog" aria-labelledby={`${section.id}-label`}>
            <form onSubmit={(event) => {
              event.preventDefault();
              onSubmit(section.id);
            }}
            >
              {showInlineTitle && (
                <div className="row m-0 pb-1.5 align-items-center">
                  <p id={`${section.id}-label`} className="h5 font-weight-bold m-0">
                    {section.title}
                  </p>
                </div>
              )}
              {showInlineTitle && section.helperText && (
                <p className="text-muted small mb-3">{section.helperText}</p>
              )}
              {sectionError && sectionError.userMessage && (
                <Alert variant="danger" dismissible={false} show className="mb-3 border-danger">
                  <p className="font-weight-bold mb-1">
                    {sectionErrorSummary || 'Please review this section.'}
                  </p>
                  {sectionErrorFields.length > 0 && (
                    <p className="small mb-0">
                      Highlighted field{sectionErrorFields.length === 1 ? '' : 's'}: {sectionErrorFields.map(({ label }) => label).join(', ')}
                    </p>
                  )}
                  {sectionErrorFields.length === 0 && (
                    <p className="small mb-0">{sectionError.userMessage}</p>
                  )}
                </Alert>
              )}
              {renderFormFields()}
              <div className="d-flex flex-row-reverse flex-wrap justify-content-end align-items-center">
                <div className="row form-group flex-shrink-0 flex-grow-1 m-0 p-0">
                  {showCancelButton && (
                    <div className="pr-2 pl-0 m-0">
                      <Button variant="outline-primary" type="button" onClick={() => onClose(section.id)}>
                        Cancel
                      </Button>
                    </div>
                  )}
                  {showSubmitButton && (
                    <div className="p-0 m-0">
                      <StatefulButton
                        type="submit"
                        state={saveState === 'error' ? null : saveState}
                        labels={{
                          default: 'Save',
                          pending: 'Saving',
                          complete: 'Saved',
                          ...submitLabels,
                        }}
                        disabledStates={[]}
                      />
                    </div>
                  )}
                </div>
              </div>
            </form>
          </div>
        ),
        readonly: (
          <div className="pt-2">
            {renderFormFields(true)}
          </div>
        ),
        static: (
          <div className="pt-2">
            {renderFormFields(true)}
          </div>
        ),
      }}
    />
  );
};

BiodataSection.propTypes = {
  section: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    helperText: PropTypes.string,
    naFieldName: PropTypes.string,
    naLabel: PropTypes.string,
    fields: PropTypes.arrayOf(PropTypes.shape({
      fieldName: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      type: PropTypes.string,
      placeholder: PropTypes.string,
      rows: PropTypes.number,
    })),
    repeatables: PropTypes.arrayOf(PropTypes.shape({
      storageFieldName: PropTypes.string.isRequired,
      itemLabel: PropTypes.string.isRequired,
      addButtonLabel: PropTypes.string.isRequired,
      autoPriorityKey: PropTypes.string,
      naFieldName: PropTypes.string,
      naLabel: PropTypes.string,
      protectedRowKey: PropTypes.string,
      protectedRows: PropTypes.arrayOf(PropTypes.objectOf(PropTypes.string)),
      protectedColumns: PropTypes.arrayOf(PropTypes.string),
      emptyRow: PropTypes.objectOf(PropTypes.string).isRequired,
      columns: PropTypes.arrayOf(PropTypes.shape({
        key: PropTypes.string.isRequired,
        label: PropTypes.string.isRequired,
        type: PropTypes.string,
        placeholder: PropTypes.string,
        displayOnly: PropTypes.bool,
      })).isRequired,
    })),
    fileFields: PropTypes.arrayOf(PropTypes.shape({
      fieldName: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      accept: PropTypes.string,
    })),
  }).isRequired,
  extendedProfile: PropTypes.arrayOf(PropTypes.shape({
    fieldName: PropTypes.string,
    fieldValue: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
      PropTypes.bool,
    ]),
  })),
  draftValue: PropTypes.shape({}),
  errors: PropTypes.objectOf(PropTypes.oneOfType([
    PropTypes.shape({
      userMessage: PropTypes.string,
    }),
    PropTypes.string,
  ])),
  saveState: PropTypes.string,
  isAuthenticatedUserProfile: PropTypes.bool.isRequired,
  isEditing: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onDraftChange: PropTypes.func.isRequired,
  spacingClassName: PropTypes.string,
  showInlineTitle: PropTypes.bool,
  forceEditingWhenEmpty: PropTypes.bool,
  showCancelButton: PropTypes.bool,
  showSubmitButton: PropTypes.bool,
  isLocked: PropTypes.bool,
  submitLabels: PropTypes.shape({
    default: PropTypes.string,
    pending: PropTypes.string,
    complete: PropTypes.string,
  }),
};

BiodataSection.defaultProps = {
  extendedProfile: [],
  draftValue: null,
  errors: {},
  saveState: null,
  spacingClassName: 'pt-40px',
  showInlineTitle: true,
  forceEditingWhenEmpty: false,
  showCancelButton: true,
  showSubmitButton: true,
  isLocked: false,
  submitLabels: {},
};

export default BiodataSection;
