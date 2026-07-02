import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '../../components/Header';
import { sendBumpNotification } from './server';

import './bump.css';

export const BumpPage = () => {
    const [searchParams] = useSearchParams();
    const button = searchParams.get('button');

    useEffect(() => {
        if (button) {
            sendBumpNotification(button);
        }
    }, [button]);

    return (
        <div className="page">
            <Header />
            <div className="bump">
                {button
                    ? <p>You clicked the <strong>{button}</strong> button.</p>
                    : <p>No button was clicked.</p>}
            </div>
        </div>
    );
};
