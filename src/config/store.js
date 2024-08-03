import createSagaMiddleware from 'redux-saga';
import { configureStore } from '@reduxjs/toolkit';

import { rootReducer } from './rootReducer';
import { allSagas } from './rootSaga';

const sagaMiddleware = createSagaMiddleware();

export const setUpStore = () => {

  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(sagaMiddleware),
  });

  sagaMiddleware.run(allSagas);

  return store;
}
