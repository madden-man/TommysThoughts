import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';

export const BibleContent = () => {
  const { currentText, currentSignature } = useSelector(state => state.bible) || '';

  const bibleContentArray = currentText?.split('\n');

  useEffect(() => {
    if (currentSignature?.indexOf(':') && bibleContentArray.length > 0) {
      const verse = currentSignature.substring(currentSignature.indexOf(':') + 1) || 0;
      const verseIndex = bibleContentArray.findIndex((p) => p.indexOf(`[${verse.trim()}]`) !== -1);
      console.log('verseIndex', verseIndex);
      if (verseIndex > 0) {
        const pElement = document.getElementById(`p-${currentSignature}-${verseIndex}`);
        pElement?.scrollIntoView();
      }
    }
  }, [bibleContentArray, currentSignature]);

  return (
    <div className="bible__content">
      {bibleContentArray.map((paragraph, i) =>
        <p key={`p-${currentSignature}-${i}`} id={`p-${currentSignature}-${i}`}>{paragraph}</p>)}
    </div>
  );
};
