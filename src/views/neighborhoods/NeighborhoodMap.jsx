import { Map, Marker } from '@vis.gl/react-google-maps';
import { HIGH_SCHOOLS } from './constants';

export const NeighborhoodMap = () => {
    const defaultCenter = { lat: 39.687828, long: -105.086441 };
    const defaultZoom = 15;

    return (
        <Map
            center={defaultCenter}
            zoom={defaultZoom}
        >
            {/* {HIGH_SCHOOLS.map(({ lat, long, title, rating}, index) =>
                <Marker key={index} position={`${lat}, ${long}`} title={`${title} -- ${rating}/10`} />)} */}
        </Map>
    )
}