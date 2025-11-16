import { Helmet } from 'react-helmet';
//import { HIGH_SCHOOLS } from './constants';
import { NeighborhoodMap } from './NeighborhoodMap';

export const NeighborhoodPage = () => {
    const KEY = process.env.REACT_APP_MAPS_KEY;

    return (
        <div style={{width: '100%'}} className="page">
            <Helmet>
                <script async src={`https://maps.googleapis.com/maps/api/js?key=${KEY}&loading=async&callback=console.debug&libraries=maps,marker&v=beta`} />
            </Helmet>
            Neighborhood time!
            <NeighborhoodMap />
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