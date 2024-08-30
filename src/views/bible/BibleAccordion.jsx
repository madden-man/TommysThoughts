import React, { useState } from 'react';
import { string, array } from 'prop-types';

export const BibleAccordion = ({ title, books }) => {
  const [isAccordionOpen, setAccordionOpen] = useState(false);

  return (
    <div className="bible__accordion">
      <button onClick={() => setAccordionOpen(!isAccordionOpen)} className="bible__accordion__btn">
        {title}
      </button>
      {isAccordionOpen && books.map(({ name, code }) =>
        <a href={`/bible?sig=${code}+1`}>{name} - {code}</a>
      )}
    </div>
  );
};

BibleAccordion.propTypes = {
  title: string,
  books: array,
};
