import { useState } from 'react';

export const WellOfWisdomView = ({ allWisdom, currentNugget }) => {
    const [wisdomView, setWisdomView] = useState('');

    let nuggets = [];
    if (wisdomView === '') {
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
            {nuggets.map((iterateNugget) =>
                <div>
                    <p>{iterateNugget?.quote}</p>
                    <span onClick={() => setWisdomView(`a|${iterateNugget?.author}`)}>
                        - {iterateNugget?.author},
                    </span>
                    <br />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    <span onClick={() => setWisdomView(`b|${iterateNugget?.book}`)}>
                        {iterateNugget?.book} ({iterateNugget?.page || '?'}),
                    </span>
                    <br />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    &lt;-- (sequence) --&gt;
                </div>)}
        </div>
    );
}