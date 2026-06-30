import React from 'react';
import {
  fireEvent, render, screen,
} from '@testing-library/react';

import BiodataSection from './BiodataSection';

const repeatableSection = {
  id: 'closeRelativesInGovernmentService',
  title: 'Close Relatives in Government Service',
  helperText: 'Government service relatives in repeatable rows.',
  fields: [],
  fileFields: [],
  repeatables: [
    {
      storageFieldName: 'close_relatives_in_government_service',
      addButtonLabel: 'Add relative',
      itemLabel: 'Relative',
      naFieldName: 'close_relatives_in_government_service_not_applicable',
      naLabel: 'N/A',
      emptyRow: {
        name: '',
        designation: '',
        relationship: '',
        address: '',
      },
      columns: [
        { key: 'name', label: 'Relative Name', placeholder: 'Enter relative name' },
        { key: 'designation', label: 'Designation', placeholder: 'Enter designation' },
        { key: 'relationship', label: 'Relationship', placeholder: 'Enter relationship' },
        { key: 'address', label: 'Address', placeholder: 'Enter address', type: 'textarea' },
      ],
    },
  ],
};

const initialDraft = {
  close_relatives_in_government_service_not_applicable: false,
  close_relatives_in_government_service: [{
    rowId: 'row-1',
    name: 'Kashif',
    designation: 'SHO',
    relationship: 'Brother',
    address: 'Lahore',
  }],
};

function SectionHarness() {
  const [draft, setDraft] = React.useState(initialDraft);

  return (
    <BiodataSection
      section={repeatableSection}
      extendedProfile={[]}
      draftValue={draft}
      errors={{}}
      saveState={null}
      isAuthenticatedUserProfile
      isEditing
      isLocked={false}
      forceEditingWhenEmpty
      showInlineTitle={false}
      showCancelButton={false}
      onClose={() => {}}
      onSubmit={() => {}}
      onDraftChange={(_, nextDraft) => setDraft(nextDraft)}
    />
  );
}

describe('<BiodataSection />', () => {
  it('restores previous repeatable rows after unchecking N/A', () => {
    render(<SectionHarness />);

    expect(screen.getByDisplayValue('Kashif')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'N/A' }));
    expect(screen.queryByDisplayValue('Kashif')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'N/A' }));
    expect(screen.getByDisplayValue('Kashif')).toBeInTheDocument();
  });
});
