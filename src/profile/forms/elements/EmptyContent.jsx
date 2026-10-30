import React from 'react';
import PropTypes from 'prop-types';
import { Button } from '@openedx/paragon';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';

const EmptyContent = ({ children = null, onClick = null, showPlusIcon = true }) => (
  <div className="p-0 m-0">
    {onClick ? (
      <Button
        type="button"
        variant="link"
        className="p-0 text-left lh-36px"
        onClick={onClick}
      >
        {showPlusIcon ? <FontAwesomeIcon size="xs" className="mr-1" icon={faPlus} /> : null}
        {children}
      </Button>
    ) : children}
  </div>
);

export default EmptyContent;

EmptyContent.propTypes = {
  onClick: PropTypes.func,
  children: PropTypes.node,
  showPlusIcon: PropTypes.bool,
};
