export const getDarts = async () => {
    let dartResults = await fetch(".netlify/functions/get_darts")
        .then(response => response.json());
    console.log(dartResults);
    return dartResults;
}

export const addDart = async (dartItem) => {
    let insertResults = await fetch(".netlify/functions/add_dart", 
        { method: 'POST', body: JSON.stringify({ ...dartItem })})
        .then(response => response.json());
    console.log(insertResults);
    return insertResults;
}