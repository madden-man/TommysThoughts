import React from 'react';
import { useSelector } from 'react-redux';

export const BibleContent = () => {
  const { currentText } = useSelector(state => state.bible) || '';

  return (
    <div className="bible-content">
      {currentText}
    </div>
  );
};
