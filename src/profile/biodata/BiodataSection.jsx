import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Button, Form, StatefulButton,
} from '@openedx/paragon';

import EditableItemHeader from '../forms/elements/EditableItemHeader';
import SwitchContent from '../forms/elements/SwitchContent';

import { PROFILE_FIELD_TYPES } from './config';
import RepeatableFieldGroup from './RepeatableFieldGroup';
import {
  createEmptyRepeatableRow,
  getSectionError,
  getSectionInitialData,
  getSanitizedSectionData,
  getSectionSummary,
  isSingleMaritalStatus,
  readFileAsDataUrl,
  sectionHasValue,
} from './utils';

function renderFieldControl(field, value, onChange, error, disabled = false) {
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
        onChange={(event) => onChange(event.target.value)}
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
        rows={3}
        value={value}
        placeholder={field.placeholder}
        isInvalid={Boolean(error)}
        disabled={disabled}
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
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

const BiodataSection = ({
  section,
  extendedProfile,
  draftValue,
  errors,
  saveState,
  isAuthenticatedUserProfile,
  isEditing,
  onOpen,
  onClose,
  onSubmit,
  onDraftChange,
  spacingClassName,
  showInlineTitle,
  forceEditingWhenEmpty,
}) => {
  const committedData = useMemo(
    () => getSectionInitialData(section, extendedProfile),
    [section, extendedProfile],
  );
  const formData = draftValue || committedData;
  const hasContent = sectionHasValue(section, committedData);
  const sectionError = getSectionError(section, errors);

  if (!isAuthenticatedUserProfile && !hasContent) {
    return null;
  }

  let editMode = 'editing';
  if (!isAuthenticatedUserProfile) {
    editMode = 'static';
  } else if (isEditing) {
    editMode = 'editing';
  } else if (hasContent) {
    editMode = 'editable';
  } else if (forceEditingWhenEmpty) {
    editMode = 'editing';
  }

  const handleFieldChange = (fieldName, value) => {
    const nextFormData = {
      ...formData,
      [fieldName]: value,
    };

    if (section.id === 'basicInformation' && fieldName === 'marital_status' && isSingleMaritalStatus(value)) {
      nextFormData.number_of_children = '';
      nextFormData.sons = '';
      nextFormData.daughters = '';
    }

    onDraftChange(section.id, getSanitizedSectionData(section, nextFormData));
  };

  const handleRepeatableChange = (repeatable, action, payload = {}) => {
    const currentRows = formData[repeatable.storageFieldName] || [createEmptyRepeatableRow(repeatable)];
    let nextRows = currentRows;

    if (action === 'addRow') {
      nextRows = [...currentRows, createEmptyRepeatableRow(repeatable)];
    } else if (action === 'removeRow') {
      nextRows = currentRows.filter((_, index) => index !== payload.rowIndex);
      if (nextRows.length === 0) {
        nextRows = [createEmptyRepeatableRow(repeatable)];
      }
    } else if (action === 'updateCell') {
      nextRows = currentRows.map((row, index) => (
        index === payload.rowIndex ? { ...row, [payload.columnKey]: payload.value } : row
      ));
    }

    onDraftChange(section.id, {
      ...formData,
      [repeatable.storageFieldName]: nextRows,
    });
  };

  const handleFileChange = async (fieldName, file) => {
    if (!file) {
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    onDraftChange(section.id, {
      ...formData,
      [fieldName]: {
        name: file.name,
        dataUrl,
      },
    });
  };

  const handleSectionNaChange = (value) => {
    onDraftChange(section.id, getSanitizedSectionData(section, {
      ...formData,
      [section.naFieldName]: value,
    }));
  };

  const handleRepeatableNaChange = (repeatable, value) => {
    onDraftChange(section.id, getSanitizedSectionData(section, {
      ...formData,
      [repeatable.naFieldName]: value,
    }));
  };

  const isSectionDisabled = Boolean(section.naFieldName && formData[section.naFieldName]);
  const visibleFields = (section.fields || []).filter((field) => (
    section.id !== 'basicInformation'
    || !['number_of_children', 'sons', 'daughters'].includes(field.fieldName)
    || !isSingleMaritalStatus(formData.marital_status)
  ));

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
                <Alert variant="danger" dismissible={false} show className="mb-3">
                  {sectionError.userMessage}
                </Alert>
              )}
              {section.naFieldName && (
                <Form.Group className="mb-3">
                  <Form.Checkbox
                    checked={Boolean(formData[section.naFieldName])}
                    onChange={(event) => handleSectionNaChange(event.target.checked)}
                  >
                    {section.naLabel || 'N/A'}
                  </Form.Checkbox>
                </Form.Group>
              )}
              <div className="row">
                {visibleFields.map((field) => {
                  const error = errors[field.fieldName];
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
                        error,
                        isSectionDisabled,
                      )}
                      {error && error.userMessage && (
                        <Form.Control.Feedback hasIcon={false}>
                          {error.userMessage}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>
                  );
                })}
              </div>
              {(section.repeatables || []).map((repeatable) => (
                <div key={repeatable.storageFieldName} className="mb-3">
                  {repeatable.naFieldName && (
                    <Form.Group className="mb-2">
                      <Form.Checkbox
                        checked={Boolean(formData[repeatable.naFieldName])}
                        onChange={(event) => handleRepeatableNaChange(repeatable, event.target.checked)}
                      >
                        {repeatable.naLabel || 'N/A'}
                      </Form.Checkbox>
                    </Form.Group>
                  )}
                  <p className="h6 font-weight-bold mb-2">{repeatable.itemLabel}s</p>
                  <RepeatableFieldGroup
                    repeatable={repeatable}
                    rows={formData[repeatable.storageFieldName] || [createEmptyRepeatableRow(repeatable)]}
                    onChange={(action, payload) => handleRepeatableChange(repeatable, action, payload)}
                    disabled={isSectionDisabled || Boolean(repeatable.naFieldName && formData[repeatable.naFieldName])}
                  />
                </div>
              ))}
              {(section.fileFields || []).map((field) => {
                const fileValue = formData[field.fieldName];
                return (
                  <div key={field.fieldName} className="border rounded p-3 mb-3 bg-light-200">
                    <p className="h6 font-weight-bold mb-2">{field.label}</p>
                    <div className="d-flex flex-wrap align-items-center">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline-primary"
                        onClick={() => {
                          const input = document.getElementById(`${section.id}-${field.fieldName}`);
                          if (input) {
                            input.click();
                          }
                        }}
                      >
                        {fileValue ? `Replace ${field.label.toLowerCase()}` : `Upload ${field.label.toLowerCase()}`}
                      </Button>
                      {fileValue && (
                        <Button
                          type="button"
                          size="sm"
                          variant="link"
                          className="text-danger"
                          onClick={() => handleFieldChange(field.fieldName, null)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <input
                      id={`${section.id}-${field.fieldName}`}
                      type="file"
                      accept={field.accept}
                      className="d-none"
                      onChange={(event) => {
                        const input = event.currentTarget;
                        handleFileChange(field.fieldName, event.target.files && event.target.files[0]);
                        input.value = '';
                      }}
                    />
                    {fileValue && (
                      <div className="mt-3">
                        <img
                          src={fileValue.dataUrl}
                          alt={`${field.label} preview`}
                          className="border rounded p-2 bg-white"
                          style={{ maxWidth: '14rem', maxHeight: '5rem', objectFit: 'contain' }}
                        />
                        <p className="small text-muted mt-2 mb-0">{fileValue.name}</p>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="d-flex flex-row-reverse flex-wrap justify-content-end align-items-center">
                <div className="row form-group flex-shrink-0 flex-grow-1 m-0 p-0">
                  <div className="pr-2 pl-0 m-0">
                    <Button variant="outline-primary" type="button" onClick={() => onClose(section.id)}>
                      Cancel
                    </Button>
                  </div>
                  <div className="p-0 m-0">
                    <StatefulButton
                      type="submit"
                      state={saveState === 'error' ? null : saveState}
                      labels={{
                        default: 'Save',
                        pending: 'Saving',
                        complete: 'Saved',
                      }}
                      disabledStates={[]}
                    />
                  </div>
                </div>
              </div>
            </form>
          </div>
        ),
        editable: (
          <>
            {showInlineTitle && (
              <p id={`${section.id}-label`} className="h5 font-weight-bold m-0 pb-1.5">
                {section.title}
              </p>
            )}
            {showInlineTitle && section.helperText && (
              <p className="text-muted small mb-2">{section.helperText}</p>
            )}
            <EditableItemHeader
              content={getSectionSummary(section, committedData)}
              showEditButton
              onClickEdit={() => onOpen(section.id)}
            />
          </>
        ),
        static: (
          <>
            {showInlineTitle && (
              <p id={`${section.id}-label`} className="h5 font-weight-bold m-0 pb-1.5">
                {section.title}
              </p>
            )}
            {showInlineTitle && section.helperText && (
              <p className="text-muted small mb-2">{section.helperText}</p>
            )}
            <EditableItemHeader content={getSectionSummary(section, committedData)} />
          </>
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
    })),
    repeatables: PropTypes.arrayOf(PropTypes.shape({
      storageFieldName: PropTypes.string.isRequired,
      itemLabel: PropTypes.string.isRequired,
      addButtonLabel: PropTypes.string.isRequired,
      naFieldName: PropTypes.string,
      naLabel: PropTypes.string,
      emptyRow: PropTypes.objectOf(PropTypes.string).isRequired,
      columns: PropTypes.arrayOf(PropTypes.shape({
        key: PropTypes.string.isRequired,
        label: PropTypes.string.isRequired,
        type: PropTypes.string,
        placeholder: PropTypes.string,
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
  onOpen: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onDraftChange: PropTypes.func.isRequired,
  spacingClassName: PropTypes.string,
  showInlineTitle: PropTypes.bool,
  forceEditingWhenEmpty: PropTypes.bool,
};

BiodataSection.defaultProps = {
  extendedProfile: [],
  draftValue: null,
  errors: {},
  saveState: null,
  spacingClassName: 'pt-40px',
  showInlineTitle: true,
  forceEditingWhenEmpty: false,
};

export default BiodataSection;
