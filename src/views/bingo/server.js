export const getBingo = async () => {
    let bingoResults = await fetch(".netlify/functions/get_bingo",
        { method: 'POST' })
        .then(response => response.json());
    console.log(bingoResults);
    return bingoResults;
}

export const upsertBoard = async (boardInfo) => {
    let upsertResults = await fetch(".netlify/functions/upsert_bingo", 
        { method: 'POST', body: JSON.stringify(boardInfo)})
        .then(response => response.json());
    console.log(upsertResults);
    return upsertResults;
}
