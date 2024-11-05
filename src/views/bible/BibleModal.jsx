import React, { useEffect, useState, useRef } from 'react';
import { bibleSlice } from './state/reducer';
import { useDispatch } from 'react-redux';

export const BibleModal = ({ isOpen, closeModal, setSearchParams }) => {

  const [bookName, _setBookName] = useState('');
  const [chapter, _setChapter] = useState('');
  const [verse, _setVerse] = useState('');

  const dispatch = useDispatch();

  const bookNameRef = useRef(bookName);
  const chapterRef = useRef(chapter);
  const verseRef = useRef(verse);

  const setBookName = data => {
    bookNameRef.current = data;
    _setBookName(data);
  };

  const setChapter = data => {
    chapterRef.current = data;
    _setChapter(data);
  }

  const setVerse = data => {
    verseRef.current = data;
    _setVerse(data);
  }

  useEffect(() => {
    const onKeyPressed = (e) => {
      const activeElement = document.activeElement;
      if (e.keyCode === 32 && activeElement.id === 'book-input') {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('chapter-input').focus();
      } else if (e.keyCode === 32 && activeElement.id === 'chapter-input' && activeElement.value !== '') {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('verse-input').focus();
      } else if (e.keyCode === 13 && (bookNameRef.current !== '' && chapterRef.current !== '')) {
        e.preventDefault();
        e.stopPropagation();
        const newPassage = `${bookNameRef.current} ${chapterRef.current}${verseRef && `: ${verseRef.current}`}`;
        dispatch(bibleSlice.actions.PASSAGE_REQUESTED({ newSignature: newPassage }));
        setSearchParams(newPassage);
        setBookName('');
        setChapter('');
        setVerse('');
        closeModal();
      }
    }

    const bookInput = document.getElementById('book-input');
    bookInput?.focus();
    setBookName('');
    
    window.addEventListener('keypress', (e) => onKeyPressed(e));

    return () => {
      window.removeEventListener('keypress', (e) => onKeyPressed(e));
    }
  }, [closeModal, setSearchParams, dispatch]);
  
  if (!isOpen) return null;

  return (
    <div className="bible__modal--overlay">
      <div className="bible__modal" id="bible__modal">
        <h2>Jump to..</h2>
        <div className='bible__modal--field'>
          <span>Book</span>
          <input
            value={bookName}
            onChange={(e) => setBookName(e.target.value)}
            id="book-input"
          />
        </div>
        <div className='bible__modal--field'>
          <span className="chapter-span">Chapter</span>
          <input
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            id="chapter-input"
          />
        </div>
        <div className='bible__modal--field'>
          <span>Verse</span>
          <input value={verse} onChange={(e) => setVerse(e.target.value)} id="verse-input" />
        </div>
      </div>
    </div>
  );
};
