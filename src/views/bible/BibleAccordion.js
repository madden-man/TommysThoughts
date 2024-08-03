import React, { useState } from 'react';
import { string, array } from 'prop-types';

export const BibleAccordion = ({ title, books }) => {
  const [isAccordionOpen, setAccordionOpen] = useState(false);

  return (
    <div className="bible-accordion">
      <button onClick={() => setAccordionOpen(!isAccordionOpen)} className="bible-accordion__btn">
        {title}
      </button>
      {isAccordionOpen && books.map(({ name, code }) =>
        <div>{name} - {code}</div>
      )}
    </div>
  );
};

BibleAccordion.propTypes = {
  title: string,
  books: array,
};
