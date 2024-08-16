import React, { useEffect, useState } from 'react';
import { Header } from '../../components/Header';
import { mockDarts } from './mockDarts';

import './darts.css';
import { getDarts } from './server';
import { DartModal } from './DartModal';

export const DartWallPage = () => {

    const [sortMetric, setSortMetric] = useState('lighthearted');
    const [modalOpen, setModalOpen] = useState(false);
    const [dartItems, setDartItems] = useState([]);

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

    if (!mockDarts) { return null; }

    let darts = mockDarts.sort((a, b) => {
        if (a.rating > b.rating) {
            return -1;
        } else if (b.rating > a.rating) {
            return 1;
        }
        return 0;
    })

    const DartItem = ({ name, enneagram }) =>
        <div className={`darts__item darts__item--${enneagram.toString(10)}`}>
            {name}
        </div>

    return (
        <div className="page">
            <Header />
            {dartItems && ''}
            {modalOpen && <DartModal onClose={() => setModalOpen(false)} />}
            <div className="darts__menu">
                <h1 className='darts__title'>Darts</h1>
                <button className='darts__btn' onClick={() => setModalOpen(true)}>+</button>
            </div>
            <div className="darts">
                <div className="darts__row">
                    {darts.filter(({ metrics }) => metrics[sortMetric] === 8)
                        .map((props) => <DartItem {...props} key={props['_id']} />)}
                </div>
                <div className="darts__row">
                    {darts.filter(({ metrics }) => metrics[sortMetric] === 7)
                        .map((props) => <DartItem {...props} key={props['_id']} />)}
                </div>
                <div className="darts__row">
                    {darts.filter(({ metrics }) => metrics[sortMetric] === 6)
                        .map((props) => <DartItem {...props} key={props['_id']} />)}
                </div>
                <div className="darts__row">
                    {darts.filter(({ metrics }) => metrics[sortMetric] === 5)
                        .map((props) => <DartItem {...props} key={props['_id']} />)}
                </div>
                <div className="darts__row">
                    {darts.filter(({ metrics }) => metrics[sortMetric] === 4)
                        .map((props) => <DartItem {...props} key={props['_id']} />)}
                </div>
                <div className="darts__row">
                    {darts.filter(({ metrics }) => metrics[sortMetric] === 3)
                        .map((props) => <DartItem {...props} key={props['_id']} />)}
                </div>
                <div className="darts__row">
                    {darts.filter(({ metrics }) => metrics[sortMetric] === 2)
                        .map((props) => <DartItem {...props} key={props['_id']} />)}
                </div>
                <div className="darts__row">
                    {darts.filter(({ metrics }) => metrics[sortMetric] === 1)
                        .map((props) => <DartItem {...props} key={props['_id']} />)}
                </div>
            </div>
        </div>
    );
}