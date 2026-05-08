import React, {
  useEffect, useState, useContext, useCallback, useRef,
} from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { sendTrackingLogEvent } from '@edx/frontend-platform/analytics';
import { ensureConfig } from '@edx/frontend-platform';
import { AppContext } from '@edx/frontend-platform/react';
import { useIntl } from '@edx/frontend-platform/i18n';
import { Alert, Hyperlink } from '@openedx/paragon';
import classNames from 'classnames';

import {
  fetchProfile,
  saveProfilePhoto,
  deleteProfilePhoto,
} from './data/actions';

import ProfileAvatar from './forms/ProfileAvatar';
import DateJoined from './DateJoined';
import UserCertificateSummary from './UserCertificateSummary';
import PageLoading from './PageLoading';
import Certificates from './Certificates';
import OutsideHrmsInstructorForm from './forms/outside-hrms/OutsideHrmsInstructorForm';

import { profilePageSelector } from './data/selectors';
import messages from './ProfilePage.messages';
import withParams from '../utils/hoc';
import { useIsOnMobileScreen, useIsOnTabletScreen } from './data/hooks';

import BiodataProfileSections from './biodata/BiodataProfileSections';

ensureConfig(['CREDENTIALS_BASE_URL', 'LMS_BASE_URL', 'ACCOUNT_SETTINGS_URL'], 'ProfilePage');

const IGNORED_LINK_PROTOCOLS = ['mailto:', 'tel:', 'java'.concat('script:')];
const LOGOUT_PATH_PATTERN = /(^|\/)(logout|signout|sign-out)(\/|$)/i;

function isLogoutNavigation(targetUrl, config = {}) {
  const configuredLogoutUrl = config.LOGOUT_URL;

  if (configuredLogoutUrl) {
    const logoutUrl = new URL(configuredLogoutUrl, window.location.href);
    if (targetUrl.origin === logoutUrl.origin && targetUrl.pathname === logoutUrl.pathname) {
      return true;
    }
  }

  return LOGOUT_PATH_PATTERN.test(targetUrl.pathname);
}

