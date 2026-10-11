import { shuffleItems } from '../core/game.js';
import { escapeHTML, photoHTML, focusHeading } from '../ui/dom.js';

export function selectSortingItems(products, hard = false, random = Math.random) {
    if (products.length < 5) throw new Error('At least five dishes are required.');
    if (!hard) return shuffleItems(products, random).slice(0, 5);
    const unique = [...new Map(shuffleItems(products, random).map(item => [item.basecalories, item])).values()];
    const sorted = unique.sort((a, b) => a.basecalories - b.basecalories);
    const starts = shuffleItems(sorted, random);
    for (const first of starts) {
        const candidates = sorted.filter(item => item !== first && item.basecalories > first.basecalories && item.basecalories <= first.basecalories + 700);
        const high = candidates.filter(item => item.basecalories >= first.basecalories + 300);
        if (candidates.length < 4 || !high.length) continue;
        const last = high[Math.floor(random() * high.length)];
        return shuffleItems([first, last, ...shuffleItems(candidates.filter(item => item !== last), random).slice(0, 3)], random);
    }
    // A small future menu may not support the hard constraints. Bounded fallback.
    return shuffleItems(unique.length >= 5 ? unique : products, random).slice(0, 5);
}

export function correctPositions(items) {
    const calories = items.map(item => item.basecalories).sort((a, b) => b - a);
    return items.map((item, index) => item.basecalories === calories[index]);
}

export class SortingController {
    constructor({ onImage }) {
        this.onImage = onImage;
        this.list = document.getElementById('discaloried-items');
        this.feedback = document.getElementById('discaloried-feedback');
        this.result = document.getElementById('discaloried-result');
        this.submit = document.getElementById('discaloried-guess-btn');
        this.submit.addEventListener('click', () => this.guess());
        this.list.addEventListener('click', event => {
            const button = event.target.closest('button');
            if (!button) return;
            const index = Number(button.closest('[data-index]').dataset.index);
            if (button.dataset.action === 'image') this.onImage(this.context.snapshot, this.items[index], button);
            else this.move(index, Number(button.dataset.direction));
        });
        this.list.addEventListener('dragstart', event => {
            const card = event.target.closest('[data-index]');
            if (!card || !this.active || this.locked.has(Number(card.dataset.index))) return event.preventDefault();
            this.dragged = Number(card.dataset.index);
            event.dataTransfer.setData('text/plain', String(this.dragged));
        });
        this.list.addEventListener('dragover', event => event.preventDefault());
        this.list.addEventListener('drop', event => {
            event.preventDefault();
            const card = event.target.closest('[data-index]');
            if (card && Number.isInteger(this.dragged)) this.swap(this.dragged, Number(card.dataset.index));
            this.dragged = null;
        });
        this.list.addEventListener('dragend', () => { this.dragged = null; });
    }

    init(context, hard = false) {
        this.context = context;
        this.hard = hard;
        this.items = selectSortingItems(context.snapshot.products, hard);
        this.locked = new Set();
        this.remaining = 5;
        this.active = true;
        this.dragged = null;
        this.feedback.textContent = '';
        this.result.replaceChildren();
        this.result.className = 'result-message hidden';
        document.getElementById('sorting-title').textContent = hard ? 'Discaloried · Hard' : 'Discaloried';
        this.render();
        focusHeading(document.getElementById('sorting-title'));
    }

    neighbor(index, direction) {
        for (let next = index + direction; next >= 0 && next < this.items.length; next += direction) {
            if (!this.locked.has(next)) return next;
        }
        return -1;
    }

    move(index, direction) {
        const next = this.neighbor(index, direction);
        if (next >= 0) this.swap(index, next, direction);
    }

    swap(from, to, direction = 1) {
        if (!this.active || this.locked.has(from) || this.locked.has(to) || from === to) return;
        [this.items[from], this.items[to]] = [this.items[to], this.items[from]];
        this.render();
        this.feedback.textContent = `${this.items[to].name} moved to position ${to + 1}.`;
        const card = this.list.children[to];
        const control = card.querySelector(`[data-direction="${direction}"]:not(:disabled)`) || card.querySelector('.sort-controls button:not(:disabled)');
        (control || card).focus();
    }

    render(reveal = false) {
        document.getElementById('discaloried-guesses').textContent = this.remaining;
        this.submit.disabled = !this.active;
        this.list.innerHTML = this.items.map((item, index) => {
            const locked = this.locked.has(index);
            return `<li class="discaloried-box ${locked ? 'locked' : ''}" data-index="${index}" tabindex="-1" draggable="${this.active && !locked}">
                <span class="sort-position" aria-label="Position ${index + 1}">${index + 1}</span>
                <button class="photo-button" type="button" data-action="image" aria-label="Enlarge photo of ${escapeHTML(item.name)}">${photoHTML(this.context.snapshot, item, 'discaloried-item-image')}</button>
                <div class="discaloried-item-info"><h3>${escapeHTML(item.name)}</h3>
                <p class="portion-label">${escapeHTML(item.portion)}</p>
                <p class="discaloried-item-description">${escapeHTML(item.description)}</p>
                ${reveal ? `<strong>${item.basecalories} cal</strong>` : ''}
                ${locked ? '<span class="locked-label">✓ Locked</span>' : ''}</div>
                <div class="sort-controls" ${!this.active || locked ? 'hidden' : ''}>
                    <button type="button" data-direction="-1" aria-label="Move ${escapeHTML(item.name)} up" ${this.neighbor(index, -1) < 0 ? 'disabled' : ''}>↑</button>
                    <button type="button" data-direction="1" aria-label="Move ${escapeHTML(item.name)} down" ${this.neighbor(index, 1) < 0 ? 'disabled' : ''}>↓</button>
                </div></li>`;
        }).join('');
    }

    guess() {
        if (!this.active) return;
        const correct = correctPositions(this.items);
        const previousCount = this.locked.size;
        correct.forEach((match, index) => { if (match) this.locked.add(index); });
        this.remaining--;
        const won = this.locked.size === this.items.length;
        this.active = !won && this.remaining > 0;
        if (this.active) {
            const added = this.locked.size - previousCount;
            this.feedback.textContent = `${added ? `${added} new ${added === 1 ? 'dish' : 'dishes'} locked.` : 'No new dishes locked.'} ${this.remaining} guesses remaining.`;
            this.render();
            return;
        }
        this.feedback.textContent = '';
        this.render(true);
        const correctOrder = [...this.items].sort((a, b) => b.basecalories - a.basecalories);
        this.result.className = `result-message ${won ? 'celebrate' : 'game-over'}`;
        this.result.innerHTML = `<h2 tabindex="-1">${won ? 'Perfect order!' : 'Here’s the correct order'}</h2>
            <ol class="sorting-answer">${correctOrder.map(item => `<li><span>${escapeHTML(item.name)} <small>${escapeHTML(item.portion)}</small></span><strong>${item.basecalories} cal</strong></li>`).join('')}</ol>
            <button type="button" class="play-again">Play Again</button>`;
        this.result.querySelector('button').addEventListener('click', () => this.init(this.context, this.hard));
        focusHeading(this.result.querySelector('h2'));
    }
}
