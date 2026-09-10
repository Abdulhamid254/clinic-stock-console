module.exports = {
  root: true,
  extends: ['next/core-web-vitals', 'prettier'],
  rules: {
    // Unused vars are a real bug most of the time, but our fetch-wrapper style
    // sometimes needs an intentionally-unused parameter (e.g. middleware.ts's
    // `_request`) to satisfy a function signature — allow the underscore escape
    // hatch instead of turning the check off.
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

    // `any` defeats the type safety the Zod schemas and query hooks are there
    // to provide. Use `unknown` + narrowing (see api-client.ts's ApiError checks)
    // instead of reaching for `any` under time pressure.
    '@typescript-eslint/no-explicit-any': 'error',

    // Left-over console.log statements are a common review nitpick; console.warn
    // and console.error are legitimate (e.g. surfacing a caught refresh failure)
    // so only those two are allowed through.
    'no-console': ['warn', { allow: ['warn', 'error'] }],

    // exhaustive-deps has real false positives in this codebase: the debounce
    // effect in filters-bar.tsx, the dialog-reset effect in
    // stock-correction-dialog.tsx, and the page-clamp effect in
    // app/stock/page.tsx all deliberately omit a dependency to avoid
    // re-running on every keystroke/render. Kept as a warning (not off) so a
    // genuinely missing dependency elsewhere still gets flagged.
    'react-hooks/exhaustive-deps': 'warn',

    // autoFocus on the login page's username field is a deliberate choice: it's
    // a single-purpose sign-in screen with exactly one sensible first control,
    // not the content-heavy page this a11y rule is normally protecting against.
    'jsx-a11y/no-autofocus': 'off',
  },
};
