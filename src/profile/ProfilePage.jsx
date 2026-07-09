import React, {
  useEffect, useState, useContext, useCallback, useRef,
} from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { sendTrackingLogEvent } from '@edx/frontend-platform/analytics';
import { ensureConfig } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
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

import { profilePageSelector } from './data/selectors';
import messages from './ProfilePage.messages';
import withParams from '../utils/hoc';
import { useIsOnMobileScreen, useIsOnTabletScreen } from './data/hooks';

import BiodataProfileSections from './biodata/BiodataProfileSections';
import FbrProfileTabs from './fbr-profile/FbrProfileTabs';
import { getBiodataEndpointUrl, getBiodataTargetUserId } from './biodata/apiConfig';

ensureConfig(['CREDENTIALS_BASE_URL', 'LMS_BASE_URL', 'ACCOUNT_SETTINGS_URL'], 'ProfilePage');

const IGNORED_LINK_PROTOCOLS = ['mailto:', 'tel:', 'java'.concat('script:')];
const LOGOUT_PATH_PATTERN = /(^|\/)(logout|signout|sign-out)(\/|$)/i;
const FBR_PROFILE_ME_PATH = 'v1/users/me/';

function getFbrProfileDetailPath(profileId) {
  return `v1/users/${profileId}/`;
}

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
  const [fbrProfile, setFbrProfile] = useState(null);
  const [fbrProfileLoaded, setFbrProfileLoaded] = useState(false);
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

  const authenticatedUserName = context.authenticatedUser.username;
  const isAdministrator = Boolean(context.authenticatedUser?.administrator);
  const biodataTargetUserId = getBiodataTargetUserId();
  const isTargetUserBiodataView = Boolean(biodataTargetUserId);

  useEffect(() => {
    if (!username && saveState === 'error' && navigate && !isTargetUserBiodataView) {
      navigate('/notfound');
    }
  }, [username, saveState, navigate, isTargetUserBiodataView]);

  const isOwnProfileView = params.username === authenticatedUserName && !isTargetUserBiodataView;
  const profileHeaderUsername = isTargetUserBiodataView
    ? fbrProfile?.username || params.username
    : params.username;

  const handleSaveProfilePhoto = useCallback((formData) => {
    dispatch(saveProfilePhoto(authenticatedUserName, formData));
  }, [dispatch, authenticatedUserName]);

  const handleDeleteProfilePhoto = useCallback(() => {
    dispatch(deleteProfilePhoto(authenticatedUserName));
  }, [dispatch, authenticatedUserName]);

  const isStpTrainee = fbrProfile?.trainee_profile?.trainee_type === 'stp';

  useEffect(() => {
    let isMounted = true;

    const loadFbrProfile = async () => {
      if (biodataTargetUserId) {
        setFbrProfileLoaded(false);
        try {
          const { data } = await getAuthenticatedHttpClient().get(
            getBiodataEndpointUrl(getFbrProfileDetailPath(biodataTargetUserId)),
          );
          if (!isMounted) { return; }
          setFbrProfile(data);
        } catch (error) {
          if (!isMounted) { return; }
          setFbrProfile(null);
        } finally {
          if (isMounted) { setFbrProfileLoaded(true); }
        }
        return;
      }

      if (!isOwnProfileView) {
        setFbrProfile(null);
        setFbrProfileLoaded(true);
        return;
      }

      setFbrProfileLoaded(false);
      try {
        const { data: scopeData } = await getAuthenticatedHttpClient().get(
          getBiodataEndpointUrl(FBR_PROFILE_ME_PATH),
        );
        if (!scopeData?.id) {
          throw new Error('FBR profile id missing from scope response.');
        }
        const { data } = await getAuthenticatedHttpClient().get(
          getBiodataEndpointUrl(getFbrProfileDetailPath(scopeData.id)),
        );
        if (!isMounted) { return; }
        setFbrProfile(data);
      } catch (error) {
        if (!isMounted) { return; }
        setFbrProfile(null);
      } finally {
        if (isMounted) { setFbrProfileLoaded(true); }
      }
    };

    loadFbrProfile();
    return () => { isMounted = false; };
  }, [authenticatedUserName, biodataTargetUserId, isOwnProfileView, params.username]);

  const hasCompletedRequiredProfile = completionOverride
    || Boolean(profileCompletionStatus?.complete);
  const shouldBlockNavigation = isStpTrainee
    && isOwnProfileView
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

  const isBlockVisible = (blockInfo) => isOwnProfileView
      || (!isOwnProfileView && Boolean(blockInfo));
  const shouldShowAdminBiodataFallback = isOwnProfileView && isAdministrator && !fbrProfile;
  const profileContent = (() => {
    if (isTargetUserBiodataView || shouldShowAdminBiodataFallback) {
      return <BiodataProfileSections />;
    }

    if (isOwnProfileView) {
      return (
        <FbrProfileTabs
          profile={fbrProfile}
          showStpBiodataForm={isStpTrainee}
          requiresStpBiodataCompletion={shouldBlockNavigation}
          onProfileUpdated={setFbrProfile}
          onStpBiodataComplete={() => {
            setCompletionOverride(true);
            setNavigationBlocked(false);
          }}
        />
      );
    }

    return <BiodataProfileSections />;
  })();

  const renderViewMyRecordsButton = () => {
    if (!(viewMyRecordsUrl && isOwnProfileView)) {
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
      {isLoadingProfile || !fbrProfileLoaded ? (
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
                    isEditable={isOwnProfileView}
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
                      {profileHeaderUsername}
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
              {profileContent}
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
    username: PropTypes.string,
  }).isRequired,
};

export default withParams(ProfilePage);
