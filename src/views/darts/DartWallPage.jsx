import React, { useEffect, useState, useCallback } from 'react';

import { Header } from '../../components/Header';

import { getDarts, addDart, updateDart } from './server';
import { DartModal } from './DartModal';
import { DartWall } from './DartWall';
import { DartMenu } from './DartMenu';

import './darts.css';


export const DartWallPage = () => {

    const initialFields = { name: '', description: '', rating: 0, enneagram: '', metrics: { heartlighted: 0 }};
    const [sortMetric, setSortMetric] = useState('heartlighted');
    const [modalOpen, setModalOpen] = useState(false);
    const [board, setBoard] = useState('Shows');
    const [dartItems, setDartItems] = useState([]);
    const [shuffleDart, setShuffleDart] = useState([]);
    const [activeDart, setActiveDart] = useState(initialFields);

    const fetchDarts = useCallback(async () => {
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
    }, [board, sortMetric]);

    useEffect(() => {
        fetchDarts();

        return () => {
            setDartItems([]);
            setModalOpen(false);
            setSortMetric('heartlighted');
        }
    }, [fetchDarts]);

    useEffect(() => {
        setModalOpen(!!activeDart?._id);
    }, [activeDart])

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
                    setTimeout(() => fetchDarts(), 300);
                }}
            />}
            <DartMenu
                dartItems={dartItems}
                setShuffleDart={setShuffleDart}
                setModalOpen={setModalOpen}
                board={board}
                setBoard={setBoard}
                sortMetric={sortMetric}
            />
            <DartWall
                dartItems={dartItems}
                setActiveDart={setActiveDart}
                shuffleDart={shuffleDart}
                sortMetric={sortMetric}
            />
        </div>
    );
}