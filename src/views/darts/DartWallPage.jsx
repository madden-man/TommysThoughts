import React, { useEffect, useState } from 'react';
import { Header } from '../../components/Header';
import { mockDarts } from './mockDarts';

import './darts.css';
import { getDarts, addDart, updateDart } from './server';
import { DartModal } from './DartModal';

export const DartWallPage = () => {

    const initialFields = { name: '', description: '', rating: '', enneagram: '', metrics: ''};
    const [sortMetric, setSortMetric] = useState('lighthearted');
    const [modalOpen, setModalOpen] = useState(false);
    const [dartItems, setDartItems] = useState([]);
    const [activeDart, setActiveDart] = useState(initialFields);

    useEffect(() => {
        (async() => {
            setDartItems(await getDarts());
        })();
        return () => {
            setDartItems([]);
            setModalOpen(false);
            setSortMetric('lighthearted');
        }
    }, []);

    useEffect(() => {
        setModalOpen(!!activeDart?._id);
    }, [activeDart])

    if (!mockDarts) { return null; }

    let darts = mockDarts.sort((a, b) => {
        if (a.rating > b.rating) {
            return -1;
        } else if (b.rating > a.rating) {
            return 1;
        }
        return 0;
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
                    if (!!activeDart['_id']) {
                        updateDart(fields);
                        setActiveDart(initialFields);
                    } else {
                        addDart(fields);
                    }
                }}
            />}
            <div className="darts__menu">
                <h1 className='darts__title'>Darts</h1>
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