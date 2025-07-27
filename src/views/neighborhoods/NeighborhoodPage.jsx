import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { HIGH_SCHOOLS } from './constants';

export const NeighborhoodPage = () => {
    const KEY = process.env.REACT_APP_MAPS_KEY;

    return (
        <div style={{width: '100%'}}>
            <Helmet>
                <script async src={`https://maps.googleapis.com/maps/api/js?key=${KEY}&loading=async&callback=console.debug&libraries=maps,marker&v=beta`} />
            </Helmet>
            Neighborhood time!
            <div id="map"></div>
            <gmp-map center="39.687828,-105.086441" zoom="15" map-id="DEMO_MAP_ID">
                <gmp-advanced-marker position="39.687828,-105.086441" title="Home!"></gmp-advanced-marker>
                {HIGH_SCHOOLS.map(({ lat, long, title, rating}) =>
                    <gmp-advanced-marker position={{ lat, long }} title={`${title} - ${rating}`}></gmp-advanced-marker>
            )}
            </gmp-map>
        </div>
    )
}

/*

 <APIProvider apiKey={'Your API key here'} onLoad={() => console.log('Maps API has loaded.')}>
   <Map
      defaultZoom={13}
      defaultCenter={ { lat: -33.860664, lng: 151.208138 } }
      onCameraChanged={ (ev: MapCameraChangedEvent) =>
        console.log('camera changed:', ev.detail.center, 'zoom:', ev.detail.zoom)
      }>
   </Map>
 </APIProvider>

 */