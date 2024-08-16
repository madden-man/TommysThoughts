import React, { useState } from 'react';
import { addDart } from './server';

export const DartModal = ({ onClose }) => {
    const [fields, setFields] = useState(
        { name: '', description: '', rating: '', enneagram: '', metrics: ''});

    return (
        <div className='darts__modal-holder'>
            <div className='darts__modal'>
                <div className="darts__modal--field">
                    <span>Name</span>
                    <input type='text' value={fields.name} onChange={
                        (e) => setFields({ ...fields, name: e.target.value })} />
                </div>
                <div className="darts__modal--field">
                    <span>Description</span>
                    <input type='text' value={fields.description} onChange={
                        (e) => setFields({ ...fields, description: e.target.value })} />
                </div>
                <div className="darts__modal--field">
                    <span>Rating</span>
                    <input type='text' value={fields.rating} onChange={
                        (e) => setFields({ ...fields, rating: e.target.value })} />
                </div>
                <div className="darts__modal--field">
                    <span>Enneagram</span>
                    <input type='text' value={fields.enneagram} onChange={
                        (e) => setFields({ ...fields, enneagram: e.target.value })} />
                </div>
                <div className="darts__modal--field">
                    <span>Metrics</span>
                    <input type='text' value={fields.metrics} onChange={
                        (e) => setFields({ ...fields, metrics: e.target.value })} />
                </div>
                <button onClick={() => {
                    addDart({
                        ...fields,
                        rating: JSON.parse(fields.rating),
                        enneagram: JSON.parse(fields.enneagram),
                        metrics: JSON.parse(fields.metrics)
                    });
                    onClose();
                }}>Submit!</button>
            </div>
        </div>
    )
}