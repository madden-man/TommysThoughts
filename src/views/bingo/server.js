export const getBingo = async () => {
    let bingoResults = await fetch(".netlify/functions/get_bingo",
        { method: 'POST' })
        .then(response => response.json());
    console.log(bingoResults);
    return bingoResults;
}

export const upsertBoard = async (boardInfo) => {
    let upsertResults = await fetch(".netlify/functions/update_bingo", 
        { method: 'POST', body: JSON.stringify({ ...boardInfo })})
        .then(response => response.json());
    console.log(upsertResults);
    return upsertResults;
}

export const addBingo = async (cardName) => {
    let addResults = await fetch(".netlify/functions/add_bingo",
        { method: 'POST', body: JSON.stringify({title: cardName }) })
        .then(response => response.json());
    return addResults;
}
