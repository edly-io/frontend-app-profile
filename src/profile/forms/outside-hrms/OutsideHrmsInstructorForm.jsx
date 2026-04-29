import React, { useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Button, Card, Form,
} from '@openedx/paragon';

import { saveOutsideHrmsInstructorProfile } from '../../data/services';
import { BiodataFileActions, BiodataFilePreview } from '../../biodata/BiodataFilePreview';
import { createFileUploadValue, getFileUploadBlob, revokeFilePreviewUrl } from '../../biodata/utils';

const INITIAL_FORM_VALUE = {
  name: '',
  shortName: '',
  designation: '',
  phone: '',
  mobile: '',
  address: '',
  expertise: '',
  organization: '',
  email: '',
  cnic: '',
};

const FORM_FIELDS = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'shortName', label: 'Short Name', type: 'text' },
  { key: 'designation', label: 'Designation', type: 'text' },
  { key: 'phone', label: 'Phone', type: 'tel' },
  { key: 'mobile', label: 'Mobile', type: 'tel' },
  { key: 'address', label: 'Address', type: 'text' },
  { key: 'expertise', label: 'Expertise', type: 'text' },
  { key: 'organization', label: 'Organization', type: 'text' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'cnic', label: 'CNIC', type: 'text' },
];

const CNIC_FILE_FIELDS = [
  { key: 'cnicFront', label: 'CNIC Front' },
  { key: 'cnicBack', label: 'CNIC Back' },
];

const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp,application/pdf';

const INITIAL_CNIC_FILES = { cnicFront: null, cnicBack: null };

const getRequiredErrors = (formValue, cnicFiles) => {
  const fieldErrors = FORM_FIELDS.reduce((accumulator, field) => {
    if (!String(formValue[field.key] || '').trim()) {
      accumulator[field.key] = `${field.label} is required.`;
    }
    return accumulator;
  }, {});

  CNIC_FILE_FIELDS.forEach(({ key, label }) => {
    if (!cnicFiles[key]) {
      fieldErrors[key] = `${label} is required.`;
    }
  });

  return fieldErrors;
};

