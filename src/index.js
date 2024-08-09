import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router-dom'
import WebFont from 'webfontloader';
import classNames from 'classnames';
import { setUpStore } from './config/store';
import { router } from './config/router';

import './main.css';
import './index.css';

WebFont.load({
	google: {
		families: ['Ubuntu:300,400,700', 'sans-serif']
	}
});

const store = setUpStore();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <main className='main'>
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
    <div className={classNames('bg', {
    'bg--air': window.location.pathname.includes('/air'),
    'bg--water': window.location.pathname.includes('/water'),
    'bg--earth': window.location.pathname.includes('/earth'),
    'bg--fire': window.location.pathname.includes('/poetry'),
  })}></div>
  </main>
);

