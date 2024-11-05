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
  const [newPassage, setNewPassage] = useState('');
  const [isModalOpen, setModalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const dispatch = useDispatch();

  const dispatchVerse = useCallback((verse) => {
    dispatch(bibleSlice.actions.PASSAGE_REQUESTED({ newSignature: verse }));
    setSearchParams({ sig: verse?.replaceAll(' ', '+') });
  }, [dispatch, setSearchParams]);

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
    if (searchParams?.has('sig') && searchParams?.get('sig') !== newPassage && newPassage !== '') {
      dispatchVerse(newPassage);
    } else if (!searchParams?.has('sig') || currentSignature === '') {
      dispatchVerse('gen 1');
    }

    return () => {
      window.removeEventListener('keydown', onKeyPressed);
    }
  }, [currentSignature, searchParams, newPassage, dispatchVerse]);

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
                setSearchParams={(sig) => { setSearchParams(sig); setNewPassage(sig); }}
            />
        </div>
    </div>
  );
};
