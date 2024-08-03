import axios from "axios";

const API_KEY = 'Token cd1bd23f49f8cf1f11e25f93432ee51570dead65';

const headers = {
  'Authorization': API_KEY,
};

const BibleApi = {
  fetch: (signature) => {
    const passage = axios.get(`https://api.esv.org/v3/passage/text/`,
      { headers, params: { 'q': signature }})
      .catch(error => {  console.log(error); return Promise.reject(error); });

    return passage;
  },
};

export default BibleApi;
