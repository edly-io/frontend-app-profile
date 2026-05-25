import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, Nav } from '@openedx/paragon';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faExclamationCircle } from '@fortawesome/free-solid-svg-icons';
import classNames from 'classnames';

import { BIODATA_SECTIONS } from './config';
import BiodataSection from './BiodataSection';
import {
  closeForm, saveProfile, saveProfileFailure, saveDraftSection, updateDraft,
} from '../data/actions';
import { getBiodataTargetUserId } from './apiConfig';
import {
  BIODATA_DATE_VALIDATION_MESSAGES,
  getSanitizedSectionData,
  getExtendedProfileValue,
  getSectionError,
  getSectionErrorSummary,
  getSectionInitialData,
  getSectionSubmittedFieldName,
  sectionHasValue,
  sectionIsComplete,
  shouldShowSpouseInformation,
  validateSectionDateRules,
  validateSectionDraft,
} from './utils';

const getVisibleSections = (maritalStatus, sections = BIODATA_SECTIONS) => sections.filter((section) => (
  section.id !== 'spouseInformation' || shouldShowSpouseInformation(maritalStatus)
));

const getStepperSections = (sections) => {
  const spouseSection = sections.find(section => section.id === 'spouseInformation');
  const sectionsWithoutSpouse = sections.filter(section => section.id !== 'spouseInformation');

  if (!spouseSection) {
    return sectionsWithoutSpouse;
  }

  return [
    sectionsWithoutSpouse[0],
    spouseSection,
    ...sectionsWithoutSpouse.slice(1),
  ].filter(Boolean);
};

const buildStepState = (sections, extendedProfile) => sections.reduce((accumulator, section) => {
  const savedData = getSectionInitialData(section, extendedProfile);
  accumulator[section.id] = {
    completed: sectionIsComplete(section, savedData),
    error: false,
  };
  return accumulator;
}, {});

const isSectionCompleteForNavigation = (
  section,
  extendedProfile,
  completedSectionId = null,
  completedSectionState = false,
) => {
  if (section.id === completedSectionId) {
    return completedSectionState;
  }

  return sectionIsComplete(section, getSectionInitialData(section, extendedProfile));
};

const getNextIncompleteVisibleSectionId = (
  sections,
  sectionId,
  extendedProfile,
  completedSectionId = null,
  completedSectionState = false,
) => {
  const currentIndex = sections.findIndex(section => section.id === sectionId);
  if (currentIndex === -1) {
    return sectionId;
  }

  const nextIncompleteSection = sections
    .slice(currentIndex + 1)
    .find(section => !isSectionCompleteForNavigation(
      section,
      extendedProfile,
      completedSectionId,
      completedSectionState,
    ));

  return nextIncompleteSection?.id || sections[currentIndex + 1]?.id || sectionId;
};

const getStepStatusLabel = (stepState, isActive) => {
  if (stepState?.error) {
    return stepState.errorSummary || 'Needs attention';
  }

  if (stepState?.completed) {
    return 'Completed';
  }

  return isActive ? 'Current' : 'Not started';
};

const renderStepStatusIcon = (stepState, isActive) => {
  if (stepState.error) {
    return (
      <FontAwesomeIcon
        icon={faExclamationCircle}
        className={isActive ? 'text-white' : 'text-danger'}
        style={{ fontSize: '1.25rem' }}
      />
    );
  }
  if (stepState.completed) {
    return (
      <FontAwesomeIcon
        icon={faCheckCircle}
        className={isActive ? 'text-white' : 'text-success'}
        style={{ fontSize: '1.25rem' }}
      />
    );
  }
  return (
    <span
      className={classNames(
        'd-inline-block rounded-circle',
        isActive ? 'bg-white' : 'bg-gray-400',
      )}
      style={{ fontSize: '1.25rem', width: '0.95rem', height: '0.95rem' }}
    />
  );
};

const getBiodataDraftStorageKey = (username, sectionId) => `fbr.biodata.draft:${username}:${sectionId}`;

const isTruthyFlag = value => value === true || String(value || '').trim().toLowerCase() === 'true';

