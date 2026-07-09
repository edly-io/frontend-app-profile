import React from 'react';
import PropTypes from 'prop-types';
import { Button, Form } from '@openedx/paragon';

import { PROFILE_FIELD_TYPES } from './config';
import { BiodataFileActions, BiodataFilePreview } from './BiodataFilePreview';
import {
  createFileUploadValue,
  FIELD_NAMES_REQUIRING_NON_NEGATIVE_NUMBERS,
  fieldAllowsOnlyDigits,
  fieldDisallowsDigits,
  FIELD_NAMES_REQUIRING_VALID_YEAR,
  getRepeatableFieldErrorKey,
  isProtectedRepeatableColumn,
  isProtectedRepeatableRow,
  removeNonDigitsFromValue,
  revokeFilePreviewUrl,
} from './utils';

const TODAY_DATE = new Date().toISOString().slice(0, 10);
const DATE_FIELDS_WITH_MAX_TODAY = new Set(['attended_from', 'attended_to']);
const REPEATABLE_FROM_FIELD_NAMES = new Set(['from', 'attended_from']);
const REPEATABLE_TO_FIELD_CONFIG = {
  attended_to: {
    relatedFromField: 'attended_from',
    maxToday: true,
  },
  to: {
    relatedFromField: 'from',
    maxToday: true,
  },
};

