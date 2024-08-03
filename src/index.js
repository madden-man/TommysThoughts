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
  <main className={classNames('main', {
    'main--air': window.location.pathname.includes('/air'),
    'main--water': window.location.pathname.includes('/water'),
    'main--earth': window.location.pathname.includes('/earth'),
    'main--fire': window.location.pathname.includes('/fire'),
  })}>
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  </main>
);

