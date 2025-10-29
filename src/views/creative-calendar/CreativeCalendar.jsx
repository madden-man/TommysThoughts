import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import { Header } from '../../components/Header';

import 'react-calendar/dist/Calendar.css';
import { getCreativeCount, insertCreativeCount } from './server';
import { CreativeTimer } from './CreativeTimer';
import { formatDate } from './utils';

export const CreativeCalendar = () => {
  const [value, onChange] = useState(new Date());
  const [creativeCounts, setCreativeCounts] = useState({});

    useEffect(() => {
        const creativeCountsFromServer = getCreativeCount();
        setCreativeCounts(creativeCountsFromServer);
    }, []);

    const formattedDate = formatDate(value);

    useEffect(() => {
        insertCreativeCount({ [formattedDate]: creativeCounts[formattedDate] });
    }, [creativeCounts]);

    return (
        <div>
            <Header />
            <Calendar onChange={onChange} value={value} tileContent={({ date }) =>
                <div style={{fontSize: '10px'}}>{`{${creativeCounts[date] || 0}}`}</div>} />
            {formattedDate}
            {JSON.stringify(creativeCounts)}
            <CreativeTimer assignPoints={(points) => setCreativeCounts({
                ...creativeCounts,
                [formattedDate]: points + (creativeCounts[formattedDate] || 0)
            })}/>
        </div>
    )
}