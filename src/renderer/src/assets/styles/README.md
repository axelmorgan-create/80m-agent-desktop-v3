# Renderer Style Modules

`../main.css` is now an ordered import manifest. The order is intentional and
preserves the pre-cleanup cascade while the app is broken into smaller style
areas.

When adding or changing styles:

- Put rules in the narrowest matching module instead of adding broad overrides
  to `main.css`.
- Keep new screen-specific rules near that screen's module.
- Add late overrides only when a theme or packaged Electron behavior requires
  them, and leave a short comment explaining why.
- Avoid new `!important` rules unless they are replacing an existing late
  override or fixing a proven cascade conflict.
- Keep URL paths relative to the module file. Font paths from this folder use
  `../fonts/...`.

The goal is not to repaint the app. The goal is to keep the current 80m visual
language while making every future change easier to find, review, and ship.
