export const insertCreativeCount = async (pointBody) => {
    let creativeResults = await fetch(".netlify/functions/",
        { method: 'POST', body: JSON.stringify(pointBody)})
        .then(response => response.json());
    console.log(creativeResults);
    return creativeResults;
}

export const getCreativeCount = async () => {
    let creativeResults = await fetch(".netlify/functions/",
        { method: 'POST', body: {}})
        .then(response => response.json());
    console.log(creativeResults);
    return creativeResults;
}