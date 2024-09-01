import React, { useEffect, useState } from 'react';

import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';

import { Header } from '../../components/Header';

import './darts.css';
import { getDarts, addDart, updateDart } from './server';
import { DartModal } from './DartModal';
import { Button } from '@mui/material';
import classNames from 'classnames';

export const DartWallPage = () => {

    const initialFields = { name: '', description: '', rating: 0, enneagram: '', metrics: { heartlighted: 0 }};
    const [sortMetric, setSortMetric] = useState('heartlighted');
    const [modalOpen, setModalOpen] = useState(false);
    const [board, setBoard] = useState('Shows');
    const [dartItems, setDartItems] = useState([]);
    const [shuffleDart, setShuffleDart] = useState([]);
    const [activeDart, setActiveDart] = useState(initialFields);

    const fetchDarts = async(board) => {
        let newDartItems = await getDarts(board);

        newDartItems = newDartItems.sort((a, b) => {
            if (a.rating > b.rating) {
                return -1;
            } else if (b.rating > a.rating) {
                return 1;
            }
            return 0;
        });
    
        newDartItems.forEach((item) => {
            if (item.metrics[sortMetric] === 0) {
                item.metrics[sortMetric] = Math.floor(Math.random() * 8) + 1;
            }
        });

        setDartItems(newDartItems);
    }

    useEffect(() => {
        fetchDarts(board);

        return () => {
            setDartItems([]);
            setModalOpen(false);
            setSortMetric('heartlighted');
        }
    }, [board]);

    useEffect(() => {
        setModalOpen(!!activeDart?._id);
    }, [activeDart])

    const DartItem = ({ name, enneagram, onClick, shuffleDart }) =>
        <div className={classNames(`darts__item darts__item--${enneagram.toString(10)}`,
            { 'darts__item--shuffled': shuffleDart })} onClick={onClick}>
            {name}
        </div>

    return (
        <div className="page">
            <Header />
            {dartItems && ''}
            {modalOpen && <DartModal
                initialFields={activeDart}
                onClose={() => { setModalOpen(false); setActiveDart(initialFields)}}
                onSubmit={(fields) => {
                    const allFields = { ...fields, board };

                    if (!!activeDart['_id']) {
                        updateDart(allFields);
                        setActiveDart(initialFields);
                    } else {
                        addDart(allFields);
                    }
                    setTimeout(() => fetchDarts(board), 300);
                }}
            />}
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
                        >
                            <MenuItem value="Shows">Shows</MenuItem>
                            <MenuItem value="Movies">Movies</MenuItem>
                            <MenuItem value="Standup">Standup</MenuItem>
                            <MenuItem value="Marvel">Marvel</MenuItem>
                            <MenuItem value="Ghibli">Ghibli</MenuItem>
                        </Select>
                    </FormControl>
                </div>
                <Button onClick={() => {
                    const newShuffleDart = dartItems[Math.floor(Math.random() * dartItems.length)];
                    const sortedDarts = dartItems.sort((a, b) => {
                        if (a.metrics[sortMetric] > b.metrics[sortMetric]) {
                            return -1;
                        } else if (b.metrics[sortMetric] > a.metrics[sortMetric]) {
                            return 1;
                        }
                        return 0;
                    });
                    
                    console.log(sortedDarts);
                    let i = 0;
                    const goToNextDart = () => {
                        setShuffleDart(sortedDarts[i]);
                        if (i < sortedDarts.length) {
                            i++;
                        } else {
                            i = 0;
                        }
                    };

                    const interval = setInterval(goToNextDart, 100);
                    const timeoutLength = Math.floor((Math.random() * 3000)) + 1000;

                    setTimeout(() => {
                        clearInterval(interval);
                        const newInterval = setInterval(goToNextDart, 500);
                        
                        setTimeout(() => {
                            clearInterval(newInterval);
                            setShuffleDart(newShuffleDart);
                        }, 2500);
                    }, timeoutLength);
                }}>Shuffle!</Button>
                <button className='darts__btn' onClick={() => setModalOpen(true)}>+</button>
            </div>
            <div className="darts">
                <div className="darts__row">
                    {dartItems.filter(({ metrics }) => metrics[sortMetric] === 8).map((props) =>
                        <DartItem
                            {...props}
                            key={props['_id']}
                            onClick={() => setActiveDart(props)}
                            shuffleDart={props['_id'] === shuffleDart?._id}
                        />)}
                </div>
                <div className="darts__row">
                    {dartItems.filter(({ metrics }) => metrics[sortMetric] === 7).map((props) =>
                        <DartItem
                            {...props}
                            key={props['_id']}
                            onClick={() => setActiveDart(props)}
                            shuffleDart={props['_id'] === shuffleDart?._id}
                        />)}
                </div>
                <div className="darts__row">
                    {dartItems.filter(({ metrics }) => metrics[sortMetric] === 6).map((props) =>
                        <DartItem
                            {...props}
                            key={props['_id']}
                            onClick={() => setActiveDart(props)}
                            shuffleDart={props['_id'] === shuffleDart?._id}
                        />)}
                </div>
                <div className="darts__row">
                    {dartItems.filter(({ metrics }) => metrics[sortMetric] === 5).map((props) =>
                        <DartItem
                            {...props}
                            key={props['_id']}
                            onClick={() => setActiveDart(props)}
                            shuffleDart={props['_id'] === shuffleDart?._id}
                        />)}
                </div>
                <div className="darts__row">
                    {dartItems.filter(({ metrics }) => metrics[sortMetric] === 4).map((props) =>
                        <DartItem
                            {...props}
                            key={props['_id']}
                            onClick={() => setActiveDart(props)}
                            shuffleDart={props['_id'] === shuffleDart?._id}
                        />)}
                </div>
                <div className="darts__row">
                    {dartItems.filter(({ metrics }) => metrics[sortMetric] === 3).map((props) =>
                        <DartItem
                            {...props}
                            key={props['_id']}
                            onClick={() => setActiveDart(props)}
                            shuffleDart={props['_id'] === shuffleDart?._id}
                        />)}
                </div>
                <div className="darts__row">
                    {dartItems.filter(({ metrics }) => metrics[sortMetric] === 2).map((props) =>
                        <DartItem
                            {...props}
                            key={props['_id']}
                            onClick={() => setActiveDart(props)}
                            shuffleDart={props['_id'] === shuffleDart?._id}
                        />)}
                </div>
                <div className="darts__row">
                    {dartItems.filter(({ metrics }) => metrics[sortMetric] === 1).map((props) =>
                        <DartItem
                            {...props}
                            key={props['_id']}
                            onClick={() => setActiveDart(props)}
                            shuffleDart={props['_id'] === shuffleDart?._id}
                        />)}
                </div>
            </div>
        </div>
    );
}