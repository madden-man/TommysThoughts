import React from 'react';

import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import { Button } from '@mui/material';

import { shuffleDarts } from './utils';

export const DartMenu = ({
    dartItems,
    setShuffleDart,
    setModalOpen,
    board,
    setBoard,
    sortMetric,
    setSortMetric,
    allSortMetrics
}) =>
    <div className="darts__menu">
        <h1 className='darts__title'>Darts</h1>
        <div>
            <FormControl variant="standard" sx={{ m: 1, minWidth: 120 }}>
                <Select
                    labelId="demo-simple-select-standard-label"
                    id="demo-simple-select-standard"
                    value={board}
                    onChange={(e) => setBoard(e.target.value)}
                    label="Type"
                    style={{marginRight: '1rem'}}
                >
                    <MenuItem value="Shows">Shows</MenuItem>
                    <MenuItem value="Movies">Movies</MenuItem>
                    <MenuItem value="Standup">Standup</MenuItem>
                    <MenuItem value="Marvel">Marvel</MenuItem>
                    <MenuItem value="Ghibli">Ghibli</MenuItem>
                </Select>
            </FormControl>
            <FormControl variant="standard" sx={{ m: 1, minWidth: 120 }}>
                <Select
                    labelId="demo-simple-select-standard-label"
                    id="demo-simple-select-standard"
                    value={sortMetric}
                    onChange={(e) => setSortMetric(e.target.value)}
                    label="Type"
                >
                    {allSortMetrics.map((metric) => 
                        <MenuItem value={metric}>
                            {metric}
                        </MenuItem>)}
                </Select>
            </FormControl>
        </div>
        <Button onClick={() => shuffleDarts(dartItems, setShuffleDart, sortMetric)}>
            Shuffle!
        </Button>
        <button className='darts__btn' onClick={() => setModalOpen(true)}>+</button>
</div>;
