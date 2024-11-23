import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../../components/Header';
import { BingoMenu } from './BingoMenu';
import './bingo.css';
import { getBingo, upsertBoard } from './server';

export const BingoPage = () => {

    const [boards, setBoards] = useState([]);
    const [activeBoard, setActiveBoard] = useState({});

    const updateRow = (row, col, text) => {
        console.log(text);
        let newBoard = activeBoard;
        console.log(newBoard);
        newBoard.rows[row][col] = text;
        upsertBoard(newBoard);
        setActiveBoard(newBoard);
    }

    const BingoRow = ({ row }) => !activeBoard?.rows?.[row] ? null :
        <div className="bingo-row">
            <div className="bingo-col1" contentEditable onInput={(event) =>
                updateRow(row, 0, event.target.innerText)}>{activeBoard?.rows[row][0] || ''}</div>
            <div className="bingo-col2" contentEditable onInput={(event) =>
                updateRow(row, 1, event.target.innerText)}>{activeBoard?.rows[row][1] || ''}</div>
            <div className="bingo-col3" contentEditable onInput={(event) =>
                updateRow(row, 2, event.target.innerText)}>{activeBoard?.rows[row][2] || ''}</div>
            <div className="bingo-col4" contentEditable onInput={(event) =>
                updateRow(row, 3, event.target.innerText)}>{activeBoard?.rows[row][3] || ''}</div>
            <div className="bingo-col5" contentEditable onInput={(event) =>
                updateRow(row, 4, event.target.innerText)}>{activeBoard?.rows[row][4] || ''}</div>
        </div>

    const fetchBoards = useCallback(async () => {
        const boards = await getBingo();
        setBoards(boards || [{ title: 'Long Term Bets', rows: [[],[],[],[],[]]}]);
        setActiveBoard(boards[0] || { title: 'Long Term Bets', rows: [[],[],[],[],[]]});
    }, [])

    useEffect(() => {
        fetchBoards();

        return () => {
            setBoards([]);
            setActiveBoard({});
        }
    }, [fetchBoards]);

    if (!boards) return null;

    console.log(activeBoard);

    return (
        <div className="page">
            <Header />
            <div className="bingo">
                <BingoMenu board={activeBoard?.title || 'Long Term Bets'} options={boards} />
                <div>
                    <BingoRow row={0} />
                    <BingoRow row={1} />
                    <BingoRow row={2} />
                    <BingoRow row={3} />
                    <BingoRow row={4} />
                </div>
            </div>
        </div>
    )
}