export const BUMP_BUTTONS = [
    { key: 'house', symbol: '🏠', header: 'low key hang' },
    { key: 'hammer', symbol: '🔨', header: 'time to work' },
    { key: 'paddle', symbol: '🏓', header: "let's go play" },
];

export const getBumpHeader = (key) =>
    BUMP_BUTTONS.find((b) => b.key === key)?.header;

export const getBumpSymbol = (key) =>
    BUMP_BUTTONS.find((b) => b.key === key)?.symbol;

// The only icons an activity may use — the three bump-button symbols.
export const ICON_OPTIONS = BUMP_BUTTONS.map(({ symbol }) => symbol);

// Symbol -> the stable key used for that kind's colour and label. An activity
// carrying a symbol from outside the three falls back to no key, and styles
// itself in the neutral default rather than breaking.
export const getBumpKeyForSymbol = (symbol) =>
    BUMP_BUTTONS.find((b) => b.symbol === symbol)?.key ?? null;

export const getBumpHeaderForSymbol = (symbol) =>
    BUMP_BUTTONS.find((b) => b.symbol === symbol)?.header ?? null;
