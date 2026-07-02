export const BUMP_BUTTONS = [
    { key: 'house', symbol: '🏠', header: 'low key hang' },
    { key: 'hammer', symbol: '🔨', header: 'time to work' },
    { key: 'paddle', symbol: '🏓', header: "let's go play" },
];

export const getBumpHeader = (key) =>
    BUMP_BUTTONS.find((b) => b.key === key)?.header;

// The only icons an activity may use — the three bump-button symbols.
export const ICON_OPTIONS = BUMP_BUTTONS.map(({ symbol }) => symbol);
