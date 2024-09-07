export const shuffleDarts = (dartItems, setShuffleDart, sortMetric) => {
    const newShuffleDart = dartItems[Math.floor(Math.random() * dartItems.length)];
    const sortedDarts = dartItems.sort((a, b) => {
        if (a.metrics[sortMetric] > b.metrics[sortMetric]) {
            return -1;
        } else if (b.metrics[sortMetric] > a.metrics[sortMetric]) {
            return 1;
        }
        return 0;
    });
    
    console.log(sortedDarts);
    let i = 0;
    const goToNextDart = () => {
        setShuffleDart(sortedDarts[i]);
        if (i < sortedDarts.length) {
            i++;
        } else {
            i = 0;
        }
    };

    const interval = setInterval(goToNextDart, 100);
    const timeoutLength = Math.floor((Math.random() * 3000)) + 1000;

    setTimeout(() => {
        clearInterval(interval);
        const newInterval = setInterval(goToNextDart, 500);
        
        setTimeout(() => {
            clearInterval(newInterval);
            setShuffleDart(newShuffleDart);
        }, 2500);
    }, timeoutLength);
};