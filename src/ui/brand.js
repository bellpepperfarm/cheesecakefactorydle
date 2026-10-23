// Brand presentation only: menu snapshots, challenge rules and saves stay shared.
export const isCaloriedle = () => document.documentElement.dataset.brand === 'caloriedle';
export const gameTitle = menu => isCaloriedle() ? 'Caloriedle' : menu.gameTitle || 'Daily Calories';

export function installBrand() {
    if (!isCaloriedle()) return;
    document.title = 'Caloriedle';
    document.querySelector('h1').textContent = 'Caloriedle';
    const icon = document.querySelector('link[rel="icon"]');
    icon.href = 'assets/caloriedle/01-c.webp';
    icon.type = 'image/webp';
    const header = document.getElementById('caloriedle-header');
    // Render both outlines from the alpha silhouette without altering the images.
    // The red edge grows 1.5px; the white sticker border stays 3px beyond it.
    const filters = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    filters.setAttribute('width', '0');
    filters.setAttribute('height', '0');
    filters.setAttribute('aria-hidden', 'true');
    filters.setAttribute('focusable', 'false');
    filters.style.position = 'absolute';
    filters.innerHTML = `<defs>
        <filter id="caloriedle-sticker" x="-30%" y="-20%" width="160%" height="140%" color-interpolation-filters="sRGB">
            <feMorphology in="SourceAlpha" operator="dilate" radius="4.5" result="stickerOutline" />
            <feFlood flood-color="white" />
            <feComposite in2="stickerOutline" operator="in" result="sticker" />
            <feMorphology in="SourceAlpha" operator="dilate" radius="1.5" result="redOutline" />
            <feFlood flood-color="#801b19" />
            <feComposite in2="redOutline" operator="in" result="redEdge" />
            <feMerge><feMergeNode in="sticker" /><feMergeNode in="redEdge" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
    </defs>`;
    const wordmark = document.createElement('div');
    wordmark.className = 'caloriedle-wordmark';
    wordmark.setAttribute('role', 'img');
    wordmark.setAttribute('aria-label', 'Caloriedle');
    // Widths match the source-image slices; a common height preserves the baseline.
    const widths = [287, 273, 135, 255, 253, 132, 238, 272, 134, 236];
    [...'caloriedle'].forEach((letter, index) => {
        const image = document.createElement('img');
        image.src = `assets/caloriedle/${String(index + 1).padStart(2, '0')}-${letter}.webp`;
        image.alt = '';
        image.width = widths[index];
        image.height = 453;
        image.draggable = false;
        image.style.width = `${widths[index] / 2215 * 100}%`;
        image.style.setProperty('--sway-duration', `${5.8 + index % 4 * .65}s`);
        image.style.setProperty('--sway-delay', `${-index * .73}s`);
        wordmark.append(image);
    });
    header.replaceChildren(filters, wordmark);
}
