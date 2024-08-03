import { takeEvery, put } from 'redux-saga/effects';
import { bibleSlice } from './reducer';
import BibleApi from './service';

export function* requestPassage(newSignature) {
  try {
    const response = yield BibleApi.fetch(newSignature);

    yield put(bibleSlice.actions.PASSAGE_RECEIVED({ newText: response.data.passages[0] }));
  } catch (e) {
    console.log(e);
  }
}

export function* watchForPassageRequest() {
  yield takeEvery(bibleSlice.actions.PASSAGE_REQUESTED,
    (action) => requestPassage(action.payload.newSignature));
}

export const bibleSagas = [
  watchForPassageRequest,
];
