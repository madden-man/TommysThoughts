import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../../components/Header';
import { BingoMenu } from './BingoMenu';
import './bingo.css';
import { getBingo } from './server';

export const BingoPage = () => {

    const [boards, setBoards] = useState([]);
    const [activeBoard, setActiveBoard] = useState({});

    const BingoRow = ({ row }) =>
        <div className="bingo-row">
            <div className="bingo-col1" contentEditable></div>
            <div className="bingo-col2" contentEditable></div>
            <div className="bingo-col3" contentEditable></div>
            <div className="bingo-col4" contentEditable></div>
            <div className="bingo-col5" contentEditable></div>
        </div>

    const fetchBoards = useCallback(async () => {
        const boards = getBingo();
        setBoards(boards);
        setActiveBoard(boards[0] || { title: 'Long Term Bets', rows: [[],[],[],[],[]]});
    }, [])

    useEffect(fetchBoards, [fetchBoards]);

    if (!activeBoard?.title) return null;

    return (
        <>
            <Header />
            <div className="bingo">
                <BingoMenu board={activeBoard?.title || 'Long Term Bets'} />
                <div>
                    <BingoRow row={activeBoard?.rows[0]} />
                    <BingoRow row={activeBoard?.rows[1]} />
                    <BingoRow row={activeBoard?.rows[2]} />
                    <BingoRow row={activeBoard?.rows[3]} />
                    <BingoRow row={activeBoard?.rows[4]} />
                </div>
            </div>
        </>
    )
}