const ProfilePage = ({ params }) => {
  const dispatch = useDispatch();
  const intl = useIntl();
  const context = useContext(AppContext);
  const {
    dateJoined,
    courseCertificates,
    profileImage,
    savePhotoState,
    isLoadingProfile,
    photoUploadError,
    saveState,
    username,
    profileCompletionStatus,
  } = useSelector(profilePageSelector);

  const navigate = useNavigate();
  const [viewMyRecordsUrl, setViewMyRecordsUrl] = useState(null);
  const [completionOverride, setCompletionOverride] = useState(false);
  const [navigationBlocked, setNavigationBlocked] = useState(false);
  const allowRequiredProfileLogoutRef = useRef(false);
  const isMobileView = useIsOnMobileScreen();
  const isTabletView = useIsOnTabletScreen();

  useEffect(() => {
    const { CREDENTIALS_BASE_URL } = context.config;
    if (CREDENTIALS_BASE_URL) {
      setViewMyRecordsUrl(`${CREDENTIALS_BASE_URL}/records`);
    }

    dispatch(fetchProfile(params.username));
    sendTrackingLogEvent('edx.profile.viewed', {
      username: params.username,
    });
  }, [dispatch, params.username, context.config]);

  useEffect(() => {
    if (!username && saveState === 'error' && navigate) {
      navigate('/notfound');
    }
  }, [username, saveState, navigate]);

  const authenticatedUserName = context.authenticatedUser.username;

  const handleSaveProfilePhoto = useCallback((formData) => {
    dispatch(saveProfilePhoto(authenticatedUserName, formData));
  }, [dispatch, authenticatedUserName]);

  const handleDeleteProfilePhoto = useCallback(() => {
    dispatch(deleteProfilePhoto(authenticatedUserName));
  }, [dispatch, authenticatedUserName]);

  const isAuthenticatedUserProfile = () => params.username === authenticatedUserName;
  // const shouldShowOutsideHrmsForm = isAuthenticatedUserProfile()
  //   && Boolean(context.authenticatedUser.administrator);
  const isRequiredProfileGuardDisabled = true;
  const hasCompletedRequiredProfile = completionOverride
    || Boolean(profileCompletionStatus?.complete);
  const shouldBlockNavigation = !isRequiredProfileGuardDisabled
    && isAuthenticatedUserProfile()
    && Boolean(profileCompletionStatus?.required)
    && !hasCompletedRequiredProfile;

  useEffect(() => {
    if (!shouldBlockNavigation) {
      return undefined;
    }

    const handleClick = (event) => {
      const link = event.target.closest?.('a[href]');
      if (!link) {
        return;
      }

      const href = link.getAttribute('href');
      if (!href) {
        return;
      }

      const normalizedHref = href.toLowerCase();
      if (href.startsWith('#') || IGNORED_LINK_PROTOCOLS.some(protocol => normalizedHref.startsWith(protocol))) {
        return;
      }

      const targetUrl = new URL(href, window.location.href);
      if (isLogoutNavigation(targetUrl, context.config)) {
        allowRequiredProfileLogoutRef.current = true;
        return;
      }

      const allowedProfileUrl = new URL(
        profileCompletionStatus?.profileUrl || window.location.href,
        window.location.href,
      );
      const isCurrentProfileRoute = targetUrl.origin === window.location.origin
        && targetUrl.pathname === window.location.pathname;
      const isRequiredProfileRoute = targetUrl.href === allowedProfileUrl.href
        || targetUrl.pathname === allowedProfileUrl.pathname;

      if (!isCurrentProfileRoute && !isRequiredProfileRoute) {
        event.preventDefault();
        event.stopPropagation();
        setNavigationBlocked(true);
      }
    };

    const handleBeforeUnload = (event) => {
      if (allowRequiredProfileLogoutRef.current) {
        return undefined;
      }

      event.preventDefault();
      // Browser beforeunload prompts still require assigning returnValue.
      // eslint-disable-next-line no-param-reassign
      event.returnValue = '';
      return '';
    };

    document.addEventListener('click', handleClick, true);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [context.config, profileCompletionStatus, shouldBlockNavigation]);

  const isBlockVisible = (blockInfo) => isAuthenticatedUserProfile()
      || (!isAuthenticatedUserProfile() && Boolean(blockInfo));

  const renderViewMyRecordsButton = () => {
    if (!(viewMyRecordsUrl && isAuthenticatedUserProfile())) {
      return null;
    }

    return (
      <Hyperlink
        className={classNames(
          'btn btn-brand bg-brand-500 font-weight-normal px-4 py-10px text-nowrap',
          { 'w-100': isMobileView },
        )}
        target="_blank"
        showLaunchIcon={false}
        destination={viewMyRecordsUrl}
      >
        {intl.formatMessage(messages['profile.viewMyRecords'])}
      </Hyperlink>
    );
  };

  const renderPhotoUploadErrorMessage = () => (
    photoUploadError && (
      <div className="row">
        <div className="col-md-4 col-lg-3">
          <Alert variant="danger" dismissible={false} show>
            {photoUploadError.userMessage}
          </Alert>
        </div>
      </div>
    )
  );

  return (
    <div className="profile-page">
      {isLoadingProfile ? (
        <PageLoading srMessage={intl.formatMessage(messages['profile.loading'])} />
      ) : (
        <>
          <div
            className={classNames(
              'profile-page-bg-banner bg-primary d-md-block align-items-center h-100 w-100',
              { 'px-3 py-4': isMobileView },
              { 'px-120px py-5.5': !isMobileView },
            )}
          >
            <div
              className={classNames([
                'col container-fluid w-100 h-100 bg-white py-0 rounded-75',
                {
                  'px-3': isMobileView,
                  'px-40px': !isMobileView,
                },
              ])}
            >
              <div
                className={classNames([
                  'col h-100 w-100 px-0 justify-content-start g-15rem',
                  {
                    'py-4': isMobileView,
                    'py-36px': !isMobileView,
                  },
                ])}
              >
                <div
                  className={classNames([
                    'row-auto d-flex flex-wrap align-items-center h-100 w-100 justify-content-start g-15rem',
                    isMobileView || isTabletView ? 'flex-column' : 'flex-row',
                  ])}
                >
                  <ProfileAvatar
                    className="col p-0"
                    src={profileImage.src}
                    isDefault={profileImage.isDefault}
                    onSave={handleSaveProfilePhoto}
                    onDelete={handleDeleteProfilePhoto}
                    savePhotoState={savePhotoState}
                    isEditable={isAuthenticatedUserProfile()}
                  />
                  <div
                    className={classNames([
                      'col h-100 w-100 m-0 p-0',
                      isMobileView || isTabletView
                        ? 'd-flex flex-column justify-content-center align-items-center'
                        : 'justify-content-start align-items-start',
                    ])}
                  >
                    <p className="row m-0 font-weight-bold text-truncate text-primary-500 h3">
                      {params.username}
                    </p>
                    <div className={classNames(
                      'row pt-2 m-0',
                      isMobileView
                        ? 'd-flex justify-content-center align-items-center flex-column'
                        : 'g-1rem',
                    )}
                    >
                      <DateJoined date={dateJoined} />
                      <UserCertificateSummary count={courseCertificates?.length || 0} />
                    </div>
                  </div>
                  <div className={classNames([
                    'p-0 ',
                    isMobileView || isTabletView ? 'col d-flex justify-content-center' : 'col-auto',
                  ])}
                  >
                    {renderViewMyRecordsButton()}
                  </div>
                </div>
              </div>
              <div className="ml-auto">
                {renderPhotoUploadErrorMessage()}
              </div>
            </div>
          </div>
          {navigationBlocked && (
            <div className={classNames(isMobileView ? 'px-3 pt-4' : 'px-120px pt-4')}>
              <Alert variant="warning" dismissible onClose={() => setNavigationBlocked(false)} show>
                Complete and save your required profile form before opening another page.
              </Alert>
            </div>
          )}
          <div
            className={classNames([
              'col d-inline-flex h-100 w-100 align-items-start justify-content-start g-3rem',
              isMobileView ? 'py-4 px-3' : 'px-120px py-6',
            ])}
          >
            <div className="w-100 p-0">
              {/* {shouldShowOutsideHrmsForm ? (
                <OutsideHrmsInstructorForm
                  username={authenticatedUserName}
                  onComplete={() => {
                    setCompletionOverride(true);
                    setNavigationBlocked(false);
                  }}
                />
              ) : null} */}
              <BiodataProfileSections />
            </div>
          </div>
          <div
            className={classNames([
              'col container-fluid d-inline-flex bg-color-grey-FBFAF9 h-100 w-100 align-items-start justify-content-start g-3rem',
              isMobileView ? 'py-4 px-3' : 'px-120px py-6',
            ])}
          >
            {isBlockVisible((courseCertificates || []).length) && (
            <Certificates
              certificates={courseCertificates || []}
              formId="certificates"
            />
            )}
          </div>
        </>
      )}
    </div>
  );
};

ProfilePage.propTypes = {
  params: PropTypes.shape({
    username: PropTypes.string.isRequired,
  }).isRequired,
};

export default withParams(ProfilePage);
