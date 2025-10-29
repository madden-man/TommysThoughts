export const insertCreativeCount = async (pointBody) => {
    let creativeResults = await fetch(".netlify/functions/count-creativity",
        { method: 'POST', body: JSON.stringify(pointBody)})
        .then(response => response.json());
    console.log(creativeResults);
    return creativeResults;
}

export const getCreativeCount = async () => {
    let creativeResults = await fetch(".netlify/functions/get-creative-count",
        { method: 'GET'})
        .then(response => response.json());
    console.log(creativeResults);
    return creativeResults;
}