import { getConfig, setConfig } from '@edx/frontend-platform';
import * as analytics from '@edx/frontend-platform/analytics';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { AppContext } from '@edx/frontend-platform/react';
import { configure as configureI18n, IntlProvider } from '@edx/frontend-platform/i18n';
import {
  fireEvent, render, screen, waitFor,
} from '@testing-library/react';
import React from 'react';
import PropTypes from 'prop-types';
import { Provider } from 'react-redux';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import {
  MemoryRouter,
  Routes,
  Route,
  useNavigate,
} from 'react-router-dom';

import messages from '../i18n';
import ProfilePage from './ProfilePage';
import loadingApp from './__mocks__/loadingApp.mockStore';
import viewOwnProfile from './__mocks__/viewOwnProfile.mockStore';
import viewOtherProfile from './__mocks__/viewOtherProfile.mockStore';
import invalidUser from './__mocks__/invalidUser.mockStore';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn(),
}));

const mockStore = configureMockStore([thunk]);

const storeMocks = {
  loadingApp,
  viewOwnProfile,
  viewOtherProfile,
  invalidUser,
};

const requiredProfilePageProps = {
  params: { username: 'staff' },
};

const baseTestConfig = {
  ...getConfig(),
  CREDENTIALS_BASE_URL: 'http://localhost:18150',
  LMS_BASE_URL: 'http://localhost:18000',
  ACCOUNT_SETTINGS_URL: 'http://localhost:18000/account/settings',
  LANGUAGE_PREFERENCE_COOKIE_NAME: 'yum',
  DISCOVERY_API_BASE_URL: 'http://localhost:18381',
  PUBLISHER_BASE_URL: 'http://localhost:18110',
  IGNORED_ERROR_REGEX: '^IgnoredError',
  LEARNING_BASE_URL: 'http://localhost:18010',
  STUDIO_BASE_URL: 'http://localhost:18001',
  SUPPORT_URL: 'http://localhost:18000/support',
};

Object.defineProperty(global.document, 'cookie', {
  writable: true,
  value: `${baseTestConfig.LANGUAGE_PREFERENCE_COOKIE_NAME}=en`,
});

jest.mock('@edx/frontend-platform/auth', () => ({
  configure: () => {},
  getAuthenticatedUser: () => null,
  fetchAuthenticatedUser: () => null,
  getAuthenticatedHttpClient: jest.fn(),
  AUTHENTICATED_USER_CHANGED: 'user_changed',
}));

jest.mock('@edx/frontend-platform/analytics', () => ({
  configure: () => {},
  identifyAnonymousUser: jest.fn(),
  identifyAuthenticatedUser: jest.fn(),
  sendTrackingLogEvent: jest.fn(),
}));

configureI18n({
  loggingService: { logError: jest.fn() },
  config: {
    ENVIRONMENT: 'production',
    LANGUAGE_PREFERENCE_COOKIE_NAME: baseTestConfig.LANGUAGE_PREFERENCE_COOKIE_NAME,
  },
  messages,
});

beforeEach(() => {
  setConfig(baseTestConfig);
  analytics.sendTrackingLogEvent.mockReset();
  useNavigate.mockReset();
  getAuthenticatedHttpClient.mockReset();
});

const ProfilePageWrapper = ({
  contextValue, store, params, initialEntry,
}) => (
  <AppContext.Provider value={contextValue}>
    <IntlProvider locale="en">
      <Provider store={store}>
        <MemoryRouter initialEntries={[initialEntry || `/profile/${params.username}`]}>
          <Routes>
            <Route
              path="/profile/:username"
              element={<ProfilePage {...requiredProfilePageProps} params={params} />}
            />
          </Routes>
        </MemoryRouter>
      </Provider>
    </IntlProvider>
  </AppContext.Provider>
);

ProfilePageWrapper.defaultProps = {
  // eslint-disable-next-line react/default-props-match-prop-types
  params: { username: 'staff' },
  initialEntry: '',
};

ProfilePageWrapper.propTypes = {
  contextValue: PropTypes.shape({}).isRequired,
  store: PropTypes.shape({}).isRequired,
  initialEntry: PropTypes.string,
  params: PropTypes.shape({
    username: PropTypes.string.isRequired,
  }).isRequired,
};

