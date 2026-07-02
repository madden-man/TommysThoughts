import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '../../components/Header';
import { getBumpHeader } from './constants';
import { sendBumpNotification } from './server';
import { BumpActivities } from './BumpActivities';

import './bump.css';

export const BumpPage = () => {
    const [searchParams] = useSearchParams();
    const button = searchParams.get('button');
    const header = getBumpHeader(button);

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
                <BumpActivities />
            </div>
        </div>
    );
};
