import React from 'react';
import PropTypes from 'prop-types';
import { Button, Form } from '@openedx/paragon';

import { PROFILE_FIELD_TYPES } from './config';
import { BiodataFileActions, BiodataFilePreview } from './BiodataFilePreview';
import {
  createFileUploadValue,
  getRepeatableFieldErrorKey,
  isProtectedRepeatableColumn,
  isProtectedRepeatableRow,
  revokeFilePreviewUrl,
} from './utils';

function renderControl(field, value, onChange, onBlur, error, disabled = false) {
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
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
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
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
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
      onBlur={onBlur}
      onChange={(event) => onChange(event.target.value)}
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
                const error = errors[getRepeatableFieldErrorKey(repeatable, row, column.key)] || errors[column.key];
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
                    {renderControl(controlField, row[column.key], (value) => onChange('updateCell', {
                      rowIndex,
                      columnKey: column.key,
                      value,
                    }), () => onBlur(rowIndex, column.key), error, isControlDisabled)}
                    {!isControlDisabled && error && error.userMessage && (
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