const getSectionCompletedState = (section, savedData) => sectionIsComplete(section, savedData);

const getResumeSectionId = (sections, extendedProfile) => {
  const firstIncompleteSection = sections.find(section => !sectionIsComplete(
    section,
    getSectionInitialData(section, extendedProfile),
  ));

  return firstIncompleteSection?.id || sections[sections.length - 1]?.id || null;
};

const BiodataProfileSections = () => {
  const dispatch = useDispatch();
  const {
    account,
    drafts,
    errors,
    saveState,
    isAuthenticatedUserProfile,
  } = useSelector((state) => state.profilePage);
  const canEditBiodata = isAuthenticatedUserProfile || Boolean(getBiodataTargetUserId());
  const extendedProfile = useMemo(() => account?.extendedProfile || [], [account?.extendedProfile]);
  const accountUsername = account?.username;
  const previousSaveState = useRef(saveState);
  const hasResolvedInitialStep = useRef(false);
  const hasDraftRestoreRef = useRef(false);
  const [pendingSaveStepId, setPendingSaveStepId] = useState(null);
  const stepperSections = useMemo(() => getStepperSections(BIODATA_SECTIONS), []);
  const [activeStepId, setActiveStepId] = useState(stepperSections[0].id);
  const [stepStateById, setStepStateById] = useState(() => buildStepState(stepperSections, []));
  const [pendingScrollSectionId, setPendingScrollSectionId] = useState(null);
  const [pendingReturnSectionId, setPendingReturnSectionId] = useState(null);

  const basicInformationData = useMemo(() => getSanitizedSectionData(
    BIODATA_SECTIONS[0],
    drafts.basicInformation || getSectionInitialData(BIODATA_SECTIONS[0], extendedProfile),
  ), [drafts.basicInformation, extendedProfile]);

  const visibleSections = useMemo(
    () => getVisibleSections(basicInformationData.marital_status, stepperSections),
    [basicInformationData.marital_status, stepperSections],
  );
  const hasDeclarationLockFlag = isTruthyFlag(
    getExtendedProfileValue(extendedProfile, getSectionSubmittedFieldName('declaration')),
  );
  const isBiodataLocked = hasDeclarationLockFlag;

  const activeSection = useMemo(
    () => visibleSections.find(section => section.id === activeStepId) || visibleSections[0],
    [activeStepId, visibleSections],
  );

  useEffect(() => {
    setStepStateById(previousState => visibleSections.reduce((accumulator, section) => {
      const savedData = getSectionInitialData(section, extendedProfile);
      const previousStepState = previousState[section.id] || {};
      const completed = getSectionCompletedState(section, savedData);

      accumulator[section.id] = {
        completed,
        error: previousStepState.error || Boolean(getSectionError(section, errors)),
        errorSummary: getSectionErrorSummary(section, errors),
      };
      return accumulator;
    }, {}));
  }, [errors, extendedProfile, visibleSections]);

  useEffect(() => {
    hasResolvedInitialStep.current = false;
    hasDraftRestoreRef.current = false;
  }, [accountUsername]);

  useEffect(() => {
    if (!accountUsername || hasDraftRestoreRef.current || visibleSections.length === 0) {
      return;
    }
    hasDraftRestoreRef.current = true;
    visibleSections.forEach((section) => {
      try {
        const stored = localStorage.getItem(getBiodataDraftStorageKey(accountUsername, section.id));
        if (stored) {
          dispatch(updateDraft(section.id, JSON.parse(stored)));
        }
      } catch (e) {
        // ignore parse/storage errors
      }
    });
  }, [accountUsername, dispatch, visibleSections]);

  useEffect(() => {
    if (!accountUsername || hasResolvedInitialStep.current || visibleSections.length === 0) {
      return;
    }

    const resumeSectionId = getResumeSectionId(visibleSections, extendedProfile);
    if (resumeSectionId) {
      setActiveStepId(resumeSectionId);
    }
    hasResolvedInitialStep.current = true;
  }, [accountUsername, extendedProfile, visibleSections]);

  useEffect(() => {
    if (!visibleSections.some(section => section.id === activeStepId)) {
      setActiveStepId(visibleSections[0]?.id || null);
    }
  }, [activeStepId, visibleSections]);

  useEffect(() => {
    if (!pendingScrollSectionId || activeSection?.id !== pendingScrollSectionId) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      const target = document.getElementById(`biodata-section-${pendingScrollSectionId}`);
      const sidebarLink = document.querySelector(`[data-biodata-nav="${pendingScrollSectionId}"]`);

      if (!target || !sidebarLink) {
        setPendingScrollSectionId(null);
        return;
      }

      const targetTop = target.getBoundingClientRect().top;
      const sidebarTop = sidebarLink.getBoundingClientRect().top;

      window.scrollTo({
        top: Math.max(window.scrollY + targetTop - sidebarTop, 0),
        behavior: 'smooth',
      });
      setPendingScrollSectionId(null);
    }, 50);

    return () => window.clearTimeout(timeoutId);
  }, [activeSection, pendingScrollSectionId]);

  useEffect(() => {
    const previousState = previousSaveState.current;
    previousSaveState.current = saveState;

    if (!pendingSaveStepId || previousState === saveState) {
      return;
    }

    if (saveState === 'complete') {
      const savedSection = visibleSections.find(section => section.id === pendingSaveStepId);
      const completed = savedSection
        ? sectionIsComplete(savedSection, getSectionInitialData(savedSection, extendedProfile))
        : false;

      setStepStateById(previousStateById => ({
        ...previousStateById,
        [pendingSaveStepId]: {
          ...previousStateById[pendingSaveStepId],
          completed,
          error: false,
        },
      }));
      if (accountUsername) {
        try {
          localStorage.removeItem(getBiodataDraftStorageKey(accountUsername, pendingSaveStepId));
        } catch (e) {
          // ignore
        }
      }
      const nextSectionId = pendingReturnSectionId
        || getNextIncompleteVisibleSectionId(
          visibleSections,
          pendingSaveStepId,
          extendedProfile,
          pendingSaveStepId,
          completed,
        );
      setActiveStepId(nextSectionId);
      setPendingScrollSectionId(nextSectionId);
      setPendingSaveStepId(null);
      setPendingReturnSectionId(null);
    }

    if (saveState === 'error') {
      setStepStateById(previousStateById => ({
        ...previousStateById,
        [pendingSaveStepId]: {
          ...previousStateById[pendingSaveStepId],
          completed: false,
          error: true,
          errorSummary: getSectionErrorSummary(
            visibleSections.find(section => section.id === pendingSaveStepId) || {},
            errors,
          ),
        },
      }));
      setActiveStepId(pendingSaveStepId);
      setPendingScrollSectionId(pendingSaveStepId);
      setPendingSaveStepId(null);
    }
  }, [
    accountUsername, drafts, errors, extendedProfile,
    pendingReturnSectionId, pendingSaveStepId, saveState, visibleSections,
  ]);

  if (!accountUsername || !activeSection) {
    return null;
  }

  const activeSectionSavedData = getSectionInitialData(activeSection, extendedProfile);
  const activeSectionHasSavedContent = sectionHasValue(activeSection, activeSectionSavedData);

  const getSectionDraftData = section => getSanitizedSectionData(
    section,
    drafts[section.id] || getSectionInitialData(section, extendedProfile),
  );

  const sectionNeedsAttention = (section) => {
    const sectionData = getSectionDraftData(section);

    return Object.keys(validateSectionDraft(section, sectionData)).length > 0
      || !sectionIsComplete(section, sectionData);
  };

  const getFirstIncompleteSectionBefore = (sectionId) => {
    const currentSectionIndex = visibleSections.findIndex(section => section.id === sectionId);

    if (currentSectionIndex <= 0) {
      return null;
    }

    return visibleSections
      .slice(0, currentSectionIndex)
      .find(section => sectionNeedsAttention(section)) || null;
  };

  const getFirstBlockedSectionBefore = (sectionId) => {
    const currentSectionIndex = visibleSections.findIndex(section => section.id === sectionId);

    if (currentSectionIndex <= 0) {
      return null;
    }

    return visibleSections.slice(0, currentSectionIndex).find((section) => {
      const sectionData = getSectionDraftData(section);

      return Object.keys(validateSectionDraft(section, sectionData)).length > 0
        || !sectionIsComplete(section, sectionData);
    }) || null;
  };

  const markSectionNeedsAttention = (section) => {
    const sectionData = getSectionDraftData(section);
    const validationErrors = validateSectionDraft(section, sectionData);

    dispatch(updateDraft(section.id, sectionData));
    if (Object.keys(validationErrors).length > 0) {
      dispatch(saveProfileFailure(validationErrors));
    }
    setStepStateById(previousStateById => ({
      ...previousStateById,
      [section.id]: {
        ...previousStateById[section.id],
        completed: false,
        error: true,
        errorSummary: getSectionErrorSummary(section, validationErrors)
          || 'Please complete this section before continuing.',
      },
    }));
  };

  const moveToSection = (sectionId) => {
    setActiveStepId(sectionId);
    setPendingScrollSectionId(sectionId);
  };

  const handleStepClick = (sectionId) => {
    if (sectionId === 'declaration') {
      const incompleteSection = getFirstBlockedSectionBefore(sectionId)
        || getFirstIncompleteSectionBefore(sectionId);

      if (incompleteSection) {
        markSectionNeedsAttention(incompleteSection);
        setPendingReturnSectionId(sectionId);
        setActiveStepId(incompleteSection.id);
        window.setTimeout(() => {
          document.getElementById(`biodata-section-${incompleteSection.id}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
        return;
      }
    }

    if (
      sectionId !== activeSection.id
      && drafts[activeSection.id]
      && accountUsername
    ) {
      dispatch(saveDraftSection(activeSection.id, accountUsername));
    }

    setPendingReturnSectionId(null);
    moveToSection(sectionId);
  };

  const handleCloseSection = (sectionId) => {
    dispatch(closeForm(sectionId));
  };

  const handleDraftChange = (sectionId, value) => {
    const section = visibleSections.find(item => item.id === sectionId);
    const sanitizedData = section ? getSanitizedSectionData(section, value) : value;
    const dateValidationErrors = section ? validateSectionDateRules(section, sanitizedData) : {};
    const hasDateValidationErrors = Object.keys(dateValidationErrors).length > 0;

    dispatch(updateDraft(sectionId, sanitizedData));

    if (accountUsername) {
      try {
        localStorage.setItem(getBiodataDraftStorageKey(accountUsername, sectionId), JSON.stringify(sanitizedData));
      } catch (e) {
        // storage quota exceeded — ignore
      }
    }

    if (!section) {
      return;
    }

    if (hasDateValidationErrors) {
      dispatch(saveProfileFailure(dateValidationErrors));
      setStepStateById(previousStateById => ({
        ...previousStateById,
        [section.id]: {
          ...previousStateById[section.id],
          completed: false,
          error: true,
          dateValidationError: true,
          errorSummary: getSectionErrorSummary(section, dateValidationErrors),
        },
      }));
      return;
    }

    setStepStateById(previousStateById => {
      const previousSectionState = previousStateById[section.id] || {};
      if (
        !previousSectionState.dateValidationError
        && !BIODATA_DATE_VALIDATION_MESSAGES.includes(previousSectionState.errorSummary)
      ) {
        return previousStateById;
      }

      return {
        ...previousStateById,
        [section.id]: {
          ...previousSectionState,
          error: false,
          dateValidationError: false,
          errorSummary: '',
        },
      };
    });
  };

  const handleSaveAndNext = (sectionId) => {
    const section = visibleSections.find(item => item.id === sectionId);
    if (!section || !accountUsername) {
      return;
    }

    const nextSectionData = getSectionDraftData(section);

    if (section.id === 'declaration') {
      const incompleteSection = getFirstBlockedSectionBefore(section.id)
        || getFirstIncompleteSectionBefore(section.id);

      if (incompleteSection) {
        markSectionNeedsAttention(incompleteSection);
        setPendingReturnSectionId(section.id);
        moveToSection(incompleteSection.id);
        return;
      }
    }

    const validationErrors = validateSectionDraft(section, nextSectionData);
    if (Object.keys(validationErrors).length > 0) {
      dispatch(updateDraft(section.id, nextSectionData));
      dispatch(saveProfileFailure(validationErrors));
      setStepStateById(previousStateById => ({
        ...previousStateById,
        [section.id]: {
          ...previousStateById[section.id],
          completed: false,
          error: true,
          errorSummary: getSectionErrorSummary(section, validationErrors),
        },
      }));
      moveToSection(section.id);
      return;
    }

    dispatch(updateDraft(section.id, nextSectionData));
    setPendingSaveStepId(section.id);
    dispatch(saveProfile(section.id, accountUsername));
  };

  return (
    <div className="row">
      <div className="col-lg-3 mb-4 mb-lg-0">
        <Card className="position-lg-sticky" style={{ top: '0' }}>
          <Card.Section>
            <Nav variant="pills" className="flex-column biodata-stepper">
              {visibleSections.map((section, index) => {
                const isActive = activeSection.id === section.id;
                const isLastVisibleStep = index === visibleSections.length - 1;
                const stepState = stepStateById[section.id] || {};
                const statusLabel = getStepStatusLabel(stepState, isActive);

                return (
                  <Nav.Item key={section.id}>
                    <Nav.Link
                      active={isActive}
                      data-biodata-nav={section.id}
                      aria-label={`${section.title}: ${statusLabel}`}
                      className="mb-2 d-flex align-items-stretch text-left position-relative"
                      onClick={() => handleStepClick(section.id)}
                    >
                      <span className="d-flex flex-column align-items-center flex-shrink-0 mr-2 position-relative" aria-hidden="true">
                        <span
                          className={classNames(
                            'd-inline-flex align-items-center justify-content-center flex-shrink-0',
                            isActive ? 'bg-primary' : 'bg-white',
                          )}
                          style={{ width: '1.75rem', minHeight: '1.75rem', zIndex: 1 }}
                        >
                          {renderStepStatusIcon(stepState, isActive)}
                        </span>
                        {!isLastVisibleStep && (
                          <span
                            className={classNames(
                              'biodata-stepper__connector',
                              {
                                'biodata-stepper__connector--completed': stepState.completed && !stepState.error && !isActive,
                                'biodata-stepper__connector--error': stepState.error && !isActive,
                                'biodata-stepper__connector--active': isActive,
                              },
                            )}
                          />
                        )}
                      </span>
                      <span className="font-weight-bold">{section.title}</span>
                    </Nav.Link>
                  </Nav.Item>
                );
              })}
            </Nav>
          </Card.Section>
        </Card>
      </div>
      <div className="col-lg-9">
        <Card id={`biodata-section-${activeSection.id}`} className="shadow-sm">
          <Card.Section>
            <div className="mb-3">
              <div className="font-weight-bold text-gray-900 h3 mb-1">{activeSection.title}</div>
              {activeSection.helperText && (
                <div className="small text-muted">{activeSection.helperText}</div>
              )}
            </div>
            <BiodataSection
              section={activeSection}
              extendedProfile={extendedProfile}
              draftValue={drafts[activeSection.id]}
              errors={errors}
              saveState={saveState}
              isAuthenticatedUserProfile={canEditBiodata}
              isEditing={canEditBiodata}
              isLocked={isBiodataLocked}
              forceEditingWhenEmpty={!activeSectionHasSavedContent}
              onClose={handleCloseSection}
              onSubmit={handleSaveAndNext}
              onDraftChange={handleDraftChange}
              spacingClassName="pt-0"
              showInlineTitle={false}
              showCancelButton={false}
              showSubmitButton={!isBiodataLocked}
              submitLabels={{
                default: 'Save and Next',
                pending: 'Saving',
                complete: 'Saved',
              }}
            />
          </Card.Section>
        </Card>
      </div>
    </div>
  );
};

export default BiodataProfileSections;
