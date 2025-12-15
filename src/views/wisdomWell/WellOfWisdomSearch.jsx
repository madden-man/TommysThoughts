import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const WellOfWisdomSearch = ({ allWisdom }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const navigate = useNavigate();

    let typeaheads = [];
    allWisdom.forEach(({ author, book, quote }) => {
        if (author.toLowerCase().includes(searchTerm.toLowerCase())) {
            typeaheads.push(`a|${author}`);
        } if (book.toLowerCase().includes(searchTerm.toLowerCase())) {
            typeaheads.push(`b|${book}`);
        } if (quote.toLowerCase().includes(searchTerm.toLowerCase())) {
            // not sure yet
        }
    });
    const uniqTypeaheads = [...new Set(typeaheads)];

    const sendToSearch = (searchUrl) => { navigate(searchUrl); window.location.reload(); };

    return (
        <div className="well-of-wisdom__search">
            <input type="text" name="wisdom-search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <button onClick={() => sendToSearch(`/well-o-wisdom?search=a|${searchTerm}`)}>Author Search!</button>
            <button onClick={() => sendToSearch(`/well-o-wisdom?search=b|${searchTerm}`)}>Book Search!</button>
            <button onClick={() => sendToSearch(`/well-o-wisdom?search=q|${searchTerm}`)}>Quote Search!</button>
            <div className="well-of-wisdom__typeahead">
                {searchTerm.length > 2 && uniqTypeaheads.map((term) =>
                    <div key={term} className="well-of-wisdom__typeahead-item" onClick={() => sendToSearch(`/well-o-wisdom?search=${term}`)}>
                        {term.substring(2)}
                    </div>)}
            </div>
        </div>
    )
}