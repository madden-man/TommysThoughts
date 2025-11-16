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
  const { currentText, currentSignature, status: bibleStatus } = useSelector(state => state['bible']);
  const [isModalOpen, setModalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [newPassage, setNewPassage] = useState(searchParams?.get('sig') || 'gen 1');
  const dispatch = useDispatch();

  const dispatchVerse = useCallback((verse) => {
    const sig = verse?.replaceAll(' ', '+');
    dispatch(bibleSlice.actions.PASSAGE_REQUESTED({ newSignature: sig }));
    setSearchParams({ sig });
  }, [dispatch, setSearchParams]);

  useEffect(() => {
    const onKeyPressed = (e) => {
      console.log(bibleStatus);
      if (bibleStatus === 'inprogress') return;

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
        if (currChapter === currBookInfo.numChapters) {
          setNewPassage(BOOKS[currBookInfo.index + 1].name + ' 1');
        } else {
          setNewPassage(currBook + ' ' + (currChapter + 1));
        }
      } else if (e.keyCode === 37) {
        /* left arrow */
        const currChapter = parseInt(currentSignature.substring(currentSignature.indexOf(' ') + 1), 10);
        const currBook = currentSignature.substring(0, currentSignature.indexOf(' '));
  
        const currBookInfo = BOOKS.map((book, index) => book.name === currBook && ({ ...book, index }))[0];
        if (currChapter === 1) {
          setNewPassage(BOOKS[currBookInfo.index - 1].name + ' '
            + BOOKS[currBookInfo.index - 1].numChapters);
        } else {
          setNewPassage(currBook + ' ' + (currChapter - 1));
        }
      }
    };

    window.addEventListener('keydown', onKeyPressed);

    console.log('currentSignature: ', currentSignature);
    console.log('newPassage: ', newPassage);
    console.log('currentText: ', currentText);
    if (searchParams?.has('sig') && bibleStatus !== 'inprogress' &&
      (newPassage?.trim() !== '' && currentSignature !== newPassage)) {
      dispatchVerse(newPassage);
    } else if (currentText?.trim() === '' &&
      (!searchParams?.has('sig') || currentSignature?.trim() === '')) {
      dispatchVerse('gen 1');
    }

    return () => {
      window.removeEventListener('keydown', onKeyPressed);
    }
  }, [currentSignature, searchParams, newPassage, bibleStatus, currentText, dispatchVerse]);

  const closeBibleModal = () => setModalOpen(false);

  return (
    <div className="page">
        <Header />
        <div className="bible">
            <BibleSidebar />
            <BibleContent />
            <BibleModal
                isOpen={isModalOpen}
                closeModal={closeBibleModal}
                passageRequested={bibleSlice.actions.PASSAGE_REQUESTED}
                setSearchParams={(sig) => { setSearchParams(sig); setNewPassage(sig); }}
            />
        </div>
    </div>
  );
};
