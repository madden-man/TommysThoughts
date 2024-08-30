import React, { useState } from 'react';
import { BibleAccordion } from './BibleAccordion';
import { OLD_TESTAMENT_BOOKS, NEW_TESTAMENT_BOOKS } from './constants';

export const BibleSidebar = () => {
  const [searchText, setSearchText] = useState('');
  
  return (
    <div className="bible__sidebar">
      <h2>Bible Explorer</h2>
      <BibleAccordion title="Old Testament" books={OLD_TESTAMENT_BOOKS} />
      <BibleAccordion title="New Testament" books={NEW_TESTAMENT_BOOKS} />
      <p style={{ marginBottom: '4px'}}>Search the Bible for keywords:</p>
      <input value={searchText} onChange={(e) => setSearchText(e.target.value)} />
    </div>
  );
};
