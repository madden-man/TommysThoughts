import React, { useState } from 'react';
import Rating from '@mui/material/Rating';

export const DartModal = ({ initialFields, onSubmit, onClose }) => {
    const [fields, setFields] = useState(initialFields);

    return (
        <div className='darts__modal-holder'>
            <div className='darts__modal'>
                <h2>{initialFields._id ? 'Update' : 'Add'} a Show!</h2>
                <button className='darts__modal--x' onClick={() => onClose()}>x</button>
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
                    <Rating
                        name="simple-controlled"
                        value={fields.rating}
                        onChange={(event, newValue) => {
                            setFields({ ...fields, rating: newValue });
                        }}
                    />
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
                    onSubmit({
                        ...fields,
                        rating: JSON.parse(fields.rating),
                        enneagram: JSON.parse(fields.enneagram),
                        metrics: JSON.parse(`{${fields.metrics}}`)
                    });
                    onClose();
                }}>{initialFields._id ? 'Update!' : 'Submit!'}</button>
            </div>
        </div>
    )
}