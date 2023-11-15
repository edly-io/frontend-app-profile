import React from "react";
import {
  FormattedDate,
  FormattedMessage,
  injectIntl,
} from "@edx/frontend-platform/i18n";
import { Hyperlink } from "@edx/paragon";
import { connect } from "react-redux";

import messages from "./Badges.messages";

// Components
import FormControls from "./elements/FormControls";
import EditableItemHeader from "./elements/EditableItemHeader";
import SwitchContent from "./elements/SwitchContent";

// Selectors
import { badgesSelector } from "../data/selectors";

class Badges extends React.Component {
  constructor(props) {
    super(props);

    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleOpen = this.handleOpen.bind(this);
  }

  handleChange(e) {
    const { name, value } = e.target;
    this.props.changeHandler(name, value);
  }

  handleSubmit(e) {
    e.preventDefault();
    this.props.submitHandler(this.props.formId);
  }

  handleClose() {
    this.props.closeHandler(this.props.formId);
  }

  handleOpen() {
    this.props.openHandler(this.props.formId);
  }

  renderBadge({ badge_class, created, assertion_url }) {
    const { intl } = this.props;

    return (
      <div
        key={`${badge_class.slug}`}
        className="col col-sm-6 d-flex align-items-stretch"
      >
        <div className="card mb-4 certificate flex-grow-1">
          <div className="card-body d-flex flex-row" style={{ height: "90%" }}>
            <div style={{ width: "100%", flex: "60%" }}>
              <p className="small mb-0">
                {intl.formatMessage(messages["profile.badges.title"])}
              </p>
              <p
                className="certificate-title small mb-3"
                style={{ fontSize: "large" }}
              >
                {badge_class.display_name}
              </p>
              <p className="small mb-0">
                <FormattedMessage
                  id="profile.badge.organization.label"
                  defaultMessage={intl.formatMessage(
                    messages["profile.badge.organization.label"]
                  )}
                />
              </p>
              <p className="h6 mb-4">
                {badge_class.course_id.substring(
                  badge_class.course_id.indexOf(":") + 1,
                  badge_class.course_id.indexOf("+")
                )}
              </p>
              <p className="small mb-2">
                <FormattedMessage
                  id="profile.badge.completion.date.label"
                  defaultMessage="{date}"
                  values={{
                    date: (
                      <p>
                        {intl.formatMessage(
                          messages["profile.badge.completion.date.label"]
                        )}{" "}
                        <FormattedDate value={new Date(created)} />
                      </p>
                    ),
                  }}
                />
              </p>
              <Hyperlink
                destination={assertion_url}
                className="btn btn-outline-primary"
                target="_blank"
              >
                {intl.formatMessage(messages["profile.badges.view.badge"])}
              </Hyperlink>
            </div>
            <div style={{ flex: "40%", padding: "2%" }}>
              <img
                style={{ width: "100%" }}
                src={`${badge_class.image_url}`}
              ></img>
            </div>
          </div>
        </div>
      </div>
    );
  }

  renderBadges() {
    if (this.props.badges === null || this.props.badges.length === 0) {
      return (
        <FormattedMessage
          id="profile.no.badges"
          defaultMessage="You don't have any badges yet."
          description="displays when user has no badges"
        />
      );
    }
    return (
      <div className="row align-items-stretch">
        {this.props.badges.map((badge) => this.renderBadge(badge))}
      </div>
    );
  }

  render() {
    const { visibilityAccomplishmentsShared, editMode, saveState, intl } =
      this.props;
    return (
      <SwitchContent
        className="mb-4"
        expression={editMode}
        cases={{
          editing: (
            <div role="dialog" aria-labelledby="course-badges-label">
              <form onSubmit={this.handleSubmit}>
                <EditableItemHeader
                  headingId="course-badges-label"
                  content={intl.formatMessage(
                    messages["profile.badges.my.badges"]
                  )}
                />
                <FormControls
                  visibilityId="visibilityAccomplishmentsShared"
                  saveState={saveState}
                  visibility={visibilityAccomplishmentsShared}
                  cancelHandler={this.handleClose}
                  changeHandler={this.handleChange}
                />
                {this.renderBadges()}
              </form>
            </div>
          ),
          editable: (
            <>
              <EditableItemHeader
                content={intl.formatMessage(
                  messages["profile.badges.my.badges"]
                )}
                showEditButton
                onClickEdit={this.handleOpen}
                showVisibility={visibilityAccomplishmentsShared !== null}
                visibility={visibilityAccomplishmentsShared}
              />
              {this.renderBadges()}
            </>
          ),
          empty: (
            <>
              <EditableItemHeader
                content={intl.formatMessage(
                  messages["profile.badges.my.badges"]
                )}
                showEditButton
                onClickEdit={this.handleOpen}
                showVisibility={visibilityAccomplishmentsShared !== null}
                visibility={visibilityAccomplishmentsShared}
              />
              {this.renderBadges()}
            </>
          ),
          static: (
            <>
              <EditableItemHeader
                content={intl.formatMessage(
                  messages["profile.badges.my.badges"]
                )}
              />
              {this.renderBadges()}
            </>
          ),
        }}
      />
    );
  }
}

export default connect(badgesSelector, {})(injectIntl(Badges));
