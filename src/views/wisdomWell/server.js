export const getWisdom = async () => {
    let wiseResults = await fetch(".netlify/functions/get-wisdom",
        { method: 'POST', body: JSON.stringify({})})
        .then(response => response.json());
    console.log(wiseResults);
    return wiseResults;
}

export const addWisdom = async (wisdomNugget) => {
    let insertResults = await fetch(".netlify/functions/add-wisdom", 
        { method: 'POST', body: JSON.stringify({ ...wisdomNugget })})
        .then(response => response.json());
    console.log(insertResults);
    return insertResults;
}

// TODO: Semantic Search?
// https://www.mongodb.com/docs/atlas/atlas-vector-search/tutorials/vector-search-tutorial/

// export const updateDart = async (dartItem) => {
//     let updateResults = await fetch(".netlify/functions/update_dart", 
//         { method: 'POST', body: JSON.stringify({ ...dartItem })})
//         .then(response => response.json());
//     console.log(updateResults);
//     return updateResults;
// }