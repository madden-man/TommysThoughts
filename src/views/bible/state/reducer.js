import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  currentSignature: '',
  currentText: '',
};

export const bibleSlice = createSlice({
  name: 'bible',
  initialState,
  reducers: {
    'PASSAGE_REQUESTED': (state, action) => ({
      ...state,
      currentSignature: action.payload.newSignature,
    }),

    'PASSAGE_RECEIVED': (state, action) => ({
      ...state,
      currentText: action.payload.newText
    })
  }
});
