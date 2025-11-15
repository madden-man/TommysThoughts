import { useState, useEffect, useCallback } from 'react';
import './well-of-wisdom.css';
import { WellOfWisdomModal } from './WellOfWisdomModal';
import { getWisdom } from './server';

export const WellOfWisdom = () => {
    const [allWisdom, setAllWisdom] = useState([]);
    const [currentNugget, setNugget] = useState('');
    const [modalStatus, setModalStatus] = useState('closed');

    const fetchWisdom = useCallback(async() => {
        const fetchedWisdom = await getWisdom();
        setAllWisdom(fetchedWisdom);
        if (fetchedWisdom.length > 0) {
            setNugget({ ...fetchedWisdom[0], index: 0 });
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
            <p>{currentNugget?.quote}</p>
            <div>
                - {currentNugget?.author},<br />
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                {currentNugget?.book} ({currentNugget?.page || '?'}),<br />
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                &lt;-- (sequence) --&gt;
            </div>
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
        </div>
    )
}