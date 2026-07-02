import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../components/Header';

import './bump.css';

const buttons = [
    { key: 'house', symbol: '🏠', label: 'House' },
    { key: 'hammer', symbol: '🔨', label: 'Hammer' },
    { key: 'paddle', symbol: '🏓', label: 'Paddle' },
];

export const BumperPage = () => {
    const navigate = useNavigate();

    return (
        <div className="page">
            <Header />
            <h1 className="bumper__title">Bump Bump</h1>
            <div className="bumper">
                {buttons.map(({ key, symbol, label }) =>
                    <button
                        key={key}
                        className="bumper__button"
                        aria-label={label}
                        onClick={() => navigate(`/bump?button=${key}`)}
                    >
                        {symbol}
                    </button>
                )}
            </div>
        </div>
    );
};
