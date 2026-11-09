export function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}

export function imageURL(snapshot, item) {
    return new URL(item.imagefilename, new URL((item.imagepath ?? snapshot.imagepath) || './', document.baseURI)).href;
}

export function photoHTML(snapshot, item, className = '') {
    const remote = imageURL(snapshot, item);
    const src = item.localImage || remote;
    const credit = item.imageCredit ?? snapshot.imageCredit;
    return `<span class="food-photo"><img class="${escapeHTML(className)}" src="${escapeHTML(src)}" data-cdn="${escapeHTML(remote)}" alt="${escapeHTML(item.name)}" draggable="false">${credit ? `<span class="image-credit">${escapeHTML(credit)}</span>` : ''}</span>`;
}

export function setFoodImage(image, snapshot, item) {
    delete image.dataset.fallback;
    delete image.dataset.cdnTried;
    image.dataset.cdn = imageURL(snapshot, item);
    image.src = item.localImage || image.dataset.cdn;
    image.alt = item.name;
    const caption = image.parentElement.querySelector('.image-credit');
    const credit = item.imageCredit ?? snapshot.imageCredit;
    if (caption) { caption.textContent = credit || ''; caption.hidden = !credit; }
}

export function installImageFallbacks() {
    document.addEventListener('error', event => {
        const image = event.target;
        if (!(image instanceof HTMLImageElement) || image.dataset.fallback === 'true') return;
        if (image.dataset.cdn && !image.dataset.cdnTried && image.src !== image.dataset.cdn) {
            image.dataset.cdnTried = 'true';
            image.src = image.dataset.cdn;
            return;
        }
        image.dataset.fallback = 'true';
        image.alt = `${image.alt || 'Food image'} — photo unavailable`;
        image.src = 'assets/food-placeholder.svg';
        const caption = image.parentElement.querySelector('.image-credit');
        if (caption) caption.hidden = true;
    }, true);
}

export function focusHeading(element) {
    element.tabIndex = -1;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ behavior: 'instant', block: 'nearest' });
}
