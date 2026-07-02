export const BUMP_BUTTONS = [
    { key: 'house', symbol: '🏠', header: 'low key hang' },
    { key: 'hammer', symbol: '🔨', header: 'time to work' },
    { key: 'paddle', symbol: '🏓', header: "let's go play" },
];

export const getBumpHeader = (key) =>
    BUMP_BUTTONS.find((b) => b.key === key)?.header;
