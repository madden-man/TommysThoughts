import React from 'react';

import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import { Button } from '@mui/material';

export const BingoMenu = ({
    board,
}) =>
    <div className="bingo__menu">
        <h1 className='bingo__title'>Bingo</h1>
        <div>
            <FormControl variant="standard" sx={{ m: 1, minWidth: 120 }}>
                <Select
                    labelId="demo-simple-select-standard-label"
                    id="demo-simple-select-standard"
                    value={board}
                    onChange={(e) => console.log(e)}
                    label="Type"
                >
                    <MenuItem value="Babies">Long Term Bets</MenuItem>
                </Select>
            </FormControl>
        </div>
        <Button className='bingo__btn' onClick={() => console.log('ooh nice one babies')}>Save</Button>
</div>;
    