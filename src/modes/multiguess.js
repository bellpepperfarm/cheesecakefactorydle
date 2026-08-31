import {
    GAME_CONFIG,
    calculateMultiguessScore,
    createSeededRandom,
    getDailyDateKey,
    getScoreTier,
    getValidProducts,
    shuffleItems
} from '../core/game.js';
import { DailyStorage, STORAGE_KEYS } from '../core/storage.js';
import { createCelebrationBits, setProgressBar } from '../ui/progress.js';

export class MultiguessController {
    constructor({ menuData, onDailyComplete }) {
        this.menuData = menuData;
        this.onDailyComplete = onDailyComplete;
        this.storage = new DailyStorage(STORAGE_KEYS.multiguess);
        this.items = [];
        this.itemIndex = 0;
        this.results = [];
        this.awaitingNext = false;
        this.elements = this.getElements();
        this.bindEvents();
    }

    getElements() {
        const byId = id => document.getElementById(id);
        return {
            round: byId('multiguess-round'),
            progress: byId('multiguess-progress'),
            score: byId('multiguess-score'),
            foodImage: byId('multiguess-food-image'),
            foodName: byId('multiguess-food-name'),
            foodDescription: byId('multiguess-food-description'),
            guessForm: byId('multiguess-guess-form'),
            calorieGuess: byId('multiguess-calorie-guess'),
            submitGuess: byId('multiguess-submit-guess'),
            feedback: byId('multiguess-feedback'),
            review: byId('multiguess-review'),
            reviewProgress: byId('multiguess-review-progress'),
            reviewTotal: byId('multiguess-review-total'),
            reviewImage: byId('multiguess-review-image'),
            reviewName: byId('multiguess-review-name'),
            reviewGuess: byId('multiguess-review-guess'),
            reviewActual: byId('multiguess-review-actual'),
            reviewScore: byId('multiguess-review-score'),
            reviewMeter: byId('multiguess-review-meter'),
            reviewDifference: byId('multiguess-review-difference'),
            nextItem: byId('multiguess-next-item'),
            result: byId('multiguess-result')
        };
    }

    bindEvents() {
        this.elements.guessForm.addEventListener('submit', event => {
            event.preventDefault();
            this.handleGuess();
        });
        this.elements.nextItem.addEventListener('click', () => this.advance());
    }

    init() {
        const validProducts = getValidProducts(this.menuData, true);
        const random = createSeededRandom(`multiguess:${getDailyDateKey()}`);
        this.items = shuffleItems(validProducts, random).slice(0, GAME_CONFIG.multiguessItemCount);
        this.itemIndex = 0;
        this.results = [];
        this.awaitingNext = false;
        this.elements.round.classList.remove('hidden');
        this.elements.review.classList.add('hidden');
        this.elements.result.className = 'result-message hidden';
        this.restore();
    }

    restore() {
        const state = this.storage.read();
        const challengeIds = this.items.map(item => String(item.id));
        const savedIds = Array.isArray(state?.itemIds) ? state.itemIds.map(String) : [];

        if (!state || challengeIds.join(',') !== savedIds.join(',')) {
            this.displayItem();
            this.save('guessing');
            return;
        }

        const savedGuesses = Array.isArray(state.guesses)
            ? state.guesses.filter(guess => Number.isFinite(guess) && guess >= 0)
                .slice(0, GAME_CONFIG.multiguessItemCount)
            : [];
        this.results = savedGuesses.map((guess, index) => this.createResult(this.items[index], guess));

        if (state.status === 'complete' && this.results.length === GAME_CONFIG.multiguessItemCount) {
            this.itemIndex = GAME_CONFIG.multiguessItemCount - 1;
            this.showResult();
        } else if (state.status === 'review' && this.results.length > 0) {
            this.itemIndex = this.results.length - 1;
            this.awaitingNext = true;
            this.showReview(this.results.at(-1));
        } else {
            this.itemIndex = Math.min(this.results.length, GAME_CONFIG.multiguessItemCount - 1);
            this.displayItem();
        }
    }

    save(status) {
        this.storage.write({
            status,
            itemIds: this.items.map(item => String(item.id)),
            guesses: this.results.map(result => result.guess)
        });
    }

    createResult(item, guess) {
        const actualCalories = Number.parseInt(item.basecalories, 10);
        return { item, guess, actualCalories, score: calculateMultiguessScore(guess, actualCalories) };
    }

    get totalScore() {
        return this.results.reduce((total, result) => total + result.score, 0);
    }

