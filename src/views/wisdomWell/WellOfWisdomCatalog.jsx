

export const WellOfWisdomCatalog = ({ allWisdom, catalogParam }) => {
    let selectedCatalog = [];
    allWisdom.forEach((nugget) => {
        if (!selectedCatalog.includes(nugget?.[catalogParam.slice(0, -1)]))
            selectedCatalog.push(nugget?.[catalogParam.slice(0, -1)]);
    });
    return (
        <div className="well-o-wisdom__catalog">
            {selectedCatalog.map((item) =>
                <a href={`/well-o-wisdom?search=${catalogParam.charAt(0)}|${item}`}>
                    {item}
                </a>)}
        </div>
    );
}