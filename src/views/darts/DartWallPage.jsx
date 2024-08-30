import React, { useEffect, useState } from 'react';

import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';

import { Header } from '../../components/Header';

import './darts.css';
import { getDarts, addDart, updateDart } from './server';
import { DartModal } from './DartModal';

export const DartWallPage = () => {

    const initialFields = { name: '', description: '', rating: 0, enneagram: '', metrics: { heartlighted: 0 }};
    const [sortMetric, setSortMetric] = useState('heartlighted');
    const [modalOpen, setModalOpen] = useState(false);
    const [board, setBoard] = useState('Shows');
    const [dartItems, setDartItems] = useState([]);
    const [activeDart, setActiveDart] = useState(initialFields);

    const fetchDarts = async(board) => {
        setDartItems(await getDarts(board));
    }

    useEffect(() => {
        fetchDarts(board);

        return () => {
            setDartItems([]);
            setModalOpen(false);
            setSortMetric('heartlighted');
        }
    }, []);

    useEffect(() => { fetchDarts(board); }, [board]);

    useEffect(() => {
        setModalOpen(!!activeDart?._id);
    }, [activeDart])

    let darts = dartItems.sort((a, b) => {
        if (a.rating > b.rating) {
            return -1;
        } else if (b.rating > a.rating) {
            return 1;
        }
        return 0;
    });

    darts.forEach((item) => {
        if (item.metrics?.heartlighted === 0) {
            item.metrics.heartlighted = Math.floor(Math.random() * 8) + 1;
        }
    })

    const DartItem = ({ name, enneagram, onClick }) =>
        <div className={`darts__item darts__item--${enneagram.toString(10)}`} onClick={onClick}>
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
                <button className='darts__btn' onClick={() => setModalOpen(true)}>+</button>
            </div>
            <div className="darts">
                <div className="darts__row">
                    {darts.filter(({ metrics }) => metrics[sortMetric] === 8)
                        .map((props) => <DartItem {...props} key={props['_id']} onClick={() => setActiveDart(props)} />)}
                </div>
                <div className="darts__row">
                    {darts.filter(({ metrics }) => metrics[sortMetric] === 7)
                        .map((props) => <DartItem {...props} key={props['_id']} onClick={() => setActiveDart(props)} />)}
                </div>
                <div className="darts__row">
                    {darts.filter(({ metrics }) => metrics[sortMetric] === 6)
                        .map((props) => <DartItem {...props} key={props['_id']} onClick={() => setActiveDart(props)} />)}
                </div>
                <div className="darts__row">
                    {darts.filter(({ metrics }) => metrics[sortMetric] === 5)
                        .map((props) => <DartItem {...props} key={props['_id']} onClick={() => setActiveDart(props)} />)}
                </div>
                <div className="darts__row">
                    {darts.filter(({ metrics }) => metrics[sortMetric] === 4)
                        .map((props) => <DartItem {...props} key={props['_id']} onClick={() => setActiveDart(props)} />)}
                </div>
                <div className="darts__row">
                    {darts.filter(({ metrics }) => metrics[sortMetric] === 3)
                        .map((props) => <DartItem {...props} key={props['_id']} onClick={() => setActiveDart(props)} />)}
                </div>
                <div className="darts__row">
                    {darts.filter(({ metrics }) => metrics[sortMetric] === 2)
                        .map((props) => <DartItem {...props} key={props['_id']} onClick={() => setActiveDart(props)} />)}
                </div>
                <div className="darts__row">
                    {darts.filter(({ metrics }) => metrics[sortMetric] === 1)
                        .map((props) => <DartItem {...props} key={props['_id']} onClick={() => setActiveDart(props)} />)}
                </div>
            </div>
        </div>
    );
}