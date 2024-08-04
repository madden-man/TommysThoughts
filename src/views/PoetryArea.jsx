import React, { useState } from 'react';

export const PoetryArea = () => {
  const [poem, setPoem] = useState('');

  return (
    <div className="poetry-area">
      <p>Check out some of my poems, or write your own below if you prefer! :)</p>

      <textarea rows={8} value={poem} onChange={(e) => setPoem(e.target.value)} />

      <button>
        Submit to Tommy!
      </button>
    </div>
  );
};
