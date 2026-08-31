export function setProgressBar(container, value, max, options = {}) {
    const safeMax = Math.max(1, max);
    const safeValue = Math.min(safeMax, Math.max(0, value));
    const percent = Math.round((safeValue / safeMax) * 100);
    const label = options.label || 'Score progress';
    const delay = options.delay || 0;

    container.classList.toggle('progress-viz--hero', options.size === 'hero');
    container.innerHTML = `
        <div class="progress-viz__labels">
            <span>${label}</span>
            <strong>${percent}%</strong>
        </div>
        <div class="progress-viz__track" role="progressbar" aria-label="${label}"
            aria-valuemin="0" aria-valuemax="${safeMax}" aria-valuenow="${safeValue}">
            <span class="progress-viz__fill"></span>
            <i class="progress-viz__spark" aria-hidden="true"></i>
        </div>
    `;

    const fill = container.querySelector('.progress-viz__fill');
    fill.style.setProperty('--progress-delay', `${delay}ms`);
    requestAnimationFrame(() => fill.style.setProperty('--progress', `${percent}%`));
}

export function createCelebrationBits(container, count = 18) {
    const colors = ['#e31837', '#f7b32b', '#6aa84f', '#7c3aed', '#00a6a6'];
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < count; index++) {
        const bit = document.createElement('i');
        bit.className = 'celebration-bit';
        bit.setAttribute('aria-hidden', 'true');
        bit.style.setProperty('--bit-x', `${8 + ((index * 37) % 84)}%`);
        bit.style.setProperty('--bit-delay', `${(index % 7) * 70}ms`);
        bit.style.setProperty('--bit-color', colors[index % colors.length]);
        bit.style.setProperty('--bit-rotation', `${(index * 47) % 180}deg`);
        fragment.appendChild(bit);
    }
    container.appendChild(fragment);
}
