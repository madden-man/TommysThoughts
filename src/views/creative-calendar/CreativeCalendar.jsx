import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import { Header } from '../../components/Header';

import 'react-calendar/dist/Calendar.css';
import { getCreativeCount, insertCreativeCount } from './server';
import { CreativeTimer } from './CreativeTimer';
import { formatDate } from './utils';

export const CreativeCalendar = () => {
  const [value, onChange] = useState(new Date());
  const [creativeCounts, setCreativeCounts] = useState([]);

    const fetchCreativeCounts = async () => {
        let newCreativeCounts = await getCreativeCount();
        setCreativeCounts(newCreativeCounts);
    };

    useEffect(() => {
        fetchCreativeCounts();
    }, []);

    const formattedDate = formatDate(value);

    const findCreativeCount = (creativeCounts, dateToFind) => {
        let countItem = creativeCounts?.find((item) => Object.keys(item).includes(dateToFind));
        return countItem;
    }

    const updateCreativeCount = (points) => {
        const existingCountItem = findCreativeCount(creativeCounts, formattedDate);
        const newCount = {
            ...existingCountItem,
            [formattedDate]: Number(points) + (existingCountItem?.[formattedDate] || 0)
        };

        console.log(newCount);
        setCreativeCounts({
            ...creativeCounts,
            ...newCount
        });
        insertCreativeCount(newCount);
    };

    return (
        <div>
            <Header />
            <Calendar onChange={onChange} value={value} tileContent={({ date }) => {
                const thisCount = findCreativeCount(creativeCounts, formatDate(date))?.[formatDate(date)] || 0;
                return <div style={{fontSize: '10px'}}>{thisCount > 0 && `{${Number(thisCount).toFixed(1)}}`}</div>
                }} />
            <CreativeTimer assignPoints={(points) => updateCreativeCount(points)}/>
        </div>
    )
}