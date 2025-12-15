import { useState, useEffect } from 'react';

export const WellOfWisdomView = ({ allWisdom, currentNugget, initialView }) => {
    const [wisdomView, setWisdomView] = useState(initialView || 'c');

    useEffect(() => {
        if (!initialView) {
            setWisdomView('c'); // as in current nugget lol
        }
    }, [initialView, currentNugget]);

    let nuggets = [];
    if (wisdomView === 'c') {
        nuggets.push(currentNugget);
    } else if (wisdomView.charAt(0) === 'a') {
        allWisdom.forEach((nugget) => {
            if (nugget?.author === wisdomView.substring(2)) nuggets.push(nugget);
        });
    } else if (wisdomView.charAt(0) === 'b') {
        allWisdom.forEach((nugget) => {
            if (nugget?.book === wisdomView.substring(2)) nuggets.push(nugget);
        });
    }

    return (
        <div>
            {nuggets?.map((iterateNugget, index) =>
                <div key={index}>
                    <p>{iterateNugget?.quote}</p>
                    {iterateNugget?.author && <span onClick={() => setWisdomView(`a|${iterateNugget?.author}`)}>
                        - {iterateNugget?.author},
                    </span>}
                    {iterateNugget?.author && <br />}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    <span onClick={() => setWisdomView(`b|${iterateNugget?.book}`)}>
                        {!iterateNugget?.author && '- '}{iterateNugget?.book} ({iterateNugget?.page || '?'}),
                    </span>
                    <br />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    &lt;-- (sequence) --&gt;
                </div>)}
        </div>
    );
}