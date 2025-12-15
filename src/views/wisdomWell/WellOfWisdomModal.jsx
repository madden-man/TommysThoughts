import { useState } from 'react';
import { addWisdom } from './server';

export const WellOfWisdomModal = ({ nugget, onClose }) => {
    const [quote, setQuote] = useState(nugget?.quote || '');
    const [author, setAuthor] = useState(nugget?.author || '');
    const [book, setBook] = useState(nugget?.book || '');
    const [page, setPage] = useState(nugget?.page || '');

    // TODO: OCR?

    return (
        <div className="well-of-wisdom__modal-holder">
            <div className="well-of-wisdom__modal">
                <div className="well-of-wisdom__modal--x" onClick={onClose}>x</div>
                <h2>{nugget?.quote ? 'Edit Quote!' : 'Add Quote!'}</h2>
                <h3>Quote:</h3>
                <textarea rows={10} value={quote} onChange={(e) => setQuote(e.target.value)} />
                <h3>Author:</h3>
                <input value={author} onChange={(e) => setAuthor(e.target.value)} />
                <h3>Book:</h3>
                <input value={book} onChange={(e) => setBook(e.target.value)} />
                <h3>Page:</h3>
                <input value={page} onChange={(e) => setPage(e.target.value)} />
                <input type="submit" onClick={() => { addWisdom({ ...nugget, quote, author, book, page }); onClose(); }}/>          
            </div>
        </div>
    )
}