const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const byText = (sel, text) => [...document.querySelectorAll(sel)].find((b) => b.textContent.trim() === text || b.textContent.trim().startsWith(text + ' '));
const waitFor = async (fn, tries = 50) => { let v; for (let i = 0; i < tries && !(v = fn()); i++) await sleep(100); return v; };
const setVal = (el, v) => { Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
const type = async (el, text) => { el.focus(); for (let i = 1; i <= text.length; i++) { setVal(el, text.slice(0, i)); await sleep(55); } };
const click = async (el, after = 900, what = '?') => { if (!el) throw new Error('missing: ' + what + ' | buttons: ' + [...document.querySelectorAll('button')].map((b) => b.textContent.trim() || b.getAttribute('aria-label')).filter(Boolean).join(' / ')); el.scrollIntoView({ block: 'nearest' }); el.click(); await sleep(after); };
const stage = sessionStorage.fdStage || '';
if (!sessionStorage.fdShot) { sessionStorage.fdShot = 1; localStorage.clear(); localStorage.setItem('flowdraft:whatsnew', '0.2.0'); localStorage.setItem('flowdraft:promo:hidden', '1'); location.reload(); return 'reload'; }
if (stage === 'done') return 'done';
if (stage === 'profile') {
  await sleep(2500);
  const del = await waitFor(() => byText('button.is-danger', 'Delete account'));
  if (!del) return 'no delete button';
  await click(del, 2500);
  const cancel = await waitFor(() => byText('.fd-confirm-actions button', 'Cancel'));
  if (cancel) await click(cancel, 1500);
  sessionStorage.fdStage = 'done';
  return 'profile done';
}
await sleep(2500);
const tpl = await waitFor(() => [...document.querySelectorAll('.fd-template')].find((b) => b.querySelector('.fd-template-title').textContent.trim() === 'Automation'));
if (!tpl) return 'no template';
await click(tpl, 3000);
// Select a box and retitle it in the right panel
const node = [...document.querySelectorAll('.react-flow__node')].find((n) => n.textContent.includes('Runs on Monday'));
if (node) {
  await click(node, 1500);
  const label = [...document.querySelectorAll('label')].find((l) => l.textContent.trim() === 'Title');
  const input = label && document.getElementById(label.htmlFor);
  if (input) { setVal(input, ''); await type(input, 'Runs every Monday'); await sleep(1500); }
}
// Export a PNG: the share sheet opens, then closes
await click(byText('button', 'Export'), 1200, 'Export');
await click(byText('[role=menuitem], .fd-menu button, button', 'PNG image'), 4500, 'PNG image');
window.webkit.messageHandlers.flowdraft.postMessage({ type: 'debugDismiss' });
await sleep(1500);
// Sign in with the demo account
await click(byText('button', 'Sign in'), 1500, 'Sign in');
const email = await waitFor(() => document.querySelector('input[type=email]'));
if (!email) return 'no auth form';
await type(email, EMAIL);
await type(document.querySelector('input[type=password]'), PASSWORD);
await sleep(600);
await click(document.querySelector('form button[type=submit]') || byText('button.is-primary', 'Sign in'), 4000);
// Save, then open My projects
await click(byText('button', 'Save'), 3000, 'Save');
await click(byText('button', 'File'), 1200, 'File');
await click(byText('[role=menuitem], button', 'My projects'), 3500, 'My projects');
const close = [...document.querySelectorAll('dialog[open] button[aria-label=Close]')].pop();
if (close) await click(close, 1500);
// Account menu → Profile (navigates)
sessionStorage.fdStage = 'profile';
await click(document.querySelector('button[aria-label=Account]'), 1200, 'Account');
await click(byText('[role=menuitem], button', 'Profile'), 500, 'Profile');
return 'stage 1 done';