function isValidDateValue(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

function getFieldInputAttributes(field, row) {
  if (field.type === PROFILE_FIELD_TYPES.DATE && DATE_FIELDS_WITH_MAX_TODAY.has(field.key)) {
    return { max: TODAY_DATE };
  }

  if (field.type === PROFILE_FIELD_TYPES.DATE && REPEATABLE_FROM_FIELD_NAMES.has(field.key)) {
    return { max: TODAY_DATE };
  }

  if (field.type === PROFILE_FIELD_TYPES.DATE && REPEATABLE_TO_FIELD_CONFIG[field.key]) {
    const { relatedFromField, maxToday } = REPEATABLE_TO_FIELD_CONFIG[field.key];
    const nextAttributes = {};
    const fromValue = row?.[relatedFromField];

    if (isValidDateValue(fromValue)) {
      nextAttributes.min = fromValue;
    }

    if (maxToday) {
      nextAttributes.max = TODAY_DATE;
    }

    return nextAttributes;
  }

  if (FIELD_NAMES_REQUIRING_VALID_YEAR.has(field.key)) {
    return {
      inputMode: 'numeric',
      pattern: '\\d{4}',
      maxLength: 4,
    };
  }

  if (
    field.type === PROFILE_FIELD_TYPES.NUMBER
    && FIELD_NAMES_REQUIRING_NON_NEGATIVE_NUMBERS.has(field.key)
  ) {
    return {
      min: 0,
      inputMode: 'numeric',
    };
  }

  if (
    (field.type === PROFILE_FIELD_TYPES.TEXT || field.type === PROFILE_FIELD_TYPES.TEXTAREA || !field.type)
    && fieldAllowsOnlyDigits(field.key)
  ) {
    return { inputMode: 'tel' };
  }

  if (
    (field.type === PROFILE_FIELD_TYPES.TEXT || field.type === PROFILE_FIELD_TYPES.TEXTAREA || !field.type)
    && fieldDisallowsDigits(field.key)
  ) {
    return { inputMode: 'text' };
  }

  return {};
}

function normalizeFieldInputValue(field, value) {
  let nextValue = value;

  if (
    field.type === PROFILE_FIELD_TYPES.NUMBER
    && FIELD_NAMES_REQUIRING_NON_NEGATIVE_NUMBERS.has(field.key)
  ) {
    nextValue = removeNonDigitsFromValue(nextValue);
  }

  return nextValue;
}

function renderControl(
  field,
  value,
  row,
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

  if (field.type === PROFILE_FIELD_TYPES.FILE) {
    const inputId = field.inputId || field.key;
    return (
      <div>
        <BiodataFileActions
          field={field}
          fileValue={value}
          disabled={disabled}
          onReplace={() => {
            const input = document.getElementById(inputId);
            if (input) {
              input.click();
            }
          }}
          onRemove={() => {
            revokeFilePreviewUrl(value);
            onChange(null);
          }}
        />
        <input
          id={inputId}
          type="file"
          accept={field.accept}
          className="d-none"
          disabled={disabled}
          onChange={async (event) => {
            const input = event.currentTarget;
            const file = event.target.files && event.target.files[0];
            if (file) {
              revokeFilePreviewUrl(value);
              onChange(createFileUploadValue(file));
            }
            input.value = '';
          }}
        />
        <BiodataFilePreview field={field} fileValue={value} />
      </div>
    );
  }

  if (field.type === PROFILE_FIELD_TYPES.SELECT) {
    return (
      <Form.Control
        as="select"
        value={value}
        isInvalid={Boolean(error)}
        disabled={disabled}
        {...getFieldInputAttributes(field, row)}
        onBlur={onBlur}
        onFocus={syncNativeValidationState}
        onInvalid={(event) => onNativeValidationChange(event.currentTarget.validationMessage)}
        onChange={(event) => {
          syncNativeValidationState(event);
          onChange(normalizeFieldInputValue(field, event.target.value));
        }}
      >
        {(field.options || []).map((option) => (
          <option key={`${field.key}-${option.value || 'blank'}`} value={option.value}>
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
        rows={3}
        value={value}
        placeholder={field.placeholder}
        isInvalid={Boolean(error)}
        disabled={disabled}
        {...getFieldInputAttributes(field, row)}
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
      {...getFieldInputAttributes(field, row)}
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

const RepeatableFieldGroup = ({
  repeatable,
  rows,
  errors,
  onChange,
  onBlur,
  disabled,
}) => {
  const groupError = errors[repeatable.storageFieldName];
  const [nativeValidationErrors, setNativeValidationErrors] = React.useState({});

  const handleNativeValidationChange = (fieldKey, validationMessage) => {
    setNativeValidationErrors((previousErrors) => {
      if (!validationMessage) {
        if (!previousErrors[fieldKey]) {
          return previousErrors;
        }

        const nextErrors = { ...previousErrors };
        delete nextErrors[fieldKey];
        return nextErrors;
      }

      if (previousErrors[fieldKey] === validationMessage) {
        return previousErrors;
      }

      return {
        ...previousErrors,
        [fieldKey]: validationMessage,
      };
    });
  };

  return (
    <div>
      {rows.map((row, rowIndex) => {
        const isProtectedRow = isProtectedRepeatableRow(row, repeatable);

        return (
          <div key={row.rowId} className="border rounded p-3 mb-3">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <p className="h6 font-weight-bold mb-0">
                {repeatable.itemLabel}{repeatable.showRowNumber === false ? '' : ` ${rowIndex + 1}`}
              </p>
              <Button
                variant="link"
                className="p-0 text-danger"
                type="button"
                onClick={() => onChange('removeRow', { rowIndex })}
                disabled={disabled || rows.length === 1 || isProtectedRow}
              >
                Remove
              </Button>
            </div>
            <div className="row">
              {repeatable.columns.map((column) => {
                const error = errors[getRepeatableFieldErrorKey(repeatable, row, column.key)];
                const controlField = {
                  ...column,
                  inputId: `${row.rowId}-${column.key}`,
                };
                const isControlDisabled = disabled
                  || Boolean(column.displayOnly)
                  || isProtectedRepeatableColumn(row, repeatable, column.key);
                return (
                  <Form.Group
                    key={`${row.rowId}-${column.key}`}
                    className={column.type === PROFILE_FIELD_TYPES.TEXTAREA ? 'col-12 mb-3' : 'col-md-6 mb-3'}
                  >
                    <Form.Label>{column.label}</Form.Label>
                    {(() => {
                      const nativeValidationKey = `${row.rowId}.${column.key}`;
                      return renderControl(controlField, row[column.key], row, (value) => onChange('updateCell', {
                        rowIndex,
                        columnKey: column.key,
                        value,
                      }), () => onBlur(rowIndex, column.key), error, isControlDisabled, (validationMessage) => {
                        handleNativeValidationChange(nativeValidationKey, validationMessage);
                      });
                    })()}
                    {!isControlDisabled && error && error.userMessage && !nativeValidationErrors[`${row.rowId}.${column.key}`] && (
                    <Form.Control.Feedback hasIcon={false} className="d-block text-danger small mt-1">
                      {error.userMessage}
                    </Form.Control.Feedback>
                    )}
                  </Form.Group>
                );
              })}
            </div>
          </div>
        );
      })}
      <Button type="button" variant="link" className="p-0" onClick={() => onChange('addRow')} disabled={disabled}>
        + {repeatable.addButtonLabel}
      </Button>
      {!disabled && groupError?.userMessage && (
        <Form.Control.Feedback hasIcon={false} className="d-block text-danger small mt-2">
          {groupError.userMessage}
        </Form.Control.Feedback>
      )}
    </div>
  );
};

RepeatableFieldGroup.propTypes = {
  repeatable: PropTypes.shape({
    storageFieldName: PropTypes.string.isRequired,
    itemLabel: PropTypes.string.isRequired,
    addButtonLabel: PropTypes.string.isRequired,
    showRowNumber: PropTypes.bool,
    columns: PropTypes.arrayOf(PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      placeholder: PropTypes.string,
      type: PropTypes.string,
      accept: PropTypes.string,
      displayOnly: PropTypes.bool,
      options: PropTypes.arrayOf(PropTypes.shape({
        value: PropTypes.string,
        label: PropTypes.string,
      })),
    })).isRequired,
    protectedRowKey: PropTypes.string,
    protectedRows: PropTypes.arrayOf(PropTypes.objectOf(PropTypes.string)),
    protectedColumns: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  rows: PropTypes.arrayOf(PropTypes.shape({
    rowId: PropTypes.string.isRequired,
  })).isRequired,
  errors: PropTypes.objectOf(PropTypes.oneOfType([
    PropTypes.shape({
      userMessage: PropTypes.string,
    }),
    PropTypes.string,
  ])),
  onChange: PropTypes.func.isRequired,
  onBlur: PropTypes.func,
  disabled: PropTypes.bool,
};

RepeatableFieldGroup.defaultProps = {
  errors: {},
  onBlur: () => {},
  disabled: false,
};

export default RepeatableFieldGroup;
