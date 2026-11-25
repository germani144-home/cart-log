// On-screen keyboard handling for dialogs, and switching tabs.
// ---------- on-screen keyboard: keep dialogs inside the visible area ----------
// The keyboard shrinks the visual viewport; track its height/offset in CSS vars and flag "kb" while it's up.
// The field being typed in is scrolled to the top of its dialog so what's below it (suggestions) stays visible.
let tallestViewport = 0;
function fitViewport() {
  const v = window.visualViewport;
  if (!v) return;
  tallestViewport = Math.max(tallestViewport, v.height);
  const r = document.documentElement;
  r.style.setProperty('--vvh', v.height + 'px');
  r.style.setProperty('--vvt', v.offsetTop + 'px');
  r.classList.toggle('kb', v.height < tallestViewport * 0.78);
}
if (window.visualViewport) {
  visualViewport.addEventListener('resize', fitViewport);
  visualViewport.addEventListener('scroll', fitViewport);
  fitViewport();
}
addEventListener('orientationchange', () => {
  tallestViewport = 0;
  setTimeout(fitViewport, 300);
});
document.addEventListener('focusin', (e) => {
  const f = e.target,
    d = f.closest && f.closest('dialog');
  if (!d || !f.matches('input:not([type=color]),textarea')) return;
  const go = () => {
    const dr = d.getBoundingClientRect(),
      fr = f.getBoundingClientRect();
    d.scrollTo({ top: d.scrollTop + fr.top - dr.top - 16, behavior: 'smooth' });
  };
  setTimeout(go, 350); // after the keyboard has opened
});

// ---------- tabs ----------
const TAB_ORDER = ['g', 't', 'd'],
  TAB_NAMES = { g: 'Groceries', t: 'Notes', d: 'Recipes' },
  TAB_PANES = { g: '#paneG', t: '#paneT', d: '#paneD' };
let currentTab = load('cl_tab', 'g');
function setTab(t, dir) {
  const prev = currentTab;
  currentTab = TAB_ORDER.includes(t) ? t : 'g';
  save('cl_tab', currentTab);
  TAB_ORDER.forEach((k) => ($(TAB_PANES[k]).hidden = k !== currentTab));
  if (currentTab === 't' && typeof fitNote === 'function') fitNote(); // a note sizes itself only when on screen
  document.querySelectorAll('.tab').forEach((b) => {
    const on = b.dataset.tab === currentTab;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on);
  });
  if (dir && prev !== currentTab) {
    const p = $(TAB_PANES[currentTab]);
    p.classList.remove('inL', 'inR');
    void p.offsetWidth;
    p.classList.add(dir > 0 ? 'inR' : 'inL');
  }
}
document
  .querySelectorAll('.tab')
  .forEach((b) =>
    b.addEventListener('click', () =>
      setTab(b.dataset.tab, TAB_ORDER.indexOf(b.dataset.tab) > TAB_ORDER.indexOf(currentTab) ? 1 : -1),
    ),
  );