    displayItem() {
        const item = this.items[this.itemIndex];
        const { elements } = this;
        elements.round.classList.remove('hidden');
        elements.review.classList.add('hidden');
        elements.progress.textContent = `Daily · Item ${this.itemIndex + 1} of ${GAME_CONFIG.multiguessItemCount}`;
        elements.score.textContent = `Score: ${this.totalScore} / ${this.maxScore}`;
        elements.foodImage.src = `${this.menuData.imagepath}${item.imagefilename}`;
        elements.foodImage.alt = item.name;
        elements.foodName.textContent = item.name;
        elements.foodDescription.textContent = item.description || '';
        elements.calorieGuess.value = '';
        elements.calorieGuess.disabled = false;
        elements.submitGuess.disabled = false;
        elements.feedback.textContent = '';
        this.awaitingNext = false;
        elements.calorieGuess.focus();
    }

    handleGuess() {
        const { calorieGuess, feedback, submitGuess } = this.elements;
        if (this.awaitingNext || this.items.length === 0) return;

        const guess = Number(calorieGuess.value);
        if (!Number.isFinite(guess) || guess < 0 || calorieGuess.value.trim() === '') {
            feedback.textContent = 'Please enter a valid number of calories.';
            return;
        }

        const result = this.createResult(this.items[this.itemIndex], guess);
        this.results.push(result);
        this.awaitingNext = true;
        calorieGuess.disabled = true;
        submitGuess.disabled = true;
        this.save('review');
        this.showReview(result);
    }

    showReview(result) {
        // The review itself is the source of truth for the transition guard. This
        // also makes restored sessions resilient if an earlier event reset state.
        this.awaitingNext = true;
        const difference = result.guess - result.actualCalories;
        const percentOff = Math.abs(difference) / result.actualCalories * 100;
        const differenceText = difference === 0
            ? 'Perfect guess — exactly right!'
            : `${Math.abs(difference)} calories ${difference > 0 ? 'high' : 'low'} · ${percentOff.toFixed(1)}% off`;
        const { elements } = this;

        elements.reviewProgress.textContent = `Daily · Item ${this.itemIndex + 1} of ${GAME_CONFIG.multiguessItemCount}`;
        elements.reviewTotal.textContent = `Total: ${this.totalScore} / ${this.maxScore}`;
        elements.reviewImage.src = `${this.menuData.imagepath}${result.item.imagefilename}`;
        elements.reviewImage.alt = result.item.name;
        elements.reviewName.textContent = result.item.name;
        elements.reviewGuess.textContent = `${result.guess} cal`;
        elements.reviewActual.textContent = `${result.actualCalories} cal`;
        elements.reviewScore.textContent = `${result.score} / ${GAME_CONFIG.multiguessMaxItemScore}`;
        elements.reviewDifference.textContent = differenceText;
        elements.nextItem.textContent = this.itemIndex === GAME_CONFIG.multiguessItemCount - 1
            ? 'See Final Score'
            : 'Next Item';
        setProgressBar(elements.reviewMeter, result.score, GAME_CONFIG.multiguessMaxItemScore, {
            label: 'Points earned this round'
        });

        elements.round.classList.add('hidden');
        elements.review.classList.remove('hidden');
        elements.review.classList.remove('is-entering');
        requestAnimationFrame(() => elements.review.classList.add('is-entering'));
    }

    advance() {
        if (this.itemIndex < GAME_CONFIG.multiguessItemCount - 1) {
            this.itemIndex++;
            this.displayItem();
            this.save('guessing');
        } else {
            this.showResult();
            this.save('complete');
        }
    }

    get maxScore() {
        return GAME_CONFIG.multiguessItemCount * GAME_CONFIG.multiguessMaxItemScore;
    }

    showResult() {
        const scoreTier = getScoreTier(this.totalScore, this.maxScore);
        const summary = this.results.map((result, index) => `
            <li style="--summary-index: ${index}">
                <div class="multiguess-summary__copy">
                    <span>${result.item.name}</span>
                    <span>${result.guess} vs. ${result.actualCalories} cal — ${result.score} pts</span>
                </div>
                <div class="mini-progress" aria-label="${result.score} of ${GAME_CONFIG.multiguessMaxItemScore} points">
                    <span style="--mini-progress: ${Math.round(result.score / GAME_CONFIG.multiguessMaxItemScore * 100)}%"></span>
                </div>
            </li>
        `).join('');
        const { elements } = this;

        elements.round.classList.add('hidden');
        elements.review.classList.add('hidden');
        elements.result.className = 'result-message multiguess-final celebrate';
        elements.result.innerHTML = `
            <p class="multiguess-final-kicker">Challenge complete</p>
            <h2>${scoreTier.label}</h2>
            <p class="multiguess-final-score">${this.totalScore} <small>/ ${this.maxScore}</small></p>
            <div id="multiguess-final-meter" class="progress-viz progress-viz--${scoreTier.tone}"></div>
            <ul class="multiguess-summary">${summary}</ul>
        `;
        setProgressBar(document.getElementById('multiguess-final-meter'), this.totalScore, this.maxScore, {
            label: 'Total score',
            size: 'hero',
            delay: 180
        });
        createCelebrationBits(elements.result);
        this.onDailyComplete(elements.result);
        elements.result.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}
