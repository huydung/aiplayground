// Entry controller: auth gate → load store → hash-routed authoring SPA.
import { api, getToken, getUser, setAuth, clearAuth } from './api.js';
import * as store from './store.js';
import { el, clear } from './util.js';
import { renderDashboard, renderPlanner, renderBank } from './planner.js';

const root = document.getElementById('root');

store.onLogout(() => { showAuth(); });

// --- Auth screen ---
function showAuth() {
  let mode = 'login';
  clear(root);
  const errBox = el('p.auth-err');
  const userInput = el('input', { placeholder: 'Username', autocomplete: 'username', autofocus: true });
  const passInput = el('input', { type: 'password', placeholder: 'Password (min 8)', autocomplete: 'current-password' });
  const submitBtn = el('button.btn.primary.block', { type: 'submit' }, 'Login');
  const toggle = el('button.link', { type: 'button' });

  const setMode = (m) => {
    mode = m; errBox.textContent = '';
    submitBtn.textContent = m === 'login' ? 'Login' : 'Create account';
    passInput.autocomplete = m === 'login' ? 'current-password' : 'new-password';
    toggle.textContent = m === 'login' ? "No account? Sign up" : 'Have an account? Log in';
    title.textContent = m === 'login' ? 'Welcome back' : 'Create your account';
  };
  toggle.addEventListener('click', () => setMode(mode === 'login' ? 'signup' : 'login'));

  const title = el('h1.auth-title');
  const form = el('form.auth-card', {
    onsubmit: async (e) => {
      e.preventDefault();
      errBox.textContent = '';
      submitBtn.disabled = true; submitBtn.textContent = 'Please wait…';
      try {
        const body = await api('POST', `/${mode}`, { username: userInput.value.trim(), password: passInput.value });
        setAuth(body.token, body.username);
        boot();
      } catch (err) {
        errBox.textContent = err.status === 0 ? 'Network error — is the server running?' : (err.message || 'Failed');
        submitBtn.disabled = false;
        setMode(mode);
      }
    },
  }, [
    el('div.flex.gap', {}, [
      tabBtn('Login', () => setMode('login'), () => mode === 'login'),
      tabBtn('Sign up', () => setMode('signup'), () => mode === 'signup'),
    ]),
    userInput, passInput, errBox, submitBtn,
    el('div.center', {}, toggle),
  ]);

  root.appendChild(el('div.auth-wrap', {}, [
    el('div.auth-brand', {}, [
      el('img', { src: '../assets/hdi-logo-transparent.png', alt: 'HDI' }),
      el('div', {}, [el('div.brand-name', {}, 'Workshop Studio'), el('div.brand-sub', {}, 'Design & run your workshops.')]),
    ]),
    title, form,
  ]));
  setMode('login');
}

function tabBtn(label, onClick, isActive) {
  const b = el('button.seg-tab', { type: 'button', onclick: () => { onClick(); rerenderTabs(); } }, label);
  b._active = isActive;
  const rerenderTabs = () => {
    for (const t of b.parentElement.querySelectorAll('.seg-tab')) t.classList.toggle('active', t._active());
  };
  setTimeout(rerenderTabs);
  return b;
}

// --- Authed shell + routing ---
function shell() {
  clear(root);
  const view = el('main#view.view');
  const nav = el('nav.top-nav', {}, [
    navLink('Workshops', '#/'),
    navLink('Idea bank', '#/bank'),
    el('span.nav-item.disabled', { title: 'Coming in Phase 2' }, 'Templates'),
  ]);
  const status = el('span.sync-status');
  const bar = el('header.appbar', {}, [
    el('a.brand', { href: '#/' }, [
      el('img.brand-logo', { src: '../assets/hdi-logo-transparent.png', alt: 'HDI' }),
      el('b', {}, 'Workshop Studio'),
    ]),
    nav,
    el('div.appbar-right', {}, [
      status,
      el('span.user-chip', {}, [
        el('span', {}, getUser() || 'account'),
        el('button.link', { onclick: logout }, 'Log out'),
      ]),
    ]),
  ]);
  root.appendChild(bar);
  root.appendChild(view);

  const updateStatus = () => {
    status.className = 'sync-status ' + (store.isOffline() ? 'offline' : 'ok');
    status.textContent = store.isOffline() ? 'offline — retrying' : (store.isLoaded() ? 'saved ✓' : 'syncing…');
  };
  store.subscribe(updateStatus);   // status only — each view owns its own re-render
  updateStatus();
  window.addEventListener('hashchange', () => route(view));
  route(view);
}

let viewTeardown = null;

function navLink(label, href) {
  return el('a.nav-item', { href }, label);
}

function route(view) {
  if (typeof viewTeardown === 'function') { viewTeardown(); viewTeardown = null; }
  const hash = location.hash || '#/';
  for (const a of document.querySelectorAll('.top-nav .nav-item')) {
    a.classList.toggle('active', a.getAttribute('href') === (hash.startsWith('#/w/') ? '#/' : hash));
  }
  const m = hash.match(/^#\/w\/([\w-]+)/);
  if (m) viewTeardown = renderPlanner(view, m[1]);
  else if (hash === '#/bank') viewTeardown = renderBank(view);
  else viewTeardown = renderDashboard(view);
}

function logout() { clearAuth(); showAuth(); }

async function boot() {
  shell();
  await store.load();
}

export function start() {
  if (!getToken()) showAuth();
  else boot();
}

start();
