import React, { useState, useEffect, useCallback } from 'react';
import Calendar from 'react-calendar';
import { Header } from '../../components/Header';

import 'react-calendar/dist/Calendar.css';
import { getCreativeCount, insertCreativeCount } from './server';
import { CreativeTimer } from './CreativeTimer';
import { CreativeScoreboard } from './CreativeScoreboard';
import { formatDate } from './utils';

export const CreativeCalendar = () => {
  const [value, onChange] = useState(new Date());
  const [creativeCounts, setCreativeCounts] = useState({});
  const [creativeCountIds, setCreativeCountIds] = useState({})
  
    const fetchCreativeCounts = useCallback(async() => {
        let computedCounts = {};
        let newCreativeCountIds = {};
        let newCreativeCounts = await getCreativeCount();
        newCreativeCounts.forEach((i) => {
            let date;
            Object.keys(i).forEach((key) => {
                if (key !== "_id") { date = key; }
            });
            newCreativeCountIds = { ...newCreativeCountIds, [date]: i._id };
            delete i._id;
            computedCounts = {
                ...computedCounts,
                ...i,
            };
        })
        setCreativeCounts(computedCounts);
        setCreativeCountIds(newCreativeCountIds);
    }, []);

    useEffect(() => {
        fetchCreativeCounts();
        
        return () => {
            setCreativeCountIds({});
            setCreativeCounts({});
        }
    }, [fetchCreativeCounts]);

    const formattedDate = formatDate(value);

    const updateCreativeCount = (points) => {
        const newCount = Number(points) + (creativeCounts?.[formattedDate] || 0);
        setCreativeCounts({
            ...creativeCounts,
            [formattedDate]: newCount,
        });
        insertCreativeCount({ [formattedDate]: newCount, '_id': creativeCountIds[formattedDate]});
    };

    return (
        <div>
            <Header />
            <Calendar onChange={onChange} value={value} tileContent={({ date }) => {
                const thisCount = creativeCounts?.[formatDate(date)] || 0;
                return <div style={{fontSize: '10px'}}>{thisCount > 0 && `{${Number(thisCount).toFixed(1)}}`}</div>
                }} />
            <CreativeTimer assignPoints={(points) => updateCreativeCount(points)}/>
            <CreativeScoreboard creativeCounts={creativeCounts} />
        </div>
    )
}