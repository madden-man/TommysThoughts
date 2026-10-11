import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '../../components/Header';
import { getBumpHeader, getBumpSymbol } from './constants';
import { sendBumpNotification } from './server';
import { BumpActivities } from './BumpActivities';
import { BumpEvents } from './BumpEvents';

import './bump.css';

export const BumpPage = () => {
    const [searchParams] = useSearchParams();
    const button = searchParams.get('button');
    const header = getBumpHeader(button);
    const initialFilter = getBumpSymbol(button);

    useEffect(() => {
        if (header) {
            sendBumpNotification(header);
        }
    }, [header]);

    return (
        <div className="page">
            <Header />
            <div className="bump">
                {header && <p>You're up for a <strong>{header}</strong>.</p>}
                <BumpEvents initialFilter={initialFilter} />
                <BumpActivities initialFilter={initialFilter} />
            </div>
        </div>
    );
};
