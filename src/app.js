import { MultiguessController } from './modes/multiguess.js';
import { SortingController } from './modes/sorting.js';
import { getDailyDateKey, getPreviousDailyDateKeys } from './core/game.js';
import { fetchJSON, MenuRepository, resolveMenuVersion } from './core/menus.js';
import { installImageFallbacks } from './ui/dom.js';
import { installBrand, gameTitle, isCaloriedle } from './ui/brand.js';

installBrand();

const byId = id => document.getElementById(id);
const dailyButton = byId('multiguess-mode-btn');
const toggle = byId('other-modes-toggle');
const menu = byId('other-modes-menu');
const status = byId('load-status');
const retry = byId('retry-load');
const dialog = byId('image-overlay');
let repository;
let menuId;
let mode = 'daily';
let requestId = 0;
let requestedDate;
let countdown;
let imageOpener;
let previousBodyOverflow;
const daily = new MultiguessController({ onDailyComplete: addNextChallenges });
const sorting = new SortingController({ onImage: (_snapshot, _item, opener) => openFoodPhoto(opener) });

function openFoodPhoto(opener) {
    const source = opener.querySelector('img');
    const expanded = byId('overlay-image');
    const sourceCredit = opener.querySelector('.image-credit');
    const expandedCredit = expanded.parentElement.querySelector('.image-credit');
    imageOpener = opener;
    for (const key of ['cdn', 'cdnTried', 'fallback']) {
        delete expanded.dataset[key];
        if (source.dataset[key]) expanded.dataset[key] = source.dataset[key];
    }
    expanded.alt = source.alt;
    expandedCredit.textContent = sourceCredit?.textContent || '';
    expandedCredit.hidden = !expandedCredit.textContent || sourceCredit?.hidden;
    dialog.style.setProperty('--photo-ratio', (source.naturalWidth / source.naturalHeight) || 1);
    expanded.src = source.currentSrc || source.src;
    previousBodyOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
}

byId('overlay-image').addEventListener('load', event => {
    const image = event.currentTarget;
    dialog.style.setProperty('--photo-ratio', (image.naturalWidth / image.naturalHeight) || 1);
});
document.querySelectorAll('.photo-zoom').forEach(button => {
    button.addEventListener('click', () => openFoodPhoto(button));
});

