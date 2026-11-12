// src/support.mjs: Support's template. Text from the page's language.
import { fill } from '../quiz.mjs';
import {
  alternates,
  block,
  languageMenu,
  privacyHref,
  redirectScript,
  themeScript,
  themeToggle,
} from './layout.mjs';
import { shareTags, plain } from './share.mjs';

const ISSUES = 'https://github.com/tovmassian/escuadra/issues';

// One icon for each kind of report, in the order of `support.kinds`.
const KIND_ICONS = [
  '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5" /><circle cx="12" cy="16.4" r=".9" fill="currentColor" /></svg>',
  '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4l-4 3 2 4 2-1v10h8V10l2 1 2-4-4-3-2 2h-4z" /></svg>',
  '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></svg>',
];

const KIND_GO =
  '<svg class="kind-go" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>';

export function support(page) {
  const { text, root } = page;
  const l = text.layout;
  const t = text.support;
  const privacy = privacyHref(page);
  // privacy.html is the 1.x policy, in English only.
  const privacy1x = page.language === 'en' ? '' : ' hreflang="en"';
  return `<!doctype html>
<html lang="${page.language}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
${page.language === 'en' ? redirectScript('support.html') + '\n' : ''}    <link rel="icon" type="image/x-icon" href="${root}assets/favicon.ico" />
    <title>${text.meta.supportTitle}</title>
    <meta
      name="description"
      content="${plain(t.lead)}"
    />
${alternates(page, 'support.html')}
${shareTags(page, 'support.html', { title: text.meta.supportTitle, description: t.lead })}
${themeScript()}
    <link rel="stylesheet" href="${root}site.css" />
    <script type="module" src="${root}site.mjs"></script>
  </head>
  <body>
    <header class="site-header shell">
      <a class="brand" href="index.html" aria-label="${l.homeLabel}">
        <span class="brand-mark" aria-hidden="true">
          <img src="${root}assets/favicon.ico" alt="" />
        </span>
        <span>escuadra</span>
      </a>
      <nav aria-label="${l.utilityNav}">
        <a href="index.html">${l.nav.home}</a><a href="support.html" aria-current="page">${l.nav.support}</a
        ><a href="${privacy}">${l.nav.privacy}</a>
      </nav>
      <div class="header-actions">
        ${languageMenu(page, 'support.html')}
        ${themeToggle(page)}
      </div>
    </header>

    <main>
      <section class="page-hero">
        <span class="page-ghost numbers" aria-hidden="true">?</span>
        <div class="shell support-grid">
          <div>
            <p class="eyebrow"><span class="corner"></span>${t.eyebrow}</p>
            <h1 class="display">${t.title}</h1>
            <p class="lead">
              ${t.lead}
            </p>
            <div class="cta-row">
              <a class="pill" href="${ISSUES}"
                >${t.cta}</a
              >
              <span class="cta-note">${t.ctaNote}</span>
            </div>
          </div>
          <div class="kinds">
${t.kinds
  .map(
    (kind, i) => `            <a class="kind" href="${ISSUES}">
              ${KIND_ICONS[i]}
              <span>
                <span class="kind-title">${kind.title}</span>
                <span class="kind-sub" style="display: block">${kind.sub}</span>
              </span>
              ${KIND_GO}
            </a>`,
  )
  .join('\n')}
          </div>
        </div>
      </section>

      <section class="shell faq-grid" aria-labelledby="faq-title">
        <div>
          <p class="eyebrow"><span class="corner"></span>${t.faqEyebrow}</p>
          <h2 id="faq-title" class="display">${t.faqTitle}</h2>
        </div>
        <div class="faq">
${t.faq
  .map(
    (item, i) => `          <details${i === 0 ? ' open' : ''}>
            <summary>${item.q}<span class="plus" aria-hidden="true"></span></summary>
${block(12, '<p>', fill(item.a, { privacy }), '</p>')}
          </details>`,
  )
  .join('\n')}
        </div>
      </section>
    </main>

    <footer class="site-footer shell">
      <span>&copy; Khachatur Tovmasyan</span>
      <nav aria-label="${l.footerNav}">
        <a href="index.html">${l.nav.home}</a><a href="${privacy}">${l.nav.privacy}</a
        ><a href="${root}privacy.html"${privacy1x}>${l.nav.privacy1x}</a>
      </nav>
      <span class="release-status">${l.releaseStatus}</span>
    </footer>
  </body>
</html>
`;
}
