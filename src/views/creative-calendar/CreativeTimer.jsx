import { useStopwatch } from 'react-timer-hook';

export const CreativeTimer = ({ assignPoints }) => {
  const {
    seconds,
    minutes,
    hours,
    isRunning,
    start,
    pause,
    reset,
  } = useStopwatch({ autoStart: false }); // Set autoStart to true if you want it to start immediately

  const totalHours = hours + (minutes / 60) + (seconds / 3600);

  return (
    <div style={{ textAlign: 'center', background: 'white', borderRadius: '1rem', padding: '2rem', border: '2px ridge darkblue' }}>
      <h1>React Stopwatch</h1>
      <div style={{ fontSize: '100px' }}>
        <span>{hours}</span>:<span>{minutes}</span>:<span>{seconds}</span>
      </div>
      <p>{isRunning ? 'Running' : 'Not running'}</p>
      <button onClick={start}>Start</button>
      <button onClick={pause}>Pause</button>
      <button onClick={reset}>Reset</button>
      <br /><br />
      <button onClick={() => { assignPoints(totalHours / 2); reset();}}>Reading!</button>
      <button onClick={() => { assignPoints(totalHours); reset();}}>Practice!</button>
      <button onClick={() => { assignPoints(totalHours * 2); reset();}}>Writing!</button>
    </div>
  );
}
