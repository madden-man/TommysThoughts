export const CreativeScoreboard = ({ creativeCounts }) => {
    let today = new Date();
    let monday = new Date();
    let sunday = new Date();
    monday.setDate(today.getDate() - today.getDay() + 1);
    sunday.setDate(today.getDate() + (7 - today.getDay()));

    let allTime = 0;
    let thisWeek = 0;

    Object.keys(creativeCounts).forEach((i) => {
        allTime += Number(creativeCounts[i]);
        const currentDate = new Date(i);
        if (currentDate >= monday && currentDate <= sunday) {
            thisWeek += Number(creativeCounts[i]);
        }
    })

    return (
        <div style={{background: 'white', border: '2px ridge darkblue', borderRadius: '1rem', padding: '2rem', marginTop: '1rem'}}>
            <h3>Week of {monday.getMonth() + 1}/{monday.getDate()}:</h3>
            <p>{thisWeek.toFixed(5)}</p>
            <h3>All Time</h3>
            <p>{allTime.toFixed(5)}</p>
        </div>
    );
}