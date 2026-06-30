import React from 'react';
import { render, screen } from '@testing-library/react';

import RepeatableFieldGroup from './RepeatableFieldGroup';

const repeatable = {
  storageFieldName: 'css_subject_marks',
  itemLabel: 'Subject mark',
  addButtonLabel: 'Add subject mark',
  columns: [
    { key: 'subject', label: 'Subject', placeholder: 'Enter subject' },
  ],
};

const rows = [
  { rowId: 'row-1', subject: 'English Precise and Composition' },
  { rowId: 'row-2', subject: 'General Science and Ability' },
];

describe('RepeatableFieldGroup', () => {
  it('does not show a generic column error on every repeatable row', () => {
    render(
      <RepeatableFieldGroup
        repeatable={repeatable}
        rows={rows}
        errors={{
          subject: {
            userMessage: 'Duplicate elective subjects are not allowed.',
          },
        }}
        onChange={jest.fn()}
        onBlur={jest.fn()}
        disabled={false}
      />,
    );

    expect(screen.queryByText('Duplicate elective subjects are not allowed.')).not.toBeInTheDocument();
  });

  it('shows a row-specific repeatable error on the matching row', () => {
    render(
      <RepeatableFieldGroup
        repeatable={repeatable}
        rows={rows}
        errors={{
          'css_subject_marks.row-2.subject': {
            userMessage: 'Duplicate elective subjects are not allowed.',
          },
        }}
        onChange={jest.fn()}
        onBlur={jest.fn()}
        disabled={false}
      />,
    );

    expect(screen.getByText('Duplicate elective subjects are not allowed.')).toBeInTheDocument();
  });
});
