# CLAUDE.md

Guidance for working in this repo (TommysThoughts.com — a React + react-router-dom + MUI site).

## UI / styling conventions

- **New text you add must sit in a white box.** The site uses a full-viewport background image
  (`src/main.css` `.bg`, e.g. `canyon.jpg`) that has poor color contrast, so any *new* text you
  create must be placed on a white background so it stays readable. Do not put bare new text
  directly on the page.
  - This applies only to new text you introduce — do **not** restyle existing/shared elements
    (e.g. the shared `<Header />`) to add white boxes. Leave those as they are.

- **Use the project's standard box style** for these white containers, matching existing pages
  (`.home` in `src/views/home.css`, `.projects__item`, darts/bingo panels):

  ```css
  background-color: white;
  border: 2px ridge var(--blue-70);
  border-radius: 8px;
  padding: 8px 16px;
  ```

  (Some pages use larger radii / `darkblue` ridge borders — either is fine as long as it's a
  white box with a `ridge` border.)

- **Routes** are registered in `src/config/router.js`. Each page renders the shared
  `<Header />` (`src/components/Header.jsx`) inside a `<div className="page">`.
