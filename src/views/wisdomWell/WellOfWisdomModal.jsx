import { useState } from 'react';
import { addWisdom } from './server';

export const WellOfWisdomModal = ({ currentQuote, onClose }) => {
    const [quote, setQuote] = useState(currentQuote?.quote || '');
    const [book, setBook] = useState(currentQuote?.book || '');
    const [page, setPage] = useState(currentQuote?.page || '');

    return (
        <div className="well-of-wisdom__modal-holder">
            <div className="well-of-wisdom__modal">
                <div className="well-of-wisdom__modal--x" onClick={onClose}>x</div>
                <h2>{currentQuote?.quote ? 'Edit Quote!' : 'Add Quote!'}</h2>
                <h3>Quote:</h3>
                <textarea rows={10} value={quote} onChange={(e) => setQuote(e.target.value)} />
                <h3>Book:</h3>
                <input value={book} onChange={(e) => setBook(e.target.value)} />
                <h3>Page:</h3>
                <input value={page} onChange={(e) => setPage(e.target.value)} />
                <input type="submit" onClick={() => addWisdom({ ...currentQuote, quote, book, page })}/>          
            </div>
        </div>
    )
}