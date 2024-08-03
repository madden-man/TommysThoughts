import { combineReducers } from "@reduxjs/toolkit";
import { bibleSlice } from "../views/bible/state/reducer";

export const rootReducer = combineReducers({
    bible: bibleSlice.reducer
});