import React, { useEffect, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import { bibleSlice } from './state/reducer';
import { BibleSidebar } from './BibleSidebar';
import { BibleContent } from './BibleContent';
import { BibleModal } from './BibleModal';
import { BOOKS } from './constants';

import './bible.css';
import { Header } from '../../components/Header';
import { useSearchParams } from 'react-router-dom';

export const BiblePage = () => {
  const { currentSignature } = useSelector(state => state['bible']);
  const [isModalOpen, setModalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const dispatch = useDispatch();

  const dispatchVerse = useCallback((verse) => {
    dispatch(bibleSlice.actions.PASSAGE_REQUESTED({ newSignature: verse }))
  }, [dispatch]);

  useEffect(() => {

    const onKeyPressed = (e) => {
      if (e.keyCode === 74 || e.keyCode === 220) {
        e.preventDefault();
        e.stopPropagation();
        setModalOpen(true);
      } else if (e.keyCode === 27) {
        e.preventDefault();
        e.stopPropagation();
        setModalOpen(false);
      } else if (e.keyCode === 39) {
        e.preventDefault();
        e.stopPropagation();

        const currChapter = parseInt(currentSignature.substring(currentSignature.indexOf(' ') + 1), 10);
        const currBook = currentSignature.substring(0, currentSignature.indexOf(' '));
  
        const currBookInfo = BOOKS.map((book, index) => book.name === currBook && ({ ...book, index }))[0];
        let newPassage;
        if (currChapter === currBookInfo.numChapters) {
          newPassage = BOOKS[currBookInfo.index + 1].name + ' 1';
        } else {
          newPassage = currBook + ' ' + (currChapter + 1);
        }
        dispatchVerse(newPassage);
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
  
        dispatchVerse(newPassage);
      }
    };

    window.addEventListener('keydown', onKeyPressed);

    const sig = searchParams?.get('sig').replaceAll('+', ' ');
    if (sig !== currentSignature) {
      dispatchVerse(sig);
    } else {
      dispatchVerse('gen 1');
    }
    setSearchParams('');

    return () => {
      window.removeEventListener('keydown', onKeyPressed);
    }
  }, [currentSignature, dispatchVerse, searchParams, setSearchParams]);

  const closeBibleModal = () => setModalOpen(false);

  return (
    <div>
        <Header />
        <div className="bible">
            <BibleSidebar />
            <BibleContent />
            <BibleModal
                isOpen={isModalOpen}
                closeModal={closeBibleModal}
                passageRequested={bibleSlice.actions.PASSAGE_REQUESTED}
            />
        </div>
    </div>
  );
};
