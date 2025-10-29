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

    const fetchCreativeCounts = async () => {
        let newCreativeCounts = await getCreativeCount();
        setCreativeCounts(newCreativeCounts);
    };

    useEffect(() => {
        fetchCreativeCounts();
    }, []);

    const formattedDate = formatDate(value);

    const updateCreativeCount = (points) => {
        const newCount = {
            [formattedDate]: points + (creativeCounts[formattedDate] || 0)
        };
        setCreativeCounts({
            ...creativeCounts,
            ...newCount
        });
        insertCreativeCount(newCount);
    };

    return (
        <div>
            <Header />
            <Calendar onChange={onChange} value={value} tileContent={({ date }) =>
                <div style={{fontSize: '10px'}}>{`{${creativeCounts[date] || 0}}`}</div>} />
            {formattedDate}
            {JSON.stringify(creativeCounts)}
            <CreativeTimer assignPoints={(points) => updateCreativeCount(points)}/>
        </div>
    )
}