installImageFallbacks();
function closeModes() { toggle.setAttribute('aria-expanded', 'false'); menu.classList.add('hidden'); }
toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('hidden', !open);
});
document.addEventListener('click', event => { if (!event.target.closest('.game-mode-selection')) closeModes(); });
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { closeModes(); toggle.focus(); }
});
byId('image-overlay-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('close', () => { document.body.style.overflow = previousBodyOverflow; imageOpener?.focus({ preventScroll: true }); });
byId('bell-pepper-farm').addEventListener('click', event => {
    const open = event.currentTarget.getAttribute('aria-expanded') !== 'true';
    event.currentTarget.setAttribute('aria-expanded', String(open));
    byId('closeup-container').classList.toggle('hidden', !open);
});
dailyButton.addEventListener('click', () => loadMode('daily'));
byId('discaloried-mode-btn').addEventListener('click', () => loadMode('sorting'));
byId('discaloried-hard-mode-btn').addEventListener('click', () => loadMode('hard'));
retry.addEventListener('click', () => repository ? loadMode(mode, requestedDate) : boot());
byId('menu-picker').addEventListener('change', event => { menuId = event.target.value; loadMode('daily'); });

function loading() {
    daily.deactivate();
    clearInterval(countdown);
    status.classList.remove('hidden');
    status.setAttribute('aria-busy', 'true');
    byId('load-message').textContent = 'Loading dishes…';
    retry.hidden = true;
    byId('multiguess-game').classList.add('hidden');
    byId('discaloried-game').classList.add('hidden');
    document.querySelectorAll('.mode-button').forEach(button => { button.disabled = true; });
    byId('menu-picker').disabled = true;
}
function failed(error) {
    status.removeAttribute('aria-busy');
    byId('load-message').textContent = 'We couldn’t load the dishes. Check your connection and try again.';
    retry.hidden = false;
    retry.focus();
    console.error('Unable to load game:', error);
}
function dateLabel(dateKey) {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
        .format(new Date(`${dateKey}T12:00:00Z`));
}

async function loadMode(nextMode, dateKey = getDailyDateKey()) {
    const sequence = ++requestId;
    mode = nextMode;
    requestedDate = dateKey;
    closeModes();
    loading();
    try {
        const context = await repository.load(menuId, dateKey);
        if (sequence !== requestId) return;
        status.classList.add('hidden');
        status.removeAttribute('aria-busy');
        const isDaily = mode === 'daily';
        // One toolbar persists through rounds, reviews, results and mode changes.
        byId(isDaily ? 'multiguess-game' : 'discaloried-game').prepend(byId('game-toolbar'));
        byId('multiguess-status').hidden = !isDaily;
        dailyButton.classList.toggle('active', isDaily);
        dailyButton.setAttribute('aria-pressed', String(isDaily));
        toggle.classList.toggle('active', !isDaily);
        byId('discaloried-mode-btn').setAttribute('aria-pressed', String(mode === 'sorting'));
        byId('discaloried-hard-mode-btn').setAttribute('aria-pressed', String(mode === 'hard'));
        toggle.firstChild.textContent = isDaily ? 'Other Modes ' : mode === 'hard' ? 'Discaloried · Hard ' : 'Discaloried ';
        byId('challenge-date').textContent = isDaily ? `${dateLabel(dateKey)}${dateKey !== getDailyDateKey() ? ' · Archive' : ''}` : '';
        if (isDaily) {
            byId('multiguess-game').classList.remove('hidden');
            daily.init(context);
        } else {
            byId('discaloried-game').classList.remove('hidden');
            sorting.init(context, mode === 'hard');
        }
        const url = new URL(location.href);
        url.searchParams.set('menu', menuId);
        if (isDaily) url.searchParams.set('date', dateKey); else url.searchParams.delete('date');
        history.replaceState(null, '', url);
        document.title = `${gameTitle(context.menu)} · ${context.menu.name}`;
        document.querySelector('h1').textContent = gameTitle(context.menu);
        document.querySelector('.logo-image').hidden = menuId !== 'cheesecake-factory';
        document.querySelector('h1').classList.toggle('sr-only', isCaloriedle() || menuId === 'cheesecake-factory');
        document.querySelectorAll('.mode-button').forEach(button => { button.disabled = false; });
        byId('menu-picker').disabled = false;
    } catch (error) { if (sequence === requestId) failed(error); }
}

function addNextChallenges(container) {
    clearInterval(countdown);
    const note = document.createElement('p');
    note.className = 'daily-next-message';
    // The ticking timer is intentionally outside a live region.
    const update = () => {
        if (!container.isConnected || mode !== 'daily') return clearInterval(countdown);
        const now = new Date();
        if (getDailyDateKey(now) > daily.dateKey) {
            note.textContent = 'Today’s daily is ready.';
            if (!container.querySelector('.today-button')) {
                const button = document.createElement('button');
                button.className = 'daily-previous-button today-button';
                button.textContent = 'Play Today';
                button.addEventListener('click', () => loadMode('daily'));
                note.after(button);
            }
            return;
        }
        const next = new Date(now); next.setUTCHours(24, 0, 0, 0);
        const seconds = Math.ceil((next - now) / 1000);
        note.textContent = `Next daily in ${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m ${seconds % 60}s`;
    };
    container.append(note);
    update();
    countdown = setInterval(update, 1000);
    const archive = document.createElement('div');
    archive.className = 'daily-previous-dailies';
    const label = document.createElement('p'); label.textContent = 'Previous dailies'; label.className = 'daily-previous-dailies__label'; archive.append(label);
    getPreviousDailyDateKeys().filter(key => key !== daily.dateKey && (!daily.context.menu.firstPlayableDate || key >= daily.context.menu.firstPlayableDate)).forEach(key => {
        try { resolveMenuVersion(daily.context.menu, key); } catch { return; }
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'daily-previous-button'; button.textContent = dateLabel(key);
        button.addEventListener('click', () => loadMode('daily', key)); archive.append(button);
    });
    if (archive.children.length > 1) container.append(archive);
}

async function boot() {
    loading();
    try {
        const registry = await fetchJSON('data/menus.json');
        repository = new MenuRepository(registry);
        const params = new URLSearchParams(location.search);
        menuId = registry.menus.some(menu => menu.id === params.get('menu')) ? params.get('menu') : registry.defaultMenu;
        const date = params.get('date');
        const today = getDailyDateKey();
        const selectedMenu = registry.menus.find(menu => menu.id === menuId);
        const validDate = (!selectedMenu.firstPlayableDate || date >= selectedMenu.firstPlayableDate) && /^\d{4}-\d{2}-\d{2}$/.test(date || '') && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date && date <= today;
        byId('menu-picker').replaceChildren(...registry.menus.map(menu => {
            const option = document.createElement('option'); option.value = menu.id; option.textContent = menu.name; return option;
        }));
        byId('menu-picker').value = menuId;
        byId('menu-picker-container').hidden = registry.menus.length < 2;
        await loadMode('daily', validDate ? date : today);
    } catch (error) { failed(error); }
}
boot();
