import React from 'react';
import { Link } from 'react-router-dom';

import './twoColumn.css';

export const TwoColumn = ({ links, children }) =>
  <div className="two-column">
    <div className="two-column__left">
      {links.map(({ text, url, color }) =>
        <Link to={url} style={{backgroundColor: color}} key={url}>
          {text}
        </Link>
      )}
    </div>
    <div className="two-column__right">
      {children}
    </div>
  </div>;
