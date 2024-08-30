import React, { useEffect, useState } from 'react';
import Rating from '@mui/material/Rating';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Slider from '@mui/material/Slider';
import TextField from '@mui/material/TextField';
import { Button } from '@mui/material';

export const DartModal = ({ initialFields, onSubmit, onClose }) => {
    const [fields, setFields] = useState(initialFields);

    useEffect(() => {
        const handleEscKey = (e) => {
            if (e.keyCode === 27) {
                onClose();
            }
        };

        document.addEventListener('keyPress', handleEscKey);

        return () => {
            document.removeEventListener('keyPress', handleEscKey);
        }
    }, [onClose]);

    return (
        <div className='darts__modal-holder'>
            <div className='darts__modal'>
                <h2>{initialFields._id ? 'Update' : 'Add'} a Show!</h2>
                <button className='darts__modal--x' onClick={() => onClose()}>x</button>
                <div className="darts__modal--field">
                    <TextField
                        id="standard-basic"
                        label="Name"
                        variant="standard"
                        value={fields.name}
                        onChange={(e) => setFields({ ...fields, name: e.target.value })}
                    />
                </div>
                <div className="darts__modal--field">
                    <span className='darts__span'>Rating</span>
                    <Rating
                        name="simple-controlled"
                        value={fields.rating}
                        precision={0.5}
                        onChange={(event, newValue) => {
                            setFields({ ...fields, rating: newValue });
                        }}
                    />
                </div>
                <div className="darts__modal--field">
                    <TextField
                        id="standard-basic"
                        label="Description"
                        multiline
                        minRows={2}
                        value={fields.description}
                        onChange={(e) => setFields({ ...fields, description: e.target.value })}
                    />
                </div>
                <div className="darts__modal--field">
                    <span className='darts__span'>Enneagram</span>
                    <FormControl sx={{ minWidth: 120 }} size="small">
                        <Select
                            labelId="demo-simple-select-label"
                            id="demo-simple-select"
                            value={fields.enneagram}
                            label="Enneagram"
                            onChange={(e) => setFields({ ...fields, enneagram: e.target.value })}
                        >
                            <MenuItem value={1}>One</MenuItem>
                            <MenuItem value={2}>Two</MenuItem>
                            <MenuItem value={3}>Three</MenuItem>
                            <MenuItem value={4}>Four</MenuItem>
                            <MenuItem value={5}>Five</MenuItem>
                            <MenuItem value={6}>Six</MenuItem>
                            <MenuItem value={7}>Seven</MenuItem>
                            <MenuItem value={8}>Eight</MenuItem>
                            <MenuItem value={9}>Nine</MenuItem>
                        </Select>
                    </FormControl>
                </div>
                <div className="darts__modal--field">
                    {Object.keys(fields.metrics).map((key) => (
                        <div className='darts__modal--field-tag'>
                            {key !== 'heartlighted' && <div className="darts__modal--field-x" onClick={() => {
                                let newFields = fields;
                                delete newFields?.metrics[key];
                                console.log(newFields);
                                setFields(fields);
                            }}>x</div>}
                            <TextField
                                id="standard-basic"
                                label="Tag"
                                variant="standard"
                                value={key}
                                onChange={(e) => {
                                    const newFields = { ...fields,
                                        metrics: { ...fields.metrics, [e.target.value]: fields.metrics[key] }};
                                    
                                    delete newFields.metrics[key];
                                    setFields(newFields);
                                }}
                            /> 
                            <Slider
                                aria-label={key}
                                style={{marginLeft: '0.5rem'}}
                                valueLabelDisplay="auto"
                                shiftStep={1}
                                step={1}
                                marks
                                min={0}
                                max={8}
                                value={fields.metrics[key]}
                                onChange={(e) => setFields({ ...fields,
                                    metrics: { ...fields.metrics, [key]: e.target.value}})}
                            />
                        </div>
                    ))}
                    <Button variant="outlined" onClick={() =>
                        setFields({ ...fields, metrics: { ...fields.metrics, '': 0 }})}>
                        Add a Tag!
                    </Button>
                </div>
                <Button variant="contained" style={{marginTop: '1rem'}} onClick={() => {
                    onSubmit(fields);
                    onClose();
                }}>
                    {initialFields._id ? 'Update!' : 'Submit!'}
                </Button>
            </div>
        </div>
    )
}