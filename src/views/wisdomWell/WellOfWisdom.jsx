import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import './well-of-wisdom.css';
import { WellOfWisdomModal } from './WellOfWisdomModal';
import { getWisdom } from './server';
import { WellOfWisdomView } from './WellOfWisdomView';
import { WellOfWisdomSearch } from './WellOfWisdomSearch';

export const WellOfWisdom = () => {
    const [allWisdom, setAllWisdom] = useState([]);
    const [currentNugget, setNugget] = useState({});
    const [modalStatus, setModalStatus] = useState('closed');
    const [urlParam] = useSearchParams();

    const searchFromParam = urlParam.get('search');

    const fetchWisdom = useCallback(async() => {
        const fetchedWisdom = await getWisdom();
        setAllWisdom(fetchedWisdom);
        if (fetchedWisdom.length > 0) {
            const whichNugget = Math.floor(Math.random() * fetchedWisdom.length);
            setNugget({ ...fetchedWisdom[whichNugget], index: whichNugget });
        }
    }, []);
    
    useEffect(() => {
        fetchWisdom();
        
        return () => {
            setAllWisdom([]);
        }
    }, [fetchWisdom]);

    return (
        <div className="well-of-wisdom">
            {modalStatus === 'closed' ? null :
                <WellOfWisdomModal
                    nugget={modalStatus === 'edit' ? currentNugget : {}}
                    onClose={() => setModalStatus('closed')}
                />}
            <h2 style={{textAlign: 'center'}}>Well O' Wisdom!</h2>
            <WellOfWisdomView
                allWisdom={allWisdom}
                currentNugget={currentNugget}
                initialView={searchFromParam}
                editThisOne={(nugget) => { setNugget(nugget); setModalStatus('edit')}}
            />
            <div className="well-of-wisdom__toolbar">
                <div className="well-of-wisdom__toolbar--buttons">
                    <button onClick={() => {
                        let currentIndex = currentNugget?.index;
                        if (currentIndex === 0) {
                            setNugget({ ...allWisdom[allWisdom?.length - 1], index: allWisdom?.length - 1 });
                        } else {
                            setNugget({ ...allWisdom[currentIndex  - 1], index: currentIndex - 1 })
                        }
                    }}>&lt;</button>
                    <button onClick={() => setModalStatus('add')}>+</button>
                    <button onClick={() => {
                        let newIndex = Math.floor(Math.random() * allWisdom?.length);
                        setNugget({ ...allWisdom[newIndex], index: newIndex });
                    }}>Shuffle!</button>
                    <button onClick={() => setModalStatus('edit')}>e</button>
                    <button onClick={() => {
                        let currentIndex = currentNugget?.index;
                        if (currentIndex === allWisdom?.length - 1) {
                            setNugget({ ...allWisdom[0], index: 0 });
                        } else {
                            setNugget({ ...allWisdom[currentIndex + 1], index: currentIndex + 1 })
                        }
                    }}>&gt;</button>
                </div>
            </div>
            <WellOfWisdomSearch allWisdom={allWisdom} />
        </div>
    )
}