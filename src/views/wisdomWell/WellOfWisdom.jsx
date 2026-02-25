import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import './well-of-wisdom.css';
import { WellOfWisdomModal } from './WellOfWisdomModal';
import { getWisdom } from './server';
import { WellOfWisdomView } from './WellOfWisdomView';
import { WellOfWisdomSearch } from './WellOfWisdomSearch';
import { WellOfWisdomCatalog } from './WellOfWisdomCatalog';

export const WellOfWisdom = () => {
    const [allWisdom, setAllWisdom] = useState([]);
    const [currentNugget, setNugget] = useState({});
    const [modalStatus, setModalStatus] = useState('closed');
    const [urlParam] = useSearchParams();

    const searchFromParam = urlParam.get('search');
    const catalogParam = urlParam.get('catalog');

    const upTheNugget = useCallback(() => {
        setNugget(prev => {
            if (!allWisdom.length) return prev;

            const nextIndex =
                prev.index === allWisdom.length - 1
                    ? 0
                    : prev.index + 1;

            return { ...allWisdom[nextIndex], index: nextIndex };
        });
    }, [allWisdom]);

    const downTheNugget = useCallback(() => {
        setNugget(prev => {
            if (!allWisdom.length) return prev;

            const nextIndex =
                prev.index === 0
                    ? allWisdom.length - 1
                    : prev.index - 1;

            return { ...allWisdom[nextIndex], index: nextIndex };
        });
    }, [allWisdom]);

    const fetchWisdom = useCallback(async() => {
        const fetchedWisdom = await getWisdom();
        setAllWisdom(fetchedWisdom);
        if (fetchedWisdom.length > 0) {
            const whichNugget = fetchedWisdom.length - 1; // last one to start
            setNugget({ ...fetchedWisdom[whichNugget], index: whichNugget });
        }
    }, []);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === "ArrowRight") upTheNugget();
            if (event.key === "ArrowLeft") downTheNugget();
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [upTheNugget, downTheNugget]);
    
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
            {!catalogParam ? <WellOfWisdomView
                allWisdom={allWisdom}
                currentNugget={currentNugget}
                initialView={searchFromParam}
                editThisOne={(nugget) => { setNugget(nugget); setModalStatus('edit')}}
            /> : <WellOfWisdomCatalog allWisdom={allWisdom} catalogParam={catalogParam} />}
            <div className="well-of-wisdom__toolbar">
                <div className="well-of-wisdom__toolbar--buttons">
                    <button onClick={downTheNugget}>&lt;</button>
                    <button onClick={() => setModalStatus('add')}>+</button>
                    <button onClick={() => {
                        let newIndex = Math.floor(Math.random() * allWisdom?.length);
                        setNugget({ ...allWisdom[newIndex], index: newIndex });
                    }}>Shuffle!</button>
                    <button onClick={() => setModalStatus('edit')}>e</button>
                    <button onClick={upTheNugget}>&gt;</button>
                </div>
            </div>
            <WellOfWisdomSearch allWisdom={allWisdom} />
        </div>
    )
}