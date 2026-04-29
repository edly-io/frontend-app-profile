import { history } from '@edx/frontend-platform';
import { getAuthenticatedUser } from '@edx/frontend-platform/auth';
import pick from 'lodash.pick';
import {
  all,
  call,
  delay,
  put,
  select,
  takeEvery,
} from 'redux-saga/effects';
import {
  closeForm,
  deleteProfilePhotoBegin,
  deleteProfilePhotoReset,
  deleteProfilePhotoSuccess,
  DELETE_PROFILE_PHOTO,
  fetchProfileBegin,
  fetchProfileReset,
  fetchProfileSuccess,
  FETCH_PROFILE,
  resetDrafts,
  resetSectionDraft,
  saveProfileBegin,
  saveProfileFailure,
  saveProfileReset,
  saveProfileSuccess,
  SAVE_PROFILE,
  saveDraftSectionSuccess,
  SAVE_DRAFT_SECTION,
  saveProfilePhotoBegin,
  saveProfilePhotoReset,
  saveProfilePhotoSuccess,
  SAVE_PROFILE_PHOTO,
} from './actions';
import { handleSaveProfileSelector, userAccountSelector } from './selectors';
import * as ProfileApiService from './services';
import { getSectionById } from '../biodata/utils';
import { buildSectionDraftFromExtendedProfile } from '../biodata/apiTransforms';

export function* handleFetchProfile(action) {
  const { username } = action.payload;
  const userAccount = yield select(userAccountSelector);
  const isAuthenticatedUserProfile = username === getAuthenticatedUser().username;
  let preferences = {};
  let account = userAccount;
  let courseCertificates = null;
  let countriesCodesList = [];
  let biodataExtendedProfile = [];
  let profileCompletionStatus = null;

  try {
    yield put(fetchProfileBegin());

    const calls = [
      call(ProfileApiService.getAccount, username),
      call(ProfileApiService.getCourseCertificates, username),
      call(ProfileApiService.getCountryList),
    ];

    if (isAuthenticatedUserProfile) {
      calls.push(call(ProfileApiService.getPreferences, username));
      calls.push(call(ProfileApiService.getBiodataProfile));
      calls.push(call(ProfileApiService.getProfileCompletionStatus, username));
    }

    const result = yield all(calls);

    if (isAuthenticatedUserProfile) {
      [
        account,
        courseCertificates,
        countriesCodesList,
        preferences,
        biodataExtendedProfile,
        profileCompletionStatus,
      ] = result;
      account = {
        ...account,
        extendedProfile: biodataExtendedProfile,
        profileCompletionStatus,
      };
    } else {
      [account, courseCertificates, countriesCodesList] = result;
    }

    if (isAuthenticatedUserProfile && result[0].accountPrivacy === 'all_users') {
      yield call(ProfileApiService.patchPreferences, action.payload.username, {
        account_privacy: 'custom',
        'visibility.name': 'all_users',
        'visibility.bio': 'all_users',
        'visibility.course_certificates': 'all_users',
        'visibility.country': 'all_users',
        'visibility.date_joined': 'all_users',
        'visibility.level_of_education': 'all_users',
        'visibility.language_proficiencies': 'all_users',
        'visibility.social_links': 'all_users',
        'visibility.time_zone': 'all_users',
      });
    }

    yield put(fetchProfileSuccess(
      account,
      preferences,
      courseCertificates,
      isAuthenticatedUserProfile,
      countriesCodesList,
    ));

    yield put(fetchProfileReset());
  } catch (e) {
    if (e.response.status === 404) {
      history.push('/notfound');
    } else {
      throw e;
    }
  }
}

