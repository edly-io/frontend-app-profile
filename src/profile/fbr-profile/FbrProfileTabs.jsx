import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';
import PropTypes from 'prop-types';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import {
  Alert, Button, Card, Form, Nav,
} from '@openedx/paragon';

import { getBiodataEndpointUrl } from '../biodata/apiConfig';
import BiodataProfileSections from '../biodata/BiodataProfileSections';

const TRAINEE_TYPE_LABELS = {
  stp: 'STP',
  dst_ist: 'DST / IST',
};

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  middle_admin: 'Middle Admin',
  data_admin: 'Data Admin',
  instructor: 'Instructor',
  trainee: 'Trainee',
};

const USER_DETAIL_PATH = id => getBiodataEndpointUrl(`v1/users/${id}/`);
const BATCHES_PATH = () => getBiodataEndpointUrl('v1/users/batches/');
const EDIT_REQUEST_MY_PATH = () => getBiodataEndpointUrl('v1/edit-requests/my/');
const EDIT_REQUEST_CREATE_PATH = () => getBiodataEndpointUrl('v1/edit-requests/create/');

const formatRoles = roles => (Array.isArray(roles) ? roles.map(role => ROLE_LABELS[role] || role).join(', ') : '');

const normalizeValue = value => (typeof value === 'string' ? value.trim() : value);

const getPakistanMobileSubscriber = (value) => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('92')) { digits = digits.slice(2); }
  if (digits.startsWith('0')) { digits = digits.slice(1); }
  if (digits && digits[0] !== '3') { digits = ''; }
  return digits.slice(0, 10);
};

const formatPakistanMobileValue = value => `+92${getPakistanMobileSubscriber(value)}`;

const normalizePakistanMobilePayload = (value) => {
  const subscriber = getPakistanMobileSubscriber(value);
  return subscriber ? `+92${subscriber}` : '';
};

const isValidOptionalPakistanMobile = (value) => {
  const subscriber = getPakistanMobileSubscriber(value);
  return !subscriber || /^3\d{9}$/.test(subscriber);
};

const getApiErrorMessage = (error, fallback) => {
  const data = error?.response?.data;
  if (!data) {
    return fallback;
  }
  if (typeof data === 'string') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.join(' ');
  }
  if (Array.isArray(data.detail)) {
    return data.detail.join(' ');
  }
  if (data.detail) {
    return data.detail;
  }
  if (Array.isArray(data.non_field_errors)) {
    return data.non_field_errors.join(' ');
  }
  if (data.non_field_errors) {
    return data.non_field_errors;
  }
  return fallback;
};

const readOnlyFieldStyle = { backgroundColor: '#f7f7f7', cursor: 'not-allowed' };
const cityShape = PropTypes.shape({
  name: PropTypes.string,
});

const batchShape = PropTypes.shape({
  id: PropTypes.number,
  name: PropTypes.string,
});

const traineeProfileShape = PropTypes.shape({
  trainee_type: PropTypes.string,
  batch: batchShape,
  date_of_birth: PropTypes.string,
  designation: PropTypes.string,
  bps_grade: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  hostel_preference: PropTypes.string,
  service_history: PropTypes.string,
  languages_awards_publications: PropTypes.string,
});

const instructorProfileShape = PropTypes.shape({
  field_of_expertise: PropTypes.string,
  languages_awards_publications: PropTypes.string,
});

const profileShape = PropTypes.shape({
  id: PropTypes.number,
  full_name: PropTypes.string,
  email: PropTypes.string,
  mobile: PropTypes.string,
  cnic: PropTypes.string,
  roles: PropTypes.arrayOf(PropTypes.string),
  status: PropTypes.string,
  city: cityShape,
  field_organisation: PropTypes.string,
  employee_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  emergency_contact_name: PropTypes.string,
  emergency_contact_phone: PropTypes.string,
  education_degree: PropTypes.string,
  education_institute: PropTypes.string,
  education_year: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  trainee_profile: traineeProfileShape,
  instructor_profile: instructorProfileShape,
});

const toBaseForm = profile => ({
  full_name: profile?.full_name || '',
  email: profile?.email || '',
  mobile: profile?.mobile || '',
  cnic: profile?.cnic || '',
  field_organisation: profile?.field_organisation || '',
  emergency_contact_name: profile?.emergency_contact_name || '',
  emergency_contact_phone: profile?.emergency_contact_phone || '',
  education_degree: profile?.education_degree || '',
  education_institute: profile?.education_institute || '',
  education_year: profile?.education_year || '',
});

