/**
 * Tiny class-name joiner. We don't pull in clsx/tailwind-merge: every
 * component in this app only ever passes a fixed base string plus one
 * optional override, so there's no conflicting-class case worth a
 * dependency for. If that changes, reach for tailwind-merge then.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
