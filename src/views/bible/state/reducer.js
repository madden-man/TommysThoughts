import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  currentSignature: '',
  currentText: '',
  status: 'none',
};

export const bibleSlice = createSlice({
  name: 'bible',
  initialState,
  reducers: {
    'PASSAGE_REQUESTED': (state, action) => ({
      ...state,
      currentSignature: action.payload.newSignature,
      status: 'inprogress',
    }),

    'PASSAGE_RECEIVED': (state, action) => ({
      ...state,
      currentText: action.payload.newText,
      status: 'received'
    })
  }
});
