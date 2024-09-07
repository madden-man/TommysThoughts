import React from 'react';
import classNames from 'classnames';

const DartItem = ({ name, enneagram, onClick, shuffleDart }) =>
    <div className={classNames(`darts__item darts__item--${enneagram.toString(10)}`,
        { 'darts__item--shuffled': shuffleDart })} onClick={onClick}>
        {name}
    </div>;

export const DartWall = ({ dartItems, setActiveDart, shuffleDart, sortMetric }) => {
    // An array of rows -- each will be populated based on sortMetric (8 -> 0)
    let dartWall = [[], [], [], [], [], [], [], [], []];

    dartItems?.forEach((item) => {
        const row = 7 - item?.metrics[sortMetric];
        const rowLength = dartWall[row].length;
        
        // In case you ever want to do it in a more position: absolute way!
        //
        // // If there's an even number of items, place it in the center or interpolating right side of center,
        // // If there's an odd number, place it to the left of center by the # of items / 2
        // const itemIndex = (rowLength % 2 === 0) ?
        //     (rowLength + ((8 - rowLength) / 2)) : ((7 - rowLength) / 2);

        // console.log(`sortMetric: ${item?.metrics[sortMetric]}`);
        // console.log(`rowLength: ${rowLength}`);
        // console.log(`itemIndex: ${itemIndex}`);

        dartWall[row] = rowLength % 2 === 0 ?
            [...dartWall[row], item] : [item, ...dartWall[row]];
    })

    console.log(dartWall);

    return (
        <div className="darts">
            {dartWall.map((row) => {
                if (row.length === 0) return null;

                return (
                    <div className="darts__row">
                        {row.map((item) =>
                            <DartItem
                                {...item}
                                key={item['_id']}
                                onClick={() => setActiveDart(item)}
                                shuffleDart={item['_id'] === shuffleDart?._id}
                            />)}
                        {row.length % 2 === 0 ? <div className="darts__item--spacer"></div> : null}
                    </div>
                );
            })}
        </div>
    )
}