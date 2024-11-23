import React, { useEffect, useState } from 'react';
import TextField from '@mui/material/TextField';
import { Button } from '@mui/material';

export const BingoModal = ({ onSubmit, onClose }) => {
    const [cardName, setCardName] = useState('');

    useEffect(() => {
        const handleEscKey = (e) => {
            if (e.keyCode === 27) {
                onClose();
            }
        };

        document.addEventListener('keyPress', handleEscKey);

        return () => {
            document.removeEventListener('keyPress', handleEscKey);
        }
    }, [onClose]);

    return (
        <div className='bingo__modal-holder'>
            <div className='bingo__modal'>
                <h2>Add a Bingo Card!</h2>
                <button className='bingo__modal--x' onClick={() => onClose()}>x</button>
                <div className="bingo__modal--field">
                    <TextField
                        id="standard-basic"
                        label="Name"
                        variant="standard"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                    />
                </div>
                <Button variant="contained" style={{marginTop: '1rem'}} onClick={() => {
                    onSubmit(cardName);
                    onClose();
                }}>
                    Create!
                </Button>
            </div>
        </div>
    )
}