import React from 'react';
import { render, screen } from '@testing-library/react';

import { BiodataFileActions } from './BiodataFilePreview';

it('renders an uploaded attachment preview as one new-tab link', () => {
  const previewUrl = 'https://files.example.com/css-marksheet.pdf';

  render(
    <BiodataFileActions
      field={{ label: 'CSS marksheet' }}
      fileValue={previewUrl}
      onReplace={jest.fn()}
      onRemove={jest.fn()}
    />,
  );

  const previewLink = screen.getByRole('link', { name: 'Preview CSS marksheet' });
  expect(previewLink).toHaveAttribute('href', previewUrl);
  expect(previewLink).toHaveAttribute('target', '_blank');
  expect(previewLink).toHaveAttribute('rel', 'noopener noreferrer');
});