export function* handleSaveProfile(action) {
  try {
    const { drafts, preferences, account } = yield select(handleSaveProfileSelector);
    const biodataSection = getSectionById(action.payload.formId);

    let accountDrafts = pick(drafts, [
      'bio',
      'country',
      'levelOfEducation',
      'languageProficiencies',
      'name',
      'socialLinks',
    ]);

    let preferencesDrafts = pick(drafts, [
      'visibilityBio',
      'visibilityCountry',
      'visibilityLevelOfEducation',
      'visibilityLanguageProficiencies',
      'visibilityName',
      'visibilitySocialLinks',
    ]);

    yield put(saveProfileBegin());

    if (biodataSection) {
      const sectionDraft = drafts[action.payload.formId]
        || buildSectionDraftFromExtendedProfile(action.payload.formId, account.extendedProfile || []);
      const committedSectionData = buildSectionDraftFromExtendedProfile(
        action.payload.formId,
        account.extendedProfile || [],
      );

      accountDrafts = yield call(
        ProfileApiService.saveBiodataSection,
        action.payload.formId,
        sectionDraft,
        committedSectionData,
        account.extendedProfile || [],
      );
      preferencesDrafts = {};
    }

    if (Object.keys(preferencesDrafts).length > 0) {
      preferencesDrafts.accountPrivacy = 'custom';
    }
    let accountResult = null;

    if (Object.keys(accountDrafts).length > 0 && !biodataSection) {
      accountResult = yield call(
        ProfileApiService.patchProfile,
        action.payload.username,
        accountDrafts,
      );
    } else if (Object.keys(accountDrafts).length > 0) {
      accountResult = accountDrafts;
    }

    let preferencesResult = preferences;
    if (Object.keys(preferencesDrafts).length > 0) {
      yield call(ProfileApiService.patchPreferences, action.payload.username, preferencesDrafts);
      // TODO: Temporary deoptimization since the patchPreferences call doesn't return anything.

      preferencesResult = yield call(ProfileApiService.getPreferences, action.payload.username);
    }

    yield put(saveProfileSuccess(accountResult, preferencesResult));
    yield delay(1000);
    yield put(closeForm(action.payload.formId));
    yield delay(300);
    yield put(saveProfileReset());
    if (biodataSection) {
      yield put(resetSectionDraft(action.payload.formId));
    } else {
      yield put(resetDrafts());
    }
  } catch (e) {
    if (e.processedData && e.processedData.fieldErrors) {
      yield put(saveProfileFailure(e.processedData.fieldErrors));
    } else {
      yield put(saveProfileReset());
      throw e;
    }
  }
}

export function* handleSaveDraftSection(action) {
  try {
    const { drafts, account } = yield select(handleSaveProfileSelector);
    const sectionDraft = drafts[action.payload.formId];
    if (!sectionDraft) {
      return;
    }

    const committedSectionData = buildSectionDraftFromExtendedProfile(
      action.payload.formId,
      account.extendedProfile || [],
    );

    const result = yield call(
      ProfileApiService.saveBiodataSection,
      action.payload.formId,
      sectionDraft,
      committedSectionData,
      account.extendedProfile || [],
    );

    yield put(saveDraftSectionSuccess(result));
  } catch (e) {
    // silent — draft saves are best-effort; localStorage is the fallback
  }
}

export function* handleSaveProfilePhoto(action) {
  const { username, formData } = action.payload;

  try {
    yield put(saveProfilePhotoBegin());
    const photoResult = yield call(ProfileApiService.postProfilePhoto, username, formData);
    yield put(saveProfilePhotoSuccess(photoResult));
    yield put(saveProfilePhotoReset());
  } catch (e) {
    yield put(saveProfilePhotoReset());
  }
}

export function* handleDeleteProfilePhoto(action) {
  const { username } = action.payload;

  try {
    yield put(deleteProfilePhotoBegin());
    const photoResult = yield call(ProfileApiService.deleteProfilePhoto, username);
    yield put(deleteProfilePhotoSuccess(photoResult));
    yield put(deleteProfilePhotoReset());
  } catch (e) {
    yield put(deleteProfilePhotoReset());
  }
}

export default function* profileSaga() {
  yield takeEvery(FETCH_PROFILE.BASE, handleFetchProfile);
  yield takeEvery(SAVE_PROFILE.BASE, handleSaveProfile);
  yield takeEvery(SAVE_DRAFT_SECTION.BASE, handleSaveDraftSection);
  yield takeEvery(SAVE_PROFILE_PHOTO.BASE, handleSaveProfilePhoto);
  yield takeEvery(DELETE_PROFILE_PHOTO.BASE, handleDeleteProfilePhoto);
}
