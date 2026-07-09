import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

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

const foreignVisitRepeatable = {
  storageFieldName: 'foreign_visits',
  itemLabel: 'Foreign visit',
  addButtonLabel: 'Add foreign visit',
  columns: [
    { key: 'from', label: 'From', type: 'date' },
    { key: 'to', label: 'To', type: 'date' },
  ],
};

const foreignVisitRows = [
  { rowId: 'visit-1', from: '2026-06-28', to: '2026-07-31' },
];

describe('RepeatableFieldGroup', () => {
  const today = new Date().toISOString().slice(0, 10);

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

  it('uses the selected from date as the lower bound for foreign visit to date and still caps it to today', () => {
    render(
      <RepeatableFieldGroup
        repeatable={foreignVisitRepeatable}
        rows={foreignVisitRows}
        errors={{}}
        onChange={jest.fn()}
        onBlur={jest.fn()}
        disabled={false}
      />,
    );

    expect(screen.getByLabelText('From')).toHaveAttribute('max', today);
    expect(screen.getByLabelText('To')).toHaveAttribute('min', '2026-06-28');
    expect(screen.getByLabelText('To')).toHaveAttribute('max', today);
  });

  it('preserves allowed subject punctuation while editing CSS subject names', () => {
    const onChange = jest.fn();

    render(
      <RepeatableFieldGroup
        repeatable={repeatable}
        rows={[{ rowId: 'row-1', subject: '' }]}
        errors={{}}
        onChange={onChange}
        onBlur={jest.fn()}
        disabled={false}
      />,
    );

    fireEvent.change(screen.getByLabelText('Subject'), {
      target: { value: 'CS & IT' },
    });

    expect(onChange).toHaveBeenCalledWith('updateCell', {
      rowIndex: 0,
      columnKey: 'subject',
      value: 'CS & IT',
    });
  });
});