const toTraineeForm = traineeProfile => ({
  trainee_type: traineeProfile?.trainee_type || 'stp',
  batch: traineeProfile?.batch?.id || '',
  date_of_birth: traineeProfile?.date_of_birth || '',
  designation: traineeProfile?.designation || '',
  bps_grade: traineeProfile?.bps_grade || '',
  service_history: traineeProfile?.service_history || '',
  hostel_preference: traineeProfile?.hostel_preference || '',
  languages_awards_publications: traineeProfile?.languages_awards_publications || '',
});

const toInstructorForm = instructorProfile => ({
  field_of_expertise: instructorProfile?.field_of_expertise || '',
  languages_awards_publications: instructorProfile?.languages_awards_publications || '',
});

const DetailCell = ({ label, value }) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return (
    <div className="col-md-6 col-lg-4 mb-4">
      <div className="small text-uppercase text-muted font-weight-bold mb-1">{label}</div>
      <div className="text-gray-900" style={{ wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
};

DetailCell.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

DetailCell.defaultProps = {
  value: '',
};

const EditableCard = ({
  title, helperText, isEditing, onEdit, onCancel, onSave, isSaving, error, children,
}) => (
  <Card className="shadow-sm">
    <Card.Section>
      <div className="d-flex flex-wrap justify-content-between align-items-start mb-4">
        <div>
          <h2 className="h3 mb-1">{title}</h2>
          {helperText && <div className="small text-muted">{helperText}</div>}
        </div>
        <div className="d-flex flex-wrap align-items-center" style={{ gap: '0.5rem' }}>
          {isEditing ? (
            <>
              <Button variant="tertiary" onClick={onCancel} disabled={isSaving}>Cancel</Button>
              <Button variant="primary" onClick={onSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </>
          ) : (
            <Button variant="outline-primary" onClick={onEdit}>Edit</Button>
          )}
        </div>
      </div>
      {error && (
        <Alert variant="danger" dismissible={false} show>
          {error}
        </Alert>
      )}
      {children}
    </Card.Section>
  </Card>
);

EditableCard.propTypes = {
  title: PropTypes.string.isRequired,
  helperText: PropTypes.string,
  isEditing: PropTypes.bool.isRequired,
  onEdit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  isSaving: PropTypes.bool.isRequired,
  error: PropTypes.string,
  children: PropTypes.node.isRequired,
};

EditableCard.defaultProps = {
  helperText: '',
  error: '',
};

const TextInput = ({
  label, value, onChange, type, readOnly, as, inputKind,
}) => (
  <Form.Group className="col-md-6 col-lg-4 mb-4">
    <Form.Label>{label}</Form.Label>
    <Form.Control
      as={as}
      type={inputKind === 'pakistan-mobile' ? 'text' : type}
      value={inputKind === 'pakistan-mobile' ? formatPakistanMobileValue(value) : value || ''}
      readOnly={readOnly}
      disabled={readOnly}
      style={readOnly ? readOnlyFieldStyle : undefined}
      rows={as === 'textarea' ? 3 : undefined}
      inputMode={inputKind === 'pakistan-mobile' ? 'numeric' : undefined}
      maxLength={inputKind === 'pakistan-mobile' ? 13 : undefined}
      onChange={event => onChange(inputKind === 'pakistan-mobile' ? formatPakistanMobileValue(event.target.value) : event.target.value)}
    />
  </Form.Group>
);

TextInput.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  type: PropTypes.string,
  readOnly: PropTypes.bool,
  as: PropTypes.string,
  inputKind: PropTypes.string,
};

TextInput.defaultProps = {
  value: '',
  onChange: () => {},
  type: 'text',
  readOnly: false,
  as: undefined,
  inputKind: '',
};

const BaseProfilePanel = ({
  profile, onProfileUpdated,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [formValue, setFormValue] = useState(() => toBaseForm(profile));

  useEffect(() => {
    setFormValue(toBaseForm(profile));
  }, [profile]);

  const setField = (field, value) => {
    setFormValue(previous => ({ ...previous, [field]: value }));
    setError('');
  };

  const handleCancel = () => {
    setFormValue(toBaseForm(profile));
    setIsEditing(false);
    setError('');
  };

  const handleSave = async () => {
    if (!isValidOptionalPakistanMobile(formValue.mobile)) {
      setError('Mobile must start with 3 and contain 10 digits after +92.');
      return;
    }
    if (!isValidOptionalPakistanMobile(formValue.emergency_contact_phone)) {
      setError('Emergency phone must start with 3 and contain 10 digits after +92.');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      const payload = {
        full_name: normalizeValue(formValue.full_name),
        mobile: normalizePakistanMobilePayload(formValue.mobile) || null,
        field_organisation: normalizeValue(formValue.field_organisation) || '',
        emergency_contact_name: normalizeValue(formValue.emergency_contact_name) || '',
        emergency_contact_phone: normalizePakistanMobilePayload(formValue.emergency_contact_phone) || '',
        education_degree: normalizeValue(formValue.education_degree) || '',
        education_institute: normalizeValue(formValue.education_institute) || '',
        education_year: formValue.education_year ? Number(formValue.education_year) : null,
      };
      const { data } = await getAuthenticatedHttpClient().patch(USER_DETAIL_PATH(profile.id), payload);
      onProfileUpdated(data);
      setIsEditing(false);
    } catch (saveError) {
      setError(saveError?.response?.data?.detail || 'Unable to update your profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <EditableCard
      title="Your Profile"
      helperText="Core FBR profile details. Email and CNIC cannot be changed here."
      isEditing={isEditing}
      onEdit={() => setIsEditing(true)}
      onCancel={handleCancel}
      onSave={handleSave}
      isSaving={isSaving}
      error={error}
    >
      {isEditing ? (
        <div className="row">
          <TextInput label="Full Name" value={formValue.full_name} onChange={value => setField('full_name', value)} />
          <TextInput label="Email" value={formValue.email} readOnly />
          <TextInput label="Mobile" value={formValue.mobile} inputKind="pakistan-mobile" onChange={value => setField('mobile', value)} />
          <TextInput label="CNIC" value={formValue.cnic} readOnly />
          <TextInput label="Field Organisation" value={formValue.field_organisation} onChange={value => setField('field_organisation', value)} />
          <TextInput label="Emergency Contact" value={formValue.emergency_contact_name} onChange={value => setField('emergency_contact_name', value)} />
          <TextInput label="Emergency Phone" value={formValue.emergency_contact_phone} inputKind="pakistan-mobile" onChange={value => setField('emergency_contact_phone', value)} />
          <TextInput label="Education Degree" value={formValue.education_degree} onChange={value => setField('education_degree', value)} />
          <TextInput label="Education Institute" value={formValue.education_institute} onChange={value => setField('education_institute', value)} />
          <TextInput label="Education Year" type="number" value={formValue.education_year} onChange={value => setField('education_year', value)} />
        </div>
      ) : (
        <div className="row">
          <DetailCell label="Full Name" value={profile.full_name} />
          <DetailCell label="Email" value={profile.email} />
          <DetailCell label="Mobile" value={profile.mobile} />
          <DetailCell label="CNIC" value={profile.cnic} />
          <DetailCell label="Roles" value={formatRoles(profile.roles)} />
          <DetailCell label="Status" value={profile.status} />
          <DetailCell label="City" value={profile.city?.name} />
          <DetailCell label="Field Organisation" value={profile.field_organisation} />
          <DetailCell label="Employee ID" value={profile.employee_id} />
          <DetailCell label="Emergency Contact" value={profile.emergency_contact_name} />
          <DetailCell label="Emergency Phone" value={profile.emergency_contact_phone} />
          <DetailCell label="Education Degree" value={profile.education_degree} />
          <DetailCell label="Education Institute" value={profile.education_institute} />
          <DetailCell label="Education Year" value={profile.education_year} />
        </div>
      )}
    </EditableCard>
  );
};

BaseProfilePanel.propTypes = {
  profile: profileShape.isRequired,
  onProfileUpdated: PropTypes.func.isRequired,
};

const TraineeProfilePanel = ({
  profile, traineeProfile, batches, onProfileUpdated,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [formValue, setFormValue] = useState(() => toTraineeForm(traineeProfile));

  useEffect(() => {
    setFormValue(toTraineeForm(traineeProfile));
  }, [traineeProfile]);

  const setField = (field, value) => {
    setFormValue(previous => ({ ...previous, [field]: value }));
    setError('');
  };

  const handleCancel = () => {
    setFormValue(toTraineeForm(traineeProfile));
    setIsEditing(false);
    setError('');
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      const payload = {
        trainee_profile: {
          trainee_type: formValue.trainee_type,
          batch: formValue.trainee_type === 'stp' && formValue.batch ? Number(formValue.batch) : null,
          date_of_birth: normalizeValue(formValue.date_of_birth) || null,
          designation: normalizeValue(formValue.designation) || '',
          bps_grade: formValue.bps_grade ? Number(formValue.bps_grade) : null,
          service_history: normalizeValue(formValue.service_history) || '',
          hostel_preference: normalizeValue(formValue.hostel_preference) || '',
          languages_awards_publications: normalizeValue(formValue.languages_awards_publications) || '',
        },
      };
      const { data } = await getAuthenticatedHttpClient().patch(USER_DETAIL_PATH(profile.id), payload);
      onProfileUpdated(data);
      setIsEditing(false);
    } catch (saveError) {
      setError(saveError?.response?.data?.detail || 'Unable to update your trainee profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <EditableCard
      title="Your Trainee Profile"
      helperText="Training programme details."
      isEditing={isEditing}
      onEdit={() => setIsEditing(true)}
      onCancel={handleCancel}
      onSave={handleSave}
      isSaving={isSaving}
      error={error}
    >
      {isEditing ? (
        <div className="row">
          <Form.Group className="col-md-6 col-lg-4 mb-4">
            <Form.Label>Trainee Type</Form.Label>
            <Form.Control as="select" value={formValue.trainee_type} onChange={event => setField('trainee_type', event.target.value)}>
              <option value="stp">STP</option>
              <option value="dst_ist">DST / IST</option>
            </Form.Control>
          </Form.Group>
          {formValue.trainee_type === 'stp' && (
            <Form.Group className="col-md-6 col-lg-4 mb-4">
              <Form.Label>Batch</Form.Label>
              <Form.Control as="select" value={formValue.batch || ''} onChange={event => setField('batch', event.target.value)}>
                <option value="">Select batch</option>
                {batches.map(batch => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
              </Form.Control>
            </Form.Group>
          )}
          <TextInput label="Date of Birth" type="date" value={formValue.date_of_birth} onChange={value => setField('date_of_birth', value)} />
          <TextInput label="Designation" value={formValue.designation} onChange={value => setField('designation', value)} />
          <TextInput label="BPS Grade" type="number" value={formValue.bps_grade} onChange={value => setField('bps_grade', value)} />
          <TextInput label="Hostel Preference" value={formValue.hostel_preference} onChange={value => setField('hostel_preference', value)} />
          <TextInput label="Service History" as="textarea" value={formValue.service_history} onChange={value => setField('service_history', value)} />
          <TextInput label="Languages, Awards, Publications" as="textarea" value={formValue.languages_awards_publications} onChange={value => setField('languages_awards_publications', value)} />
        </div>
      ) : (
        <div className="row">
          <DetailCell label="Trainee Type" value={TRAINEE_TYPE_LABELS[traineeProfile.trainee_type] || traineeProfile.trainee_type} />
          <DetailCell label="Batch" value={traineeProfile.batch?.name} />
          <DetailCell label="Date of Birth" value={traineeProfile.date_of_birth} />
          <DetailCell label="Designation" value={traineeProfile.designation} />
          <DetailCell label="BPS Grade" value={traineeProfile.bps_grade} />
          <DetailCell label="Hostel Preference" value={traineeProfile.hostel_preference} />
          <DetailCell label="Service History" value={traineeProfile.service_history} />
          <DetailCell label="Languages, Awards, Publications" value={traineeProfile.languages_awards_publications} />
        </div>
      )}
    </EditableCard>
  );
};

TraineeProfilePanel.propTypes = {
  profile: profileShape.isRequired,
  traineeProfile: traineeProfileShape.isRequired,
  batches: PropTypes.arrayOf(batchShape).isRequired,
  onProfileUpdated: PropTypes.func.isRequired,
};

const InstructorProfilePanel = ({
  profile, instructorProfile, onProfileUpdated,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [formValue, setFormValue] = useState(() => toInstructorForm(instructorProfile));

  useEffect(() => {
    setFormValue(toInstructorForm(instructorProfile));
  }, [instructorProfile]);

  const setField = (field, value) => {
    setFormValue(previous => ({ ...previous, [field]: value }));
    setError('');
  };

  const handleCancel = () => {
    setFormValue(toInstructorForm(instructorProfile));
    setIsEditing(false);
    setError('');
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      const payload = {
        instructor_profile: {
          field_of_expertise: normalizeValue(formValue.field_of_expertise) || '',
          languages_awards_publications: normalizeValue(formValue.languages_awards_publications) || '',
        },
      };
      const { data } = await getAuthenticatedHttpClient().patch(USER_DETAIL_PATH(profile.id), payload);
      onProfileUpdated(data);
      setIsEditing(false);
    } catch (saveError) {
      setError(saveError?.response?.data?.detail || 'Unable to update your instructor profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <EditableCard
      title="Your Instructor Profile"
      helperText="Instructor-specific details."
      isEditing={isEditing}
      onEdit={() => setIsEditing(true)}
      onCancel={handleCancel}
      onSave={handleSave}
      isSaving={isSaving}
      error={error}
    >
      {isEditing ? (
        <div className="row">
          <TextInput label="Field of Expertise" value={formValue.field_of_expertise} onChange={value => setField('field_of_expertise', value)} />
          <TextInput label="Languages, Awards, Publications" as="textarea" value={formValue.languages_awards_publications} onChange={value => setField('languages_awards_publications', value)} />
        </div>
      ) : (
        <div className="row">
          <DetailCell label="Field of Expertise" value={instructorProfile.field_of_expertise} />
          <DetailCell label="Languages, Awards, Publications" value={instructorProfile.languages_awards_publications} />
        </div>
      )}
    </EditableCard>
  );
};

InstructorProfilePanel.propTypes = {
  profile: profileShape.isRequired,
  instructorProfile: instructorProfileShape.isRequired,
  onProfileUpdated: PropTypes.func.isRequired,
};

const formatDateTime = value => (value ? new Date(value).toLocaleString() : '—');

const RequestStatusBadge = ({ status }) => {
  const isPending = status === 'pending';
  return (
    <span className={`badge ${isPending ? 'badge-warning' : 'badge-success'}`}>
      {isPending ? 'Pending' : 'Resolved'}
    </span>
  );
};

RequestStatusBadge.propTypes = {
  status: PropTypes.string.isRequired,
};

const EditRequestPanel = () => {
  const [latestRequest, setLatestRequest] = useState(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadLatestRequest = async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data } = await getAuthenticatedHttpClient().get(EDIT_REQUEST_MY_PATH());
      setLatestRequest(data);
    } catch (requestError) {
      if (requestError?.response?.status === 404) {
        setLatestRequest(null);
      } else {
        setError(getApiErrorMessage(requestError, 'Unable to load your latest edit request.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLatestRequest();
  }, []);

  const isPending = latestRequest?.status === 'pending';

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setError('Please describe what needs to be changed.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccessMessage('');
    try {
      const { data } = await getAuthenticatedHttpClient().post(
        EDIT_REQUEST_CREATE_PATH(),
        { message: trimmedMessage },
      );
      setLatestRequest(data);
      setMessage('');
      setSuccessMessage('Your edit request has been submitted.');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to submit your edit request.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <Card.Section>
        <div className="d-flex flex-wrap justify-content-between align-items-start mb-4">
          <div>
            <h2 className="h3 mb-1">Edit Request</h2>
            <div className="small text-muted">Ask an administrator to reopen or update locked biodata details.</div>
          </div>
          <Button variant="outline-secondary" onClick={loadLatestRequest} disabled={isLoading || isSubmitting}>
            Refresh
          </Button>
        </div>

        {error && (
          <Alert variant="danger" dismissible={false} show>
            {Array.isArray(error) ? error.join(' ') : error}
          </Alert>
        )}
        {successMessage && (
          <Alert variant="success" dismissible={false} show>
            {successMessage}
          </Alert>
        )}
        {(() => {
          if (isLoading) {
            return <div className="text-muted">Loading request...</div>;
          }

          if (latestRequest) {
            return (
              <div className="mb-4">
                <div className="d-flex flex-wrap align-items-center mb-3" style={{ gap: '0.5rem' }}>
                  <RequestStatusBadge status={latestRequest.status} />
                  <span className="small text-muted">Submitted {formatDateTime(latestRequest.created_at)}</span>
                </div>
                <div className="row">
                  <DetailCell label="Your Message" value={latestRequest.message} />
                  <DetailCell label="Admin Note" value={latestRequest.admin_note} />
                  <DetailCell label="Resolved By" value={latestRequest.resolved_by_name} />
                  <DetailCell label="Resolved At" value={formatDateTime(latestRequest.resolved_at)} />
                </div>
              </div>
            );
          }

          return <div className="text-muted mb-4">You have not submitted an edit request yet.</div>;
        })()}

        {isPending ? (
          <Alert variant="warning" dismissible={false} show>
            You already have a pending edit request. Please wait for an administrator to
            resolve it before submitting another one.
          </Alert>
        ) : (
          <Form onSubmit={handleSubmit}>
            <Form.Group>
              <Form.Label>What needs to be changed?</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                value={message}
                placeholder="Describe the biodata details that need correction."
                onChange={event => {
                  setMessage(event.target.value);
                  setError('');
                  setSuccessMessage('');
                }}
              />
            </Form.Group>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </Form>
        )}
      </Card.Section>
    </Card>
  );
};

const FbrProfileTabs = ({
  profile, showStpBiodataForm, requiresStpBiodataCompletion, onProfileUpdated,
}) => {
  const [batches, setBatches] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const loadBatches = async () => {
      if (!profile?.trainee_profile) {
        return;
      }
      try {
        const { data } = await getAuthenticatedHttpClient().get(BATCHES_PATH());
        if (isMounted) { setBatches(Array.isArray(data) ? data : []); }
      } catch (error) {
        if (isMounted) { setBatches([]); }
      }
    };

    loadBatches();
    return () => { isMounted = false; };
  }, [profile?.trainee_profile]);

  const tabs = useMemo(() => {
    const nextTabs = [{ id: 'profile', label: 'Your Profile' }];
    if (profile?.trainee_profile) {
      nextTabs.push({ id: 'trainee', label: 'Your Trainee Profile' });
    }
    if (profile?.instructor_profile) {
      nextTabs.push({ id: 'instructor', label: 'Your Instructor Profile' });
    }
    if (showStpBiodataForm) {
      nextTabs.push({ id: 'stp-biodata', label: 'STP Biodata Form' });
    }
    nextTabs.push({ id: 'edit-request', label: 'Edit Request' });
    return nextTabs;
  }, [profile, showStpBiodataForm]);

  const [activeTab, setActiveTab] = useState(tabs[0]?.id || 'profile');
  const safeActiveTab = tabs.some(tab => tab.id === activeTab) ? activeTab : tabs[0]?.id;

  const hasAutoSelectedStpTabRef = useRef(false);
  useEffect(() => {
    if (
      showStpBiodataForm
      && requiresStpBiodataCompletion
      && !hasAutoSelectedStpTabRef.current
    ) {
      hasAutoSelectedStpTabRef.current = true;
      setActiveTab('stp-biodata');
    }
  }, [showStpBiodataForm, requiresStpBiodataCompletion]);

  if (!profile) {
    return null;
  }

  return (
    <div>
      <Nav variant="tabs" className="mb-4">
        {tabs.map(tab => (
          <Nav.Item key={tab.id}>
            <Nav.Link active={safeActiveTab === tab.id} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </Nav.Link>
          </Nav.Item>
        ))}
      </Nav>

      {safeActiveTab === 'profile' && (
        <BaseProfilePanel profile={profile} onProfileUpdated={onProfileUpdated} />
      )}
      {safeActiveTab === 'trainee' && profile.trainee_profile && (
        <TraineeProfilePanel
          profile={profile}
          traineeProfile={profile.trainee_profile}
          batches={batches}
          onProfileUpdated={onProfileUpdated}
        />
      )}
      {safeActiveTab === 'instructor' && profile.instructor_profile && (
        <InstructorProfilePanel
          profile={profile}
          instructorProfile={profile.instructor_profile}
          onProfileUpdated={onProfileUpdated}
        />
      )}
      {safeActiveTab === 'stp-biodata' && showStpBiodataForm && <BiodataProfileSections />}
      {safeActiveTab === 'edit-request' && <EditRequestPanel />}
    </div>
  );
};

FbrProfileTabs.propTypes = {
  profile: profileShape,
  showStpBiodataForm: PropTypes.bool,
  requiresStpBiodataCompletion: PropTypes.bool,
  onProfileUpdated: PropTypes.func,
};

FbrProfileTabs.defaultProps = {
  profile: null,
  showStpBiodataForm: false,
  requiresStpBiodataCompletion: false,
  onProfileUpdated: () => {},
};

export default FbrProfileTabs;
