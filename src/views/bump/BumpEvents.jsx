import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BUMP_BUTTONS, getBumpKeyForSymbol } from './constants';
import { CalendarIcon, LinkOutIcon } from './icons';
import { sendActivityQuestion } from './server';
import { LOCAL_EVENTS } from './localEventsData';
import {
    BUCKETS,
    askAbout,
    eventsForBucket,
    formatDay,
    formatTime,
    todayIso,
    weekFrom,
} from './localEvents';

const EMPTY = {
    today: 'Nothing to just show up to that day. Try another day, or Anytime.',
    signup: 'Nothing to sign up for right now.',
    anytime: 'No anytime spots under this one.',
};

// The left column: when it is, in the shape that bucket cares about.
const When = ({ bucket, date, event }) => {
    if (bucket === 'anytime') {
        return <div className="bump-event__when bump-event__when--hours">{event.hours}</div>;
    }
    const top = bucket === 'signup' ? formatDay(date) : formatTime(event.time) || 'all day';
    const under = bucket === 'signup'
        ? formatTime(event.time)
        : event.end && `to ${formatTime(event.end)}`;
    return (
        <div className="bump-event__when">
            {top}
            {under && <small>{under}</small>}
        </div>
    );
};

// What's on around Evergreen, above the activities. Opens on today's show-up
// events, narrowed to whichever bump brought you here.
export const BumpEvents = ({ initialFilter = null, events = LOCAL_EVENTS, today = todayIso() }) => {
    const navigate = useNavigate();
    const [bucket, setBucket] = useState('today');
    const [day, setDay] = useState(today);
    const [filter, setFilter] = useState(initialFilter);
    const [sentId, setSentId] = useState(null);
    const sentTimer = useRef(null);

    useEffect(() => () => clearTimeout(sentTimer.current), []);

    const week = useMemo(() => weekFrom(today), [today]);
    const all = useMemo(
        () => eventsForBucket(bucket, events, { today, day }),
        [bucket, events, today, day],
    );
    const counts = useMemo(() => Object.fromEntries(
        BUCKETS.map(({ key }) => [key, eventsForBucket(key, events, { today, day }).length]),
    ), [events, today, day]);
    const visible = filter ? all.filter(({ event }) => event.symbol === filter) : all;
    const countFor = (symbol) => all.filter(({ event }) => event.symbol === symbol).length;

    const rowKey = ({ event, date }) => `${event.id}-${date ?? 'any'}`;

    const ask = (item) => {
        sendActivityQuestion(askAbout(item));
        setSentId(rowKey(item));
        clearTimeout(sentTimer.current);
        sentTimer.current = setTimeout(() => setSentId(null), 1800);
    };

    // Same handoff the activity rows use, with the day, time and place filled in.
    const putOnADay = ({ event, date }) => navigate('/calendar', {
        state: {
            scheduleActivity: {
                header: event.title,
                symbol: event.symbol,
                date: date ?? undefined,
                time: event.time ?? undefined,
                notes: [event.venue, event.town].filter(Boolean).join(', '),
            },
        },
    });

    return (
        <section className="bump-events" aria-labelledby="bump-events-title">
            <h2 className="bump-activities__title" id="bump-events-title">Around Evergreen</h2>
            <p className="bump-activities__hint">Show up, sign up, or go whenever.</p>

            <div className="bump-events__tabs" role="tablist" aria-label="When">
                {BUCKETS.map(({ key, label, hint }) => (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={bucket === key}
                        className={'bump-events__tab' + (bucket === key ? ' bump-events__tab--on' : '')}
                        onClick={() => setBucket(key)}
                    >
                        {label}
                        <small>{hint} · {counts[key]}</small>
                    </button>
                ))}
            </div>

            {bucket === 'today' && (
                <div className="bump-events__days" aria-label="Day">
                    {week.map((iso) => {
                        const [weekday, date] = formatDay(iso).split(' ');
                        return (
                            <button
                                key={iso}
                                type="button"
                                aria-pressed={day === iso}
                                className={'bump-events__day' + (day === iso ? ' bump-events__day--on' : '')}
                                onClick={() => setDay(iso)}
                            >
                                {iso === today ? 'Today' : weekday}
                                <strong>{date}</strong>
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="bump-activities__filters">
                <button
                    type="button"
                    className={'bump-filter' + (filter === null ? ' bump-filter--on' : '')}
                    onClick={() => setFilter(null)}
                >
                    <span className="bump-filter__label">Everything</span>
                    <span className="bump-filter__count">{all.length}</span>
                </button>
                {BUMP_BUTTONS.map(({ key, symbol, header }) => (
                    <button
                        key={key}
                        type="button"
                        aria-label={header}
                        className={`bump-filter bump-filter--${key}`
                            + (filter === symbol ? ' bump-filter--on' : '')}
                        onClick={() => setFilter(filter === symbol ? null : symbol)}
                    >
                        <span className="bump-filter__symbol">{symbol}</span>
                        <span className="bump-filter__count">{countFor(symbol)}</span>
                    </button>
                ))}
            </div>

            <ul className="bump-activities__list">
                {visible.length === 0 && <li className="bump-activities__empty">{EMPTY[bucket]}</li>}
                {visible.map((item) => {
                    const { event, date } = item;
                    const kind = getBumpKeyForSymbol(event.symbol);
                    const key = rowKey(item);
                    return (
                        <li
                            key={key}
                            className={`bump-event${kind ? ` bump-event--${kind}` : ''}`
                                + (sentId === key ? ' bump-event--sent' : '')}
                        >
                            <When bucket={bucket} date={date} event={event} />
                            <div className="bump-event__what">
                                <button
                                    type="button"
                                    className="bump-event__title"
                                    onClick={() => ask(item)}
                                    title={`Ask "${askAbout(item)}?"`}
                                >
                                    {event.title}
                                    <span className="bump-activity__sent" aria-live="polite">
                                        {sentId === key ? 'sent!' : ''}
                                    </span>
                                </button>
                                <div className="bump-event__where">
                                    {[event.venue, event.town].filter(Boolean).join(', ')}
                                    {event.cost && ` · ${event.cost}`}
                                </div>
                                <div className="bump-event__chips">
                                    {event.card && <span className="bump-event__chip bump-event__chip--card">{event.card}</span>}
                                    {event.signup && (
                                        <a
                                            className="bump-event__chip bump-event__chip--due"
                                            href={event.signup.url}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            {event.signup.note || 'sign up'}
                                        </a>
                                    )}
                                    {!event.confirmed && (
                                        <span className="bump-event__chip bump-event__chip--check">check first</span>
                                    )}
                                </div>
                            </div>
                            <span className="bump-activity__actions bump-event__actions">
                                {date && (
                                    <button
                                        type="button"
                                        className="bump-icon-button bump-icon-button--schedule"
                                        title={`Put "${event.title}" on a day`}
                                        aria-label={`Put "${event.title}" on a day`}
                                        onClick={() => putOnADay(item)}
                                    >
                                        <CalendarIcon />
                                    </button>
                                )}
                                {event.url && (
                                    <a
                                        className="bump-icon-button"
                                        href={event.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        title="Open its page"
                                        aria-label={`Open the page for "${event.title}"`}
                                    >
                                        <LinkOutIcon />
                                    </a>
                                )}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
};
