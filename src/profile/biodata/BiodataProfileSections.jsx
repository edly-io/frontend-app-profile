import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Card, Collapsible, Nav,
} from '@openedx/paragon';
import classNames from 'classnames';

import { BIODATA_SECTIONS } from './config';
import BiodataSection from './BiodataSection';
import {
  openForm, closeForm, saveProfile, updateDraft,
} from '../data/actions';
import {
  getSectionInitialData,
  getSectionSummary,
  isSingleMaritalStatus,
  sectionHasValue,
} from './utils';

const buildExpandedSectionsState = (sections, openSectionId = null) => sections.reduce(
  (accumulator, section) => ({
    ...accumulator,
    [section.id]: section.id === openSectionId,
  }),
  {},
);

const BiodataProfileSections = () => {
  const dispatch = useDispatch();
  const sectionsContainerRef = useRef(null);
  const {
    account,
    drafts,
    errors,
    saveState,
    currentlyEditingField,
    isAuthenticatedUserProfile,
  } = useSelector((state) => state.profilePage);
  const extendedProfile = useMemo(() => account?.extendedProfile || [], [account?.extendedProfile]);
  const accountUsername = account?.username;
  const [pendingScrollSection, setPendingScrollSection] = useState(null);
  const basicInformationData = drafts.basicInformation
    || getSectionInitialData(BIODATA_SECTIONS[0], extendedProfile);
  const visibleSections = useMemo(
    () => BIODATA_SECTIONS.filter((section) => (
      section.id !== 'spouseInformation' || !isSingleMaritalStatus(basicInformationData.marital_status)
    )),
    [basicInformationData.marital_status],
  );

  const [activeSection, setActiveSection] = useState(BIODATA_SECTIONS[0].id);
  const [expandedSections, setExpandedSections] = useState(() => (
    buildExpandedSectionsState(BIODATA_SECTIONS, BIODATA_SECTIONS[0].id)
  ));

  const sectionSummaries = useMemo(
    () => BIODATA_SECTIONS.reduce((accumulator, section) => {
      const savedData = getSectionInitialData(section, extendedProfile);
      accumulator[section.id] = getSectionSummary(section, savedData);
      return accumulator;
    }, {}),
    [extendedProfile],
  );

  useEffect(() => {
    if (visibleSections.some((section) => section.id === activeSection)) {
      return;
    }

    const fallbackSectionId = visibleSections[0]?.id || null;
    setActiveSection(fallbackSectionId);
    setExpandedSections(buildExpandedSectionsState(visibleSections, fallbackSectionId));
    setPendingScrollSection(null);
  }, [activeSection, visibleSections]);

  useEffect(() => {
    if (!pendingScrollSection || !expandedSections[pendingScrollSection]) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      const target = document.getElementById(`biodata-section-${pendingScrollSection}`);
      const container = sectionsContainerRef.current;
      const sidebarLink = document.querySelector(`[data-biodata-nav="${pendingScrollSection}"]`);

      if (!target || !container || !sidebarLink) {
        return;
      }

      const targetTop = target.getBoundingClientRect().top + window.scrollY;
      const containerTop = container.getBoundingClientRect().top + window.scrollY;
      const sidebarTop = sidebarLink.getBoundingClientRect().top + window.scrollY;
      const nextScrollTop = Math.max(
        window.scrollY + (targetTop - sidebarTop),
        containerTop - 16,
      );

      window.scrollTo({
        top: nextScrollTop,
        behavior: 'smooth',
      });
      setPendingScrollSection(null);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [expandedSections, pendingScrollSection]);

  if (!accountUsername) {
    return null;
  }

  const openSectionFromSidebar = (sectionId) => {
    setActiveSection(sectionId);
    setExpandedSections(buildExpandedSectionsState(visibleSections, sectionId));
    setPendingScrollSection(sectionId);
  };

  const toggleSection = (sectionId, isOpen) => {
    setActiveSection(sectionId);
    setExpandedSections(buildExpandedSectionsState(visibleSections, isOpen ? sectionId : null));
  };

  const handleCloseSection = (sectionId) => {
    dispatch(closeForm(sectionId));
    setExpandedSections(buildExpandedSectionsState(visibleSections, null));
  };

  return (
    <div>
      <div className="row">
        <div className="col-lg-3 mb-4 mb-lg-0">
          <Card className="position-lg-sticky" style={{ top: '0' }}>
            <Card.Section>
              <Nav variant="pills" className="flex-column">
                {visibleSections.map((section) => (
                  <Nav.Item key={section.id}>
                    <Nav.Link
                      active={activeSection === section.id}
                      data-biodata-nav={section.id}
                      className="mb-2"
                      onClick={() => openSectionFromSidebar(section.id)}
                    >
                      <div className="font-weight-bold">{section.title}</div>
                      <div className="small text-muted">{sectionSummaries[section.id]}</div>
                    </Nav.Link>
                  </Nav.Item>
                ))}
              </Nav>
            </Card.Section>
          </Card>
        </div>
        <div ref={sectionsContainerRef} className="col-lg-9">
          {visibleSections.map((section) => (
            <div key={section.id} id={`biodata-section-${section.id}`} className="mb-3">
              {(() => {
                const savedData = getSectionInitialData(section, extendedProfile);
                const hasSavedContent = sectionHasValue(section, savedData);

                return (
                  <Collapsible
                    open={expandedSections[section.id]}
                    onToggle={(isOpen) => toggleSection(section.id, isOpen)}
                    title={(
                      <div className={classNames('d-flex w-100 align-items-center justify-content-between pr-2')}>
                        <div>
                          <div className="font-weight-bold text-gray-900">{section.title}</div>
                          <div className="small text-muted">{section.helperText}</div>
                        </div>
                      </div>
                    )}
                    styling="card"
                    className="shadow-sm"
                  >
                    <Card.Section>
                      <BiodataSection
                        section={section}
                        extendedProfile={extendedProfile}
                        draftValue={drafts[section.id]}
                        errors={errors}
                        saveState={saveState}
                        isAuthenticatedUserProfile={isAuthenticatedUserProfile}
                        isEditing={currentlyEditingField === section.id}
                        forceEditingWhenEmpty={expandedSections[section.id] && !hasSavedContent}
                        onOpen={(formId) => dispatch(openForm(formId))}
                        onClose={handleCloseSection}
                        onSubmit={(formId) => dispatch(saveProfile(formId, accountUsername))}
                        onDraftChange={(formId, value) => dispatch(updateDraft(formId, value))}
                        spacingClassName="pt-0"
                        showInlineTitle={false}
                      />
                    </Card.Section>
                  </Collapsible>
                );
              })()}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BiodataProfileSections;
