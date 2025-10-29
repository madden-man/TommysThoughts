import { ADDRESSES_OF_NOTE } from "./constants"


export async function distancesFromHere(originAddress) {
    const KEY = process.env.REACT_APP_MAPS_KEY;
    let distances = ADDRESSES_OF_NOTE;
    console.log(originAddress);
    const origin = `${originAddress.coords.latitude},${originAddress.coords.longitude}`;

    for (let i = 0; i < ADDRESSES_OF_NOTE.length; ++i) {
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(ADDRESSES_OF_NOTE[i].address)}&key=${KEY}`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.status === 'OK' && data.rows.length > 0 && data.rows[0].elements.length > 0) {
                const element = data.rows[0].elements[0];
                if (element.status === 'OK') {
                    distances[i].distance = element.distance.text;
                    distances[i].duration = element.duration.text;
                    console.log(distances[i]);
                }
            } else {
                console.error('Error in API response:', data.status);
                return null;
            }
        } catch (error) {
            console.error('Error fetching distance:', error);
            return null;
        }
    }

    return distances;
}