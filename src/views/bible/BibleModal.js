import React, { useEffect, useState, useRef } from 'react';
import { bibleSlice } from './state/reducer';
import { useDispatch } from 'react-redux';

export const BibleModal = ({ isOpen, closeModal }) => {

  const [bookName, _setBookName] = useState('');
  const [chapter, _setChapter] = useState('');

  const dispatch = useDispatch();

  const bookNameRef = useRef(bookName);
  const chapterRef = useRef(chapter);

  const setBookName = data => {
    bookNameRef.current = data;
    _setBookName(data);
  };

  const setChapter = data => {
    chapterRef.current = data;
    _setChapter(data);
  }

  const onKeyPressed = (e) => {
    const bookInput = document.getElementById('book-input');

    if (e.keyCode === 32 && bookInput === document.activeElement) {
      document.getElementById('chapter-input')?.focus();
    } if (e.keyCode === 13) {
      dispatch(bibleSlice.actions.PASSAGE_REQUESTED({ newSignature: `${bookNameRef.current} ${chapterRef.current}`}));
      closeModal();
    }
  }

  useEffect(() => {
    document.getElementById('book-input')?.focus();
    window.addEventListener('keydown', (e) => onKeyPressed(e));

    return () => {
      window.removeEventListener('keydown', (e) => onKeyPressed(e));
    }
  }, [dispatch]);
  
  if (!isOpen) return null;

  return (
    <div className="bible-modal__overlay">
      <div className="bible-modal">
        <h2>Jump to..</h2>
        <span className="book-span">
          Book
          <input
            value={bookName}
            onChange={(e) => setBookName(e.target.value)}
            id="book-input"
          />
        </span>
        <span className="chapter-span">
          Chapter
          <input
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            id="chapter-input"
          />
        </span>
      </div>
    </div>
  );
};
