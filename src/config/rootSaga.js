import { bibleSagas } from '../views/bible/state/sagas';
import { all, fork } from 'redux-saga/effects';

export const allSagas = function* root() {
  yield all([
    ...bibleSagas,
  ].map(saga => fork(saga)));
};
