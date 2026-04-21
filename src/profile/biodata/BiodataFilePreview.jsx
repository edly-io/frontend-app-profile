import React from 'react';
import PropTypes from 'prop-types';
import {
  Button, OverlayTrigger, Tooltip,
} from '@openedx/paragon';
import {
  DeleteOutline, EditOutline, Preview, UploadFile,
} from '@openedx/paragon/icons';

import { getFilePreview } from './utils';

function openPreview(previewUrl) {
  if (!previewUrl || typeof window === 'undefined') {
    return;
  }

  const openedWindow = window.open(previewUrl, '_blank', 'noopener,noreferrer');
  if (openedWindow) {
    openedWindow.opener = null;
    return;
  }

  window.location.assign(previewUrl);
}

function renderTooltip(label, id) {
  return (
    <Tooltip variant="light" id={id}>
      <p className="h6 font-weight-normal m-0 p-0">{label}</p>
    </Tooltip>
  );
}

const FileIconButton = ({
  label,
  icon: IconComponent,
  variant,
  disabled,
  onClick,
}) => (
  <OverlayTrigger
    placement="top"
    overlay={renderTooltip(label, `biodata-file-action-${label.toLowerCase().replace(/\s+/g, '-')}`)}
  >
    <Button
      type="button"
      size="sm"
      variant={variant}
      className="d-inline-flex align-items-center justify-content-center mr-2 mb-2 p-2"
      disabled={disabled}
      aria-label={label}
      onClick={onClick}
      style={{ width: '2.25rem', height: '2.25rem' }}
    >
      <IconComponent aria-hidden focusable="false" />
    </Button>
  </OverlayTrigger>
);

const BiodataFileActions = ({
  field,
  fileValue,
  disabled,
  onReplace,
  onRemove,
}) => {
  const preview = getFilePreview(fileValue);

  return (
    <div className="d-flex flex-wrap align-items-center">
      {preview?.canOpen && (
        <FileIconButton
          label={`Preview ${field.label}`}
          icon={Preview}
          variant="outline-primary"
          disabled={false}
          onClick={() => openPreview(preview.url)}
        />
      )}
      <FileIconButton
        label={fileValue ? `Replace ${field.label}` : `Upload ${field.label}`}
        icon={fileValue ? EditOutline : UploadFile}
        variant="outline-primary"
        disabled={disabled}
        onClick={onReplace}
      />
      {fileValue && (
        <FileIconButton
          label={`Remove ${field.label}`}
          icon={DeleteOutline}
          variant="outline-danger"
          disabled={disabled}
          onClick={onRemove}
        />
      )}
    </div>
  );
};

const BiodataFilePreview = ({ field, fileValue }) => {
  const preview = getFilePreview(fileValue);

  if (!preview) {
    return <p className="small text-muted mb-0">No file uploaded</p>;
  }

  return (
    <div className="mt-2">
      {preview.kind === 'image' && preview.url && (
        <img
          src={preview.url}
          alt={`${field.label} preview`}
          className="border rounded p-2 bg-white"
          style={{ maxWidth: '14rem', maxHeight: '5rem', objectFit: 'contain' }}
          onError={(event) => {
            event.currentTarget.classList.add('d-none');
          }}
        />
      )}
      {preview.kind !== 'image' && (
        <p className="small text-muted mb-0">
          <span className="badge badge-light border text-muted mr-2">
            {preview.kind === 'pdf' ? 'PDF' : 'File'}
          </span>
          {preview.name}
        </p>
      )}
      {preview.kind === 'image' && (
        <p className="small text-muted mt-2 mb-0">{preview.name}</p>
      )}
    </div>
  );
};

FileIconButton.propTypes = {
  label: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  variant: PropTypes.string.isRequired,
  disabled: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
};

FileIconButton.defaultProps = {
  disabled: false,
};

BiodataFileActions.propTypes = {
  field: PropTypes.shape({
    label: PropTypes.string.isRequired,
  }).isRequired,
  fileValue: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.shape({}),
  ]),
  disabled: PropTypes.bool,
  onReplace: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
};

BiodataFileActions.defaultProps = {
  fileValue: null,
  disabled: false,
};

BiodataFilePreview.propTypes = {
  field: PropTypes.shape({
    label: PropTypes.string.isRequired,
  }).isRequired,
  fileValue: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.shape({}),
  ]),
};

BiodataFilePreview.defaultProps = {
  fileValue: null,
};

export {
  BiodataFileActions,
  BiodataFilePreview,
};