const fileToBase64 = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const OutsideHrmsInstructorForm = ({ onComplete, username }) => {
  const [formValue, setFormValue] = useState(INITIAL_FORM_VALUE);
  const [cnicFiles, setCnicFiles] = useState(INITIAL_CNIC_FILES);
  const [errors, setErrors] = useState({});
  const [showSavedMessage, setShowSavedMessage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const cnicFrontInputRef = useRef(null);
  const cnicBackInputRef = useRef(null);
  const fileInputRefs = { cnicFront: cnicFrontInputRef, cnicBack: cnicBackInputRef };

  const errorCount = useMemo(() => Object.keys(errors).length, [errors]);

  const handleChange = (fieldName, value) => {
    setFormValue(previousValue => ({
      ...previousValue,
      [fieldName]: value,
    }));
    setErrors(previousErrors => {
      const nextErrors = { ...previousErrors };
      delete nextErrors[fieldName];
      return nextErrors;
    });
    setShowSavedMessage(false);
    setSaveError('');
  };

  const handleFileSelect = (fieldKey, file) => {
    if (!file) {
      return;
    }
    setCnicFiles((prev) => {
      revokeFilePreviewUrl(prev[fieldKey]);
      return { ...prev, [fieldKey]: createFileUploadValue(file) };
    });
    setErrors(previousErrors => {
      const nextErrors = { ...previousErrors };
      delete nextErrors[fieldKey];
      return nextErrors;
    });
    setShowSavedMessage(false);
    setSaveError('');
    if (fileInputRefs[fieldKey]?.current) {
      fileInputRefs[fieldKey].current.value = '';
    }
  };

  const handleFileRemove = (fieldKey) => {
    setCnicFiles((prev) => {
      revokeFilePreviewUrl(prev[fieldKey]);
      return { ...prev, [fieldKey]: null };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = getRequiredErrors(formValue, cnicFiles);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setShowSavedMessage(false);
      setSaveError('');
      return;
    }

    setIsSaving(true);
    setSaveError('');

    try {
      const frontBlob = getFileUploadBlob(cnicFiles.cnicFront);
      const backBlob = getFileUploadBlob(cnicFiles.cnicBack);

      const [cnicFrontBase64, cnicBackBase64] = await Promise.all([
        fileToBase64(frontBlob),
        fileToBase64(backBlob),
      ]);

      const completionStatus = await saveOutsideHrmsInstructorProfile(
        {
          ...formValue,
          cnicFrontAttachment: cnicFrontBase64,
          cnicFrontAttachmentName: cnicFiles.cnicFront.name,
          cnicBackAttachment: cnicBackBase64,
          cnicBackAttachmentName: cnicFiles.cnicBack.name,
        },
        username,
      );

      revokeFilePreviewUrl(cnicFiles.cnicFront);
      revokeFilePreviewUrl(cnicFiles.cnicBack);
      setFormValue(INITIAL_FORM_VALUE);
      setCnicFiles(INITIAL_CNIC_FILES);
      setErrors({});
      setShowSavedMessage(true);
      onComplete(completionStatus);
    } catch (error) {
      setShowSavedMessage(false);
      setSaveError('Unable to save instructor details. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <Card.Section className="bg-primary text-white">
        <div className="d-flex flex-wrap align-items-center justify-content-between mb-0">
          <h2 className="h4 mb-0 text-white">Instructor</h2>
          <Form.Checkbox checked readOnly className="mb-0 text-white">
            New Instructor outside FBR
          </Form.Checkbox>
        </div>
      </Card.Section>
      <Card.Section>
        {errorCount > 0 && (
          <Alert variant="danger" dismissible={false} show>
            Please complete {errorCount === 1 ? 'this field' : `${errorCount} fields`} before saving.
          </Alert>
        )}
        {showSavedMessage && (
          <Alert variant="success" dismissible={false} show>
            Instructor details saved.
          </Alert>
        )}
        {saveError && (
          <Alert variant="danger" dismissible={false} show>
            {saveError}
          </Alert>
        )}
        <Form onSubmit={handleSubmit}>
          <div className="row">
            {FORM_FIELDS.map((field) => (
              <Form.Group key={field.key} className="col-md-6 mb-3">
                <Form.Label htmlFor={`outside-hrms-${field.key}`}>{field.label}</Form.Label>
                <Form.Control
                  id={`outside-hrms-${field.key}`}
                  type={field.type}
                  value={formValue[field.key]}
                  isInvalid={Boolean(errors[field.key])}
                  onChange={(event) => handleChange(field.key, event.target.value)}
                />
                {errors[field.key] && (
                  <Form.Control.Feedback hasIcon={false} className="d-block text-danger small mt-1">
                    {errors[field.key]}
                  </Form.Control.Feedback>
                )}
              </Form.Group>
            ))}

            {CNIC_FILE_FIELDS.map(({ key, label }) => (
              <Form.Group key={key} className="col-md-6 mb-3">
                <Form.Label>{label}</Form.Label>
                <input
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES}
                  ref={fileInputRefs[key]}
                  className="d-none"
                  onChange={(event) => handleFileSelect(key, event.target.files[0] || null)}
                />
                <div className={errors[key] ? 'border border-danger rounded p-2' : ''}>
                  <BiodataFileActions
                    field={{ label }}
                    fileValue={cnicFiles[key]}
                    onReplace={() => fileInputRefs[key].current?.click()}
                    onRemove={() => handleFileRemove(key)}
                  />
                  <BiodataFilePreview field={{ label }} fileValue={cnicFiles[key]} />
                </div>
                {errors[key] && (
                  <Form.Control.Feedback hasIcon={false} className="d-block text-danger small mt-1">
                    {errors[key]}
                  </Form.Control.Feedback>
                )}
              </Form.Group>
            ))}
          </div>
          <Button type="submit" variant="primary" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </Form>
      </Card.Section>
    </Card>
  );
};

OutsideHrmsInstructorForm.propTypes = {
  onComplete: PropTypes.func,
  username: PropTypes.string,
};

OutsideHrmsInstructorForm.defaultProps = {
  onComplete: () => {},
  username: null,
};

export default OutsideHrmsInstructorForm;
