import React, { useState, useEffect } from 'react';
import classNames from 'classnames';

const DartItem = ({ name, enneagram, onClick, shuffleDart }) =>
    <div className={classNames(`darts__item darts__item--${enneagram.toString(10)}`,
        { 'darts__item--shuffled': shuffleDart })} onClick={onClick}>
        {name}
    </div>;

export const DartWall = ({ dartItems, setActiveDart, shuffleDart, sortMetric }) => {
    // An array of rows -- each will be populated based on sortMetric (8 -> 0)
    let dartWall = [[], [], [], [], [], [], [], [], []];
    let longestRow = 0;

    dartItems?.forEach((item) => {
        const row = 7 - item?.metrics[sortMetric];
        const rowLength = dartWall[row].length;
        if (rowLength > longestRow) { longestRow = rowLength; }
        
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

    // mobile state..have to thinkabout this
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);

    const [scrollX, setScrollX] = useState(0);

    // the required distance between touchStart and touchEnd to be detected as a swipe
    const minSwipeDistance = 50 
    
    const onTouchStart = (e) => {
        setTouchEnd(null) // otherwise the swipe is fired even with usual touch events
        setTouchStart(e.targetTouches[0].clientX)
      }
      
      const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX)
      
      const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;
        if (isLeftSwipe || isRightSwipe) console.log('swipe', isLeftSwipe ? 'left' : 'right')

        if (isLeftSwipe && longestRow >= ((scrollX + 1) * 5)) {
            setScrollX(scrollX + 1);
        } else if (isRightSwipe && scrollX > 0) {
            setScrollX(scrollX - 1);
        }
      }

    return (
        <div className="darts" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            {dartWall.map((row, rowIndex) => {
                if (row.length === 0) return null;
                
                if (document.body.scrollWidth <= 768) {
                    row = row.slice((scrollX * 5), (scrollX * 5) + 5) || [];
                } else {
                    row = row.slice((scrollX * 10), (scrollX * 10) + 10) || [];
                }

                return (
                    <div className="darts__row" key={`row-${rowIndex}`}>
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