import React from 'react';
import PropTypes from 'prop-types';
import { Button, Form } from '@openedx/paragon';

import { PROFILE_FIELD_TYPES } from './config';

function renderControl(field, value, onChange) {
  if (field.type === PROFILE_FIELD_TYPES.SELECT) {
    return (
      <Form.Control
        as="select"
        value={value}
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
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <Form.Control
      type={field.type || PROFILE_FIELD_TYPES.TEXT}
      value={value}
      placeholder={field.placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

const RepeatableFieldGroup = ({
  repeatable,
  rows,
  onChange,
}) => (
  <div>
    {rows.map((row, rowIndex) => (
      <div key={row.rowId} className="border rounded p-3 mb-3">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <p className="h6 font-weight-bold mb-0">
            {repeatable.itemLabel} {rowIndex + 1}
          </p>
          <Button
            variant="link"
            className="p-0 text-danger"
            type="button"
            onClick={() => onChange('removeRow', { rowIndex })}
            disabled={rows.length === 1}
          >
            Remove
          </Button>
        </div>
        <div className="row">
          {repeatable.columns.map((column) => (
            <Form.Group
              key={`${row.rowId}-${column.key}`}
              className={column.type === PROFILE_FIELD_TYPES.TEXTAREA ? 'col-12 mb-3' : 'col-md-6 mb-3'}
            >
              <Form.Label>{column.label}</Form.Label>
              {renderControl(column, row[column.key], (value) => onChange('updateCell', {
                rowIndex,
                columnKey: column.key,
                value,
              }))}
            </Form.Group>
          ))}
        </div>
      </div>
    ))}
    <Button type="button" variant="link" className="p-0" onClick={() => onChange('addRow')}>
      + {repeatable.addButtonLabel}
    </Button>
  </div>
);

RepeatableFieldGroup.propTypes = {
  repeatable: PropTypes.shape({
    storageFieldName: PropTypes.string.isRequired,
    itemLabel: PropTypes.string.isRequired,
    addButtonLabel: PropTypes.string.isRequired,
    columns: PropTypes.arrayOf(PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      placeholder: PropTypes.string,
      type: PropTypes.string,
      options: PropTypes.arrayOf(PropTypes.shape({
        value: PropTypes.string,
        label: PropTypes.string,
      })),
    })).isRequired,
  }).isRequired,
  rows: PropTypes.arrayOf(PropTypes.shape({
    rowId: PropTypes.string.isRequired,
  })).isRequired,
  onChange: PropTypes.func.isRequired,
};

export default RepeatableFieldGroup;
