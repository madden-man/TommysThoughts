import { useState } from 'react'
import { useStopwatch } from 'react-timer-hook';

export const CreativeTimer = ({ assignPoints }) => {
    const [totalHours, setTotalHours] = useState(0);

    const updateHours = () => setTotalHours(hours + (minutes / 60) + (seconds / 3600));
  const {
    seconds,
    minutes,
    hours,
    start,
    pause,
    reset,
  } = useStopwatch({ autoStart: false }); // Set autoStart to true if you want it to start immediately

  return (
    <div style={{ textAlign: 'center', background: 'white', borderRadius: '1rem', marginTop: '1rem', padding: '2rem', border: '2px ridge darkblue' }}>
      <h1>React Stopwatch</h1>
      <div style={{ fontSize: '100px' }}>
        <span>{hours}</span>:<span>{minutes}</span>:<span>{seconds}</span>
      </div>
      <button onClick={start}>Start</button>
      <button onClick={() => { pause(); updateHours(); }}>Pause</button>
      <button onClick={() => { pause(); setTotalHours(0); window.location.reload(); }}>Reset</button>
      <br />
      <input type="text" style={{margin: '0.5rem 0', width: '100%', textAlign: 'center'}}value={totalHours} onChange={(e) => setTotalHours(e.target.value)} />
      <br />
      <button onClick={() => { updateHours(); assignPoints(totalHours / 2); reset();}}>Reading!</button>
      <button onClick={() => { updateHours(); assignPoints(totalHours); reset();}}>Practice!</button>
      <button onClick={() => { updateHours(); assignPoints(totalHours * 2); reset();}}>Writing!</button>
    </div>
  );
}
