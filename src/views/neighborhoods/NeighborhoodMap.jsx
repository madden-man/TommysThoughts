import { useState, useEffect } from 'react';
import { APIProvider, Map } from '@vis.gl/react-google-maps';
import { ADDRESSES_OF_NOTE } from './constants';
import { distancesFromHere } from './server';

export const NeighborhoodMap = () => {
    const defaultCenter = { lat: 39.687828, lng: -105.086441 };
    //const defaultZoom = 15;

    const [distances, setDistances] = useState(ADDRESSES_OF_NOTE);

    useEffect(() => {
        async function requestDistances(originAddress) {
            const distances = await distancesFromHere(originAddress);
            console.log(distances);
            setDistances(distances);
        }

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => 
                requestDistances(position), (err) => console.log(err));
        }
    }, []);

    return (
        <div>
            <APIProvider apiKey={process.env.REACT_APP_MAPS_KEY} onLoad={() => console.log('Maps API has loaded.')}>
                <Map
                    defaultZoom={15}
                    defaultCenter={defaultCenter}
                    onCameraChanged={ (ev) =>
                        console.log('camera changed:', ev.detail.center, 'zoom:', ev.detail.zoom)
                    }
                >
                </Map>
            </APIProvider>
            <h2>Distances of Note :)</h2>
            <div style={{display: 'flex', flexDirection: 'row'}}>
            {distances?.map((info) => 
                <div style={{display: 'flex', flexDirection: 'column', marginRight: '1rem'}}>
                    <span>{info.title}</span>
                    <span>{info.distance}</span>
                    <span>{info.duration}</span>
                </div>)}
            </div>
        </div>
    )
}