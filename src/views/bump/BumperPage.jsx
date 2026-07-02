import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../components/Header';
import { BUMP_BUTTONS } from './constants';

import './bump.css';

export const BumperPage = () => {
    const navigate = useNavigate();

    return (
        <div className="page">
            <Header />
            <h1 className="bumper__title">Bump Bump</h1>
            <div className="bumper">
                {BUMP_BUTTONS.map(({ key, symbol, header }) =>
                    <div key={key} className="bumper__item">
                        <button
                            className="bumper__button"
                            aria-label={header}
                            onClick={() => navigate(`/bump?button=${key}`)}
                        >
                            {symbol}
                        </button>
                        <h2 className="bumper__label">{header}</h2>
                    </div>
                )}
            </div>
        </div>
    );
};
