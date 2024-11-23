import React, { useState } from 'react';

import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import { Button } from '@mui/material';

export const BingoMenu = ({
    options,
    setActiveBoard,
    openModal,
}) => {
    const [cardName, setCardName] = useState(options[0]?.title || 'Long Term Bets');

    return (
        <div className="bingo__menu">
            <h1 className='bingo__title'>Bingo</h1>
            <div>
                <FormControl variant="standard" sx={{ m: 1, minWidth: 120 }}>
                    <Select
                        labelId="demo-simple-select-standard-label"
                        id="demo-simple-select-standard"
                        value={cardName}
                        onChange={(e) => { setCardName(e.target.value);
                            setActiveBoard(options.find(({ title }) => title === e.target.value )); }}
                        label="Type"
                    >
                        {options?.map(({ title }) => <MenuItem value={title}>{title}</MenuItem>)}
                    </Select>
                </FormControl>
                <Button className='bingo__btn' onClick={openModal}>ADD</Button>
            </div>
        </div>
    );
}

    