describe('<ProfilePage />', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/profile/staff');
  });

  describe('Renders correctly in various states', () => {
    it('app loading', async () => {
      const contextValue = {
        authenticatedUser: { userId: null, username: null, administrator: false },
        config: baseTestConfig,
      };
      const component = (
        <ProfilePageWrapper
          contextValue={contextValue}
          store={mockStore(storeMocks.loadingApp)}
        />
      );
      const { container: tree } = render(component);

      await waitFor(() => {
        expect(screen.getByText('Profile loading...')).toBeInTheDocument();
      });

      expect(tree).toMatchSnapshot();
    });

    it('viewing own profile', async () => {
      const contextValue = {
        authenticatedUser: { userId: 123, username: 'staff', administrator: true },
        config: baseTestConfig,
      };
      const component = (
        <ProfilePageWrapper
          contextValue={contextValue}
          store={mockStore(storeMocks.viewOwnProfile)}
        />
      );
      const { container: tree } = render(component);

      await waitFor(() => {
        expect(screen.getAllByText('Basic Information').length).toBeGreaterThan(0);
      });

      expect(tree).toMatchSnapshot();
    });

    it('viewing other profile with all fields', async () => {
      const contextValue = {
        authenticatedUser: { userId: 123, username: 'staff', administrator: true },
        config: baseTestConfig,
      };
      const component = (
        <ProfilePageWrapper
          contextValue={contextValue}
          store={mockStore({
            ...storeMocks.viewOtherProfile,
            profilePage: {
              ...storeMocks.viewOtherProfile.profilePage,
              account: {
                ...storeMocks.viewOtherProfile.profilePage.account,
                name: 'Verified User',
                country: 'US',
                bio: 'About me',
                courseCertificates: [{ title: 'Course 1' }],
                levelOfEducation: 'bachelors',
                languageProficiencies: [{ code: 'en' }],
                socialLinks: [{ platform: 'twitter', socialLink: 'https://twitter.com/user' }],
              },
              preferences: {
                ...storeMocks.viewOtherProfile.profilePage.preferences,
                visibilityName: 'all_users',
                visibilityCountry: 'all_users',
                visibilityLevelOfEducation: 'all_users',
                visibilityLanguageProficiencies: 'all_users',
                visibilitySocialLinks: 'all_users',
                visibilityBio: 'all_users',
              },
            },
          })}
          params={{ username: 'verified' }}
        />
      );
      const { container: tree } = render(component);

      await waitFor(() => {
        expect(screen.getByText('verified')).toBeInTheDocument();
      });

      expect(tree).toMatchSnapshot();
    });

    it('without credentials service', async () => {
      const config = { ...baseTestConfig, CREDENTIALS_BASE_URL: '' };

      const contextValue = {
        authenticatedUser: { userId: 123, username: 'staff', administrator: true },
        config,
      };
      const component = (
        <ProfilePageWrapper
          contextValue={contextValue}
          store={mockStore(storeMocks.viewOwnProfile)}
        />
      );
      const { container: tree } = render(component);

      await waitFor(() => {
        expect(screen.getAllByText('Basic Information').length).toBeGreaterThan(0);
      });

      expect(tree).toMatchSnapshot();
    });

    it('successfully redirected to not found page', async () => {
      const contextValue = {
        authenticatedUser: { userId: 123, username: 'staff', administrator: true },
        config: baseTestConfig,
      };
      const navigate = jest.fn();
      useNavigate.mockReturnValue(navigate);
      const component = (
        <ProfilePageWrapper
          contextValue={contextValue}
          store={mockStore(storeMocks.invalidUser)}
          params={{ username: 'staffTest' }}
        />
      );
      const { container: tree } = render(component);

      await waitFor(() => {
        expect(navigate).toHaveBeenCalledWith('/notfound');
      });

      expect(tree).toMatchSnapshot();
    });
  });

  describe('handles analytics', () => {
    it('calls sendTrackingLogEvent when mounting', () => {
      const contextValue = {
        authenticatedUser: { userId: 123, username: 'staff', administrator: true },
        config: baseTestConfig,
      };
      render(
        <ProfilePageWrapper
          contextValue={contextValue}
          store={mockStore(storeMocks.loadingApp)}
          params={{ username: 'test-username' }}
        />,
      );

      expect(analytics.sendTrackingLogEvent).toHaveBeenCalledTimes(1);
      expect(analytics.sendTrackingLogEvent).toHaveBeenCalledWith('edx.profile.viewed', {
        username: 'test-username',
      });
    });
  });

  describe('handles navigation', () => {
    it('navigates to notfound on save error with no username', () => {
      const contextValue = {
        authenticatedUser: { userId: 123, username: 'staff', administrator: true },
        config: baseTestConfig,
      };
      const navigate = jest.fn();
      useNavigate.mockReturnValue(navigate);
      render(
        <ProfilePageWrapper
          contextValue={contextValue}
          store={mockStore(storeMocks.invalidUser)}
          params={{ username: 'staffTest' }}
        />,
      );

      expect(navigate).toHaveBeenCalledWith('/notfound');
    });

    it('does not navigate to notfound on save error during admin target-user biodata view', () => {
      window.history.replaceState({}, '', '/profile/trainee01?for_user=21');

      const contextValue = {
        authenticatedUser: { userId: 123, username: 'staff', administrator: true },
        config: getConfig(),
      };
      const navigate = jest.fn();
      useNavigate.mockReturnValue(navigate);
      const mockHttpClient = {
        get: jest.fn().mockResolvedValue({ data: { id: 21, username: 'trainee01', trainee_profile: null } }),
      };
      getAuthenticatedHttpClient.mockReturnValue(mockHttpClient);

      render(
        <ProfilePageWrapper
          contextValue={contextValue}
          store={mockStore({
            ...storeMocks.invalidUser,
            profilePage: {
              ...storeMocks.invalidUser.profilePage,
              saveState: 'error',
              account: {
                ...storeMocks.invalidUser.profilePage.account,
                username: '',
              },
            },
          })}
          params={{ username: 'trainee01' }}
          initialEntry="/profile/trainee01?for_user=21"
        />,
      );

      expect(navigate).not.toHaveBeenCalledWith('/notfound');
    });
  });

  describe('admin biodata fallback', () => {
    it('renders biodata sections when the admin FBR profile lookup fails', async () => {
      const contextValue = {
        authenticatedUser: { userId: 123, username: 'staff', administrator: true },
        config: getConfig(),
      };
      const mockHttpClient = {
        get: jest.fn().mockRejectedValue(new Error('profile lookup failed')),
      };
      getAuthenticatedHttpClient.mockReturnValue(mockHttpClient);

      render(
        <ProfilePageWrapper
          contextValue={contextValue}
          store={mockStore(storeMocks.viewOwnProfile)}
        />,
      );

      await waitFor(() => {
        expect(screen.getAllByText('Basic Information').length).toBeGreaterThan(0);
      });
    });

    it('renders biodata sections for an admin target-user route with for_user', async () => {
      window.history.replaceState({}, '', '/profile/trainee01?for_user=21');

      const contextValue = {
        authenticatedUser: { userId: 123, username: 'staff', administrator: true },
        config: getConfig(),
      };
      const mockHttpClient = {
        get: jest.fn().mockResolvedValue({ data: { id: 21, username: 'trainee01', trainee_profile: null } }),
      };
      getAuthenticatedHttpClient.mockReturnValue(mockHttpClient);

      render(
        <ProfilePageWrapper
          contextValue={contextValue}
          store={mockStore(storeMocks.viewOwnProfile)}
          params={{ username: 'trainee01' }}
          initialEntry="/profile/trainee01?for_user=21"
        />,
      );

      await waitFor(() => {
        expect(screen.getAllByText('Basic Information').length).toBeGreaterThan(0);
      });
      expect(screen.getByText('trainee01')).toBeInTheDocument();
    });

    it('renders biodata sections even when admin lands on their own route with for_user', async () => {
      window.history.replaceState({}, '', '/profile/staff?for_user=21');

      const contextValue = {
        authenticatedUser: { userId: 123, username: 'staff', administrator: true },
        config: getConfig(),
      };
      const mockHttpClient = {
        get: jest.fn().mockResolvedValue({ data: { id: 21, username: 'trainee01', trainee_profile: null } }),
      };
      getAuthenticatedHttpClient.mockReturnValue(mockHttpClient);

      render(
        <ProfilePageWrapper
          contextValue={contextValue}
          store={mockStore(storeMocks.viewOwnProfile)}
          initialEntry="/profile/staff?for_user=21"
        />,
      );

      await waitFor(() => {
        expect(screen.getAllByText('Basic Information').length).toBeGreaterThan(0);
      });
      expect(screen.getByText('trainee01')).toBeInTheDocument();
    });

    it('keeps biodata editable for admin target-user view after declaration submission', async () => {
      window.history.replaceState({}, '', '/profile/trainee01?for_user=21');

      const contextValue = {
        authenticatedUser: { userId: 123, username: 'staff', administrator: true },
        config: getConfig(),
      };
      const mockHttpClient = {
        get: jest.fn().mockResolvedValue({ data: { id: 21, username: 'trainee01', trainee_profile: null } }),
      };
      getAuthenticatedHttpClient.mockReturnValue(mockHttpClient);

      render(
        <ProfilePageWrapper
          contextValue={contextValue}
          store={mockStore({
            ...storeMocks.viewOwnProfile,
            profilePage: {
              ...storeMocks.viewOwnProfile.profilePage,
              account: {
                ...storeMocks.viewOwnProfile.profilePage.account,
                username: 'trainee01',
                extendedProfile: [
                  { fieldName: 'declaration_is_submitted', fieldValue: true },
                ],
              },
              isAuthenticatedUserProfile: false,
            },
          })}
          params={{ username: 'trainee01' }}
          initialEntry="/profile/trainee01?for_user=21"
        />,
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Save and Next' })).toBeInTheDocument();
      });
    });

    it('disables the declaration tab for admin target-user view', async () => {
      window.history.replaceState({}, '', '/profile/trainee01?for_user=21');

      const contextValue = {
        authenticatedUser: { userId: 123, username: 'staff', administrator: true },
        config: getConfig(),
      };
      const mockHttpClient = {
        get: jest.fn().mockResolvedValue({ data: { id: 21, username: 'trainee01', trainee_profile: null } }),
      };
      getAuthenticatedHttpClient.mockReturnValue(mockHttpClient);

      render(
        <ProfilePageWrapper
          contextValue={contextValue}
          store={mockStore(storeMocks.viewOwnProfile)}
          params={{ username: 'trainee01' }}
          initialEntry="/profile/trainee01?for_user=21"
        />,
      );

      const declarationTab = await screen.findByLabelText('Declaration: Unavailable for admin');
      expect(declarationTab).toHaveAttribute('aria-disabled', 'true');
    });

    it('lets admin jump to later tabs after the trainee has submitted the full form', async () => {
      window.history.replaceState({}, '', '/profile/trainee01?for_user=21');

      const contextValue = {
        authenticatedUser: { userId: 123, username: 'staff', administrator: true },
        config: getConfig(),
      };
      const mockHttpClient = {
        get: jest.fn().mockResolvedValue({ data: { id: 21, username: 'trainee01', trainee_profile: null } }),
      };
      getAuthenticatedHttpClient.mockReturnValue(mockHttpClient);

      render(
        <ProfilePageWrapper
          contextValue={contextValue}
          store={mockStore({
            ...storeMocks.viewOwnProfile,
            profilePage: {
              ...storeMocks.viewOwnProfile.profilePage,
              account: {
                ...storeMocks.viewOwnProfile.profilePage.account,
                username: 'trainee01',
                extendedProfile: [
                  { fieldName: 'declaration_is_submitted', fieldValue: true },
                ],
              },
              isAuthenticatedUserProfile: false,
            },
          })}
          params={{ username: 'trainee01' }}
          initialEntry="/profile/trainee01?for_user=21"
        />,
      );

      const contactTab = await screen.findByLabelText('Contact Information: Not started');
      fireEvent.click(contactTab);

      await waitFor(() => {
        expect(screen.getByLabelText('Contact Information: Current')).toBeInTheDocument();
      });
    });

    it('shows a terminal save action on the last admin-visible biodata section', async () => {
      window.history.replaceState({}, '', '/profile/trainee01?for_user=21');

      const contextValue = {
        authenticatedUser: { userId: 123, username: 'staff', administrator: true },
        config: getConfig(),
      };
      const mockHttpClient = {
        get: jest.fn().mockResolvedValue({ data: { id: 21, username: 'trainee01', trainee_profile: null } }),
      };
      getAuthenticatedHttpClient.mockReturnValue(mockHttpClient);

      render(
        <ProfilePageWrapper
          contextValue={contextValue}
          store={mockStore({
            ...storeMocks.viewOwnProfile,
            profilePage: {
              ...storeMocks.viewOwnProfile.profilePage,
              account: {
                ...storeMocks.viewOwnProfile.profilePage.account,
                username: 'trainee01',
                extendedProfile: [
                  { fieldName: 'declaration_is_submitted', fieldValue: true },
                ],
              },
              isAuthenticatedUserProfile: false,
            },
          })}
          params={{ username: 'trainee01' }}
          initialEntry="/profile/trainee01?for_user=21"
        />,
      );

      const finalAdminTab = await screen.findByLabelText(
        'Close Relatives in Government Service: Not started',
      );
      fireEvent.click(finalAdminTab);

      await waitFor(() => {
        expect(
          screen.getByLabelText('Close Relatives in Government Service: Current'),
        ).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });
  });
});
