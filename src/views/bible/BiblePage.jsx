import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import { bibleSlice } from './state/reducer';
import { BibleSidebar } from './BibleSidebar';
import { BibleContent } from './BibleContent';
import { BibleModal } from './BibleModal';
import { BOOKS } from './constants';

import './bible.css';
import { Header } from '../../components/Header';

export const BiblePage = () => {
  const { currentSignature } = useSelector(state => state['bible']);
  const dispatch = useDispatch();

  const [isModalOpen, setModalOpen] = useState(false);

  const onKeyPressed = (e) => {
    if (e.keyCode === 74 || e.keyCode === 220) {
      setModalOpen(true);
    } else if (e.keyCode === 27) {
      setModalOpen(false);
    } else if (e.keyCode === 39) {
      const currChapter = parseInt(currentSignature.substring(currentSignature.indexOf(' ') + 1), 10);
      const currBook = currentSignature.substring(0, currentSignature.indexOf(' '));

      const currBookInfo = BOOKS.map((book, index) => book.name === currBook && ({ ...book, index }))[0];
      let newPassage;
      if (currChapter === currBookInfo.numChapters) {
        newPassage = BOOKS[currBookInfo.index + 1].name + ' 1';
      } else {
        newPassage = currBook + ' ' + (currChapter + 1);
      }
      dispatch(bibleSlice.actions.PASSAGE_REQUESTED({ newSignature: newPassage }));
    } else if (e.keyCode === 37) {
      /* left arrow */
      const currChapter = parseInt(currentSignature.substring(currentSignature.indexOf(' ') + 1), 10);
      const currBook = currentSignature.substring(0, currentSignature.indexOf(' '));

      const currBookInfo = BOOKS.map((book, index) => book.name === currBook && ({ ...book, index }))[0];
      let newPassage;
      if (currChapter === 1) {
        newPassage = BOOKS[currBookInfo.index - 1].name + ' ' + BOOKS[currBookInfo.index - 1].numChapters;
      } else {
        newPassage = currBook + ' ' + (currChapter - 1);
      }

      dispatch(bibleSlice.actions.PASSAGE_REQUESTED({ newSignature: newPassage }));
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', onKeyPressed);

    return () => {
      window.removeEventListener('keydown', onKeyPressed);
    }
  }, [currentSignature]);

  useEffect(() => {
    dispatch(bibleSlice.actions.PASSAGE_REQUESTED({ newSignature: 'gen 1' }));
  }, []);

  return (
    <div className="page">
        <Header />
        <div className="bible-container">
            <BibleSidebar />
            <BibleContent />
            <BibleModal
                isOpen={isModalOpen}
                closeModal={() => setModalOpen(false)}
                passageRequested={bibleSlice.actions.PASSAGE_REQUESTED}
            />
        </div>
    </div>
  );
};
