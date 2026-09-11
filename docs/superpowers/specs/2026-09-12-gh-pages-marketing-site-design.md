# Escuadra gh-pages marketing site — design

## Purpose

Replace the current utility-only gh-pages homepage with a small marketing site
that explains Escuadra in one scroll, uses the app's established visual identity,
and remains a dependable home for Privacy and Support.

The site is for people who encounter Escuadra before the public App Store release.
Its primary job is to make the product immediately legible and leave a credible,
calm impression—not to collect leads, host a waitlist, or recreate the app.

## Scope

The first version contains three static pages:

- `index.html`: one-screen-to-scroll marketing homepage.
- `privacy.html`: the existing privacy policy, restyled in the shared shell.
- `support.html`: the existing support guidance, restyled in the shared shell.

There is no backend, form, newsletter, analytics, tracker, account, remote API,
or JavaScript framework. The release CTA is a non-interactive `Coming soon` label.
When Escuadra is publicly available, that label can be replaced with an App Store
link without redesigning the page.

## Chosen visual direction: The Matchcard

The homepage borrows the app's visual grammar rather than generic football
marketing:

- Near-black or warm-off-white field, high-contrast type, and the existing indigo
  brand accent.
- A geometric Escuadra mark and wordmark treatment drawn from the app branding.
- An oversized shirt number as the hero object; it is a recognisable learning cue
  rather than a player photograph or a club emblem.
- A thin multi-colour team band as an abstract football detail. It must never
  become a crest, badge, shield, or logo.
- Actual app screenshots as proof of the product. Use three: the home screen,
  a question screen, and a results screen. Show dark screenshots in dark mode and
  the matching light screenshots in light mode.

The headline is `Know the squad. Cold.` Supporting copy is concise and specific:
`Ten fast questions. One squad you can name under pressure.`

## Homepage structure

1. **Header** — Escuadra mark/wordmark links home. Privacy and Support are compact
   text links. A theme toggle sits at the end of the header.
2. **Hero** — headline, supporting copy, `Coming soon` status, an oversized shirt
   number, and the abstract team band.
3. **Product proof** — a responsive three-screen sequence: Home → Question →
   Results. On narrow viewports, it becomes a vertically spaced stack; it must not
   make screenshots illegibly small.
4. **Three product points** — `10-question rounds`, `Club & national squads`, and
   `Fully offline`. Each has one sentence at most.
5. **Trust statement** — `No account. No ads. No data collected.` This is a
   succinct summary that links to Privacy for the precise policy.
6. **Footer** — repeat Privacy and Support and include a quiet `Coming soon`
   release status.

The homepage intentionally has no pricing, testimonials, fake download controls,
blog, roadmap, waitlist, or team/league logo wall.

## Light and dark theme

The public site follows the same philosophy as the app:

- Default to `prefers-color-scheme`.
- Offer a visible compact sun/moon toggle in the shared header.
- Persist an explicit visitor choice with `localStorage`; absence of a stored
  choice means follow the operating-system setting.
- Avoid a flash of the wrong theme by resolving the stored setting before the
  first painted page content.
- Use CSS custom properties for every site colour, surface, border, shadow, and
  text role. Define both complete palettes together, with the same semantic names.
- Light mode is a deliberate off-white canvas with dark ink; it is not a blanket
  inversion of dark mode.
- Screen captures switch as a matching pair: no dark app capture on the light
  site, or vice versa.

The theme toggle must expose an accessible name and state, remain keyboard
operable, and work on every page. JavaScript failure must leave a readable page
in the system-preferred CSS theme.

## Motion and interaction

Motion communicates focus and pacing, never spectacle:

- Hero content and the number enter in a short staggered sequence on initial load.
- Screenshot cards use a subtle reveal as they enter the viewport.
- Links, the theme toggle, and screenshot cards get restrained hover/focus/tap
  feedback.
- All transitions are at most 300ms.
- `prefers-reduced-motion: reduce` removes reveal movement and leaves immediate,
  stable content; theme changes also become instant.

There is no autoplay video, sound, confetti, continuous decorative animation,
or scroll-jacking.

## Shared implementation architecture

Keep the site static and deliberately small:

- A shared CSS file owns palettes, reset, typography, responsive layout,
  component styles, motion, and accessibility focus states.
- A small shared JavaScript file owns only theme initialisation/toggling and
  intersection-based reveal enhancement. It must not be needed to read or
  navigate the site.
- Each HTML page uses the shared header and footer markup, page-specific semantic
  main content, and the same asset paths.
- Store the approved screenshots and brand-only visual assets under a clearly
  named public site asset directory. Do not load any external images, fonts,
  scripts, trackers, or icon libraries.

The content source of truth for the legal copy remains the current policy and
support text. Restyling must not weaken or contradict the claims that the app is
offline, has no account, ads, analytics, or network requests.

## Responsive and accessible behaviour

The layout is mobile-first, with a compact header and comfortable horizontal
padding on phone screens. Desktop has a contained content width and a more
generous hero composition, without turning legal pages into narrow, cramped
cards.

Use semantic `header`, `nav`, `main`, `section`, and `footer` elements; one `h1`
per page; meaningful alt text for screenshots; visible keyboard focus; adequate
colour contrast in both palettes; and tap targets sized for mobile use. The
theme toggle and all navigation need usable text alternatives, not colour alone.

## Asset and trademark constraints

Use only assets already owned or produced for Escuadra: the app mark and its
own screenshots. Do not introduce player photos, club crests, badges, logos,
shield-shaped UI, third-party web fonts, or unlicensed stock football imagery.
The simple team-colour band is an abstract, non-logo detail.

## Verification

Before release, verify:

- All three pages render and cross-link correctly on GitHub Pages, including the
  repository subpath used by the deployment.
- The homepage has no dead App Store link while release status is `Coming soon`.
- Both light and dark themes render correctly after a system preference change,
  a manual toggle, refresh, and navigation between pages.
- Reduced-motion mode yields no reveal or theme-transition movement.
- Screenshots match the active site theme and remain readable at phone and desktop
  widths.
- Keyboard navigation, focus indication, heading structure, image alt text, and
  colour contrast work in both themes.
- The browser network panel shows no third-party requests; all assets are local.
- Privacy and Support text retains its factual meaning.

## Out of scope for v1

App Store launch links, Android links, newsletter/waitlist collection, contact
forms, analytics, visitor metrics, news posts, release notes, customer quotes,
player imagery, and any interactive playable quiz preview are deferred.
