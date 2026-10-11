import {
    GAME_CONFIG,
    calculateMultiguessScore,
    getDailyDateKey,
    getScoreTier,
} from '../core/game.js';
import { DailyStorage } from '../core/storage.js';
import { animateCount, easing, prefersReducedMotion } from '../ui/count-up.js';
import { createCelebrationBits, setProgressBar, updateProgressBar } from '../ui/progress.js';

import { selectDailyItems } from '../core/menus.js';
import { escapeHTML, setFoodImage, focusHeading } from '../ui/dom.js';
import { buildShareText } from '../core/share.js';

export const REVIEW_TIMING = Object.freeze({
    guessCountUp: 1000,
    actualCaloriesCountUp: 4000,
    lockImpact: 520,
    verdictDelay: 220
});

export class MultiguessController {
    constructor({ onDailyComplete }) {
        this.onDailyComplete = onDailyComplete;
        this.dateKey = getDailyDateKey();
        this.items = [];
        this.itemIndex = 0;
        this.results = [];
        this.awaitingNext = false;
        this.reviewSequenceId = 0;
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
            foodPortion: byId('multiguess-food-portion'),
            guessForm: byId('multiguess-guess-form'),
            calorieGuess: byId('multiguess-calorie-guess'),
            submitGuess: byId('multiguess-submit-guess'),
            feedback: byId('multiguess-feedback'),
            review: byId('multiguess-review'),
            reviewAnnouncement: byId('multiguess-review-announcement'),
            reviewProgress: byId('multiguess-review-progress'),
            reviewTotal: byId('multiguess-review-total'),
            reviewImage: byId('multiguess-review-image'),
            reviewName: byId('multiguess-review-name'),
            reviewPortion: byId('multiguess-review-portion'),
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

    init(context) {
        this.context = context;
        this.rules = context.rules;
        this.menuData = context.snapshot;
        this.dateKey = context.dateKey;
        this.active = true;
        this.reviewSequenceId++;
        this.storage = new DailyStorage(`calorie-game:${context.menu.id}:daily:`, undefined, GAME_CONFIG.multiguessReplayDays + 1);
        this.items = selectDailyItems(context.snapshot, context.version, this.dateKey);
        this.itemIndex = 0;
        this.results = [];
        this.awaitingNext = false;
        this.elements.round.classList.remove('hidden');
        this.elements.review.classList.add('hidden');
        this.elements.result.className = 'result-message hidden';
        this.restore();
    }

    restore() {
        let state = this.storage.read(this.dateKey);
        if (!state && ['v1', 'v2'].includes(this.context.version.id) && this.context.menu.legacyStoragePrefix) {
            state = new DailyStorage(this.context.menu.legacyStoragePrefix).read(this.dateKey);
        }
        const challengeIds = this.items.map(item => String(item.id));
        const savedIds = Array.isArray(state?.itemIds) ? state.itemIds.map(String) : [];

        if (!state || (state.menuVersion && state.menuVersion !== this.context.version.id) || challengeIds.join(',') !== savedIds.join(',')) {
            this.displayItem();
            this.save('guessing');
            return;
        }

        const savedGuesses = Array.isArray(state.guesses)
            ? state.guesses.filter(guess => Number.isSafeInteger(guess) && guess >= 0)
                .slice(0, this.rules.itemCount)
            : [];
        this.results = savedGuesses.map((guess, index) => this.createResult(this.items[index], guess));

        if (this.results.length === this.rules.itemCount && state.status !== 'review') {
            this.itemIndex = this.rules.itemCount - 1;
            this.showResult();
        } else if (state.status === 'review' && this.results.length > 0) {
            this.itemIndex = this.results.length - 1;
            this.awaitingNext = true;
            this.showReview(this.results.at(-1), { animate: false });
        } else {
            this.itemIndex = Math.min(this.results.length, this.rules.itemCount - 1);
            this.displayItem();
        }
    }

    save(status) {
        this.storage.write({
            status,
            menuVersion: this.context.version.id,
            rulesVersion: this.context.version.rules,
            itemIds: this.items.map(item => String(item.id)),
            guesses: this.results.map(result => result.guess)
        }, this.dateKey);
    }

    createResult(item, guess) {
        const actualCalories = Number.parseInt(item.basecalories, 10);
        return { item, guess, actualCalories, score: calculateMultiguessScore(guess, actualCalories, this.rules) };
    }

    get totalScore() {
        return this.results.reduce((total, result) => total + result.score, 0);
    }

    displayItem() {
        this.reviewSequenceId++;
        const item = this.items[this.itemIndex];
        const { elements } = this;
        elements.round.classList.remove('hidden');
        elements.review.classList.add('hidden');
        elements.progress.textContent = `${this.itemIndex + 1} / ${this.rules.itemCount}`;
        elements.score.textContent = `Score: ${this.totalScore} / ${this.maxScore}`;
        setFoodImage(elements.foodImage, this.menuData, item);
        elements.foodPortion.textContent = item.portion;
        elements.foodName.textContent = item.name;
        elements.foodDescription.textContent = item.description || '';
        elements.calorieGuess.value = '';
        elements.calorieGuess.disabled = false;
        elements.submitGuess.disabled = false;
        elements.feedback.textContent = '';
        this.awaitingNext = false;
        focusHeading(elements.foodName);
    }

    handleGuess() {
        const { calorieGuess, feedback, submitGuess } = this.elements;
        if (!this.active || this.awaitingNext || this.items.length === 0) return;

        const guess = Number(calorieGuess.value);
        if (!Number.isSafeInteger(guess) || guess < 0 || calorieGuess.value.trim() === '') {
            feedback.textContent = 'Please enter a whole number of calories.';
            calorieGuess.setAttribute('aria-invalid', 'true');
            return;
        }

        calorieGuess.removeAttribute('aria-invalid');
        const result = this.createResult(this.items[this.itemIndex], guess);
        this.results.push(result);
        this.awaitingNext = true;
        calorieGuess.disabled = true;
        submitGuess.disabled = true;
        this.save('review');
        this.showReview(result);
    }

    showReview(result, { animate = true } = {}) {
        // The review itself is the source of truth for the transition guard. This
        // also makes restored sessions resilient if an earlier event reset state.
        this.awaitingNext = true;
        const difference = result.guess - result.actualCalories;
        const percentOff = Math.abs(difference) / result.actualCalories * 100;
        const differenceText = difference === 0
            ? 'Perfect guess — exactly right!'
            : `${Math.abs(difference)} calories ${difference > 0 ? 'high' : 'low'} · ${percentOff.toFixed(1)}% off`;
        const { elements } = this;
        const previousTotal = this.totalScore - result.score;
        const sequenceId = ++this.reviewSequenceId;
        const shouldRunSequence = animate && !prefersReducedMotion();

        elements.reviewProgress.textContent = `${this.itemIndex + 1} / ${this.rules.itemCount}`;
        elements.reviewAnnouncement.textContent = '';
        elements.reviewTotal.textContent = `Total: ${shouldRunSequence ? previousTotal : this.totalScore} / ${this.maxScore}`;
        setFoodImage(elements.reviewImage, this.menuData, result.item);
        elements.reviewPortion.textContent = result.item.portion;
        elements.reviewName.textContent = result.item.name;
        elements.reviewGuess.textContent = shouldRunSequence ? '0 cal' : `${result.guess} cal`;
        elements.reviewActual.textContent = shouldRunSequence ? '0 cal' : `${result.actualCalories} cal`;
        elements.reviewScore.textContent = shouldRunSequence ? `0 / ${this.rules.maxItemScore}` : `${result.score} / ${this.rules.maxItemScore}`;
        elements.reviewDifference.textContent = differenceText;
        elements.nextItem.textContent = this.itemIndex === this.rules.itemCount - 1
            ? 'See Final Score'
            : 'Next Item';
        elements.nextItem.disabled = shouldRunSequence;
        this.resetReviewStages();
        setProgressBar(elements.reviewMeter, shouldRunSequence ? 0 : result.score, this.rules.maxItemScore, {
            label: 'Points earned this round'
        });

        elements.round.classList.add('hidden');
        elements.review.classList.remove('hidden');
        focusHeading(elements.reviewName);
        elements.review.classList.remove('is-entering');
        requestAnimationFrame(() => elements.review.classList.add('is-entering'));

        if (shouldRunSequence) {
            this.runReviewSequence(result, previousTotal, sequenceId);
        } else {
            this.completeReviewSequence(result);
        }
    }

    resetReviewStages() {
        const { review, reviewMeter } = this.elements;
        review.classList.remove('review-phase-guess', 'review-phase-calculating', 'review-phase-locked');
        reviewMeter.classList.remove('progress-viz--live', 'is-locked');
        review.querySelectorAll('.review-stage').forEach(stage => {
            stage.classList.remove('is-revealed', 'is-locking', 'is-locked');
            stage.setAttribute('aria-hidden', 'true');
        });
    }

    revealStages(...stageNames) {
        stageNames.forEach(stageName => {
            this.elements.review.querySelectorAll(`[data-review-stage="${stageName}"]`).forEach(stage => {
                stage.classList.add('is-revealed');
                stage.setAttribute('aria-hidden', 'false');
            });
        });
    }

    async runReviewSequence(result, previousTotal, sequenceId) {
        const { elements } = this;
        const isCurrent = () => this.active && sequenceId === this.reviewSequenceId;

        elements.review.classList.add('review-phase-guess');
        this.revealStages('guess');
        const guessCompleted = await animateCount({
            to: result.guess,
            duration: REVIEW_TIMING.guessCountUp,
            easingFunction: easing.outCubic,
            shouldContinue: isCurrent,
            onUpdate: value => {
                elements.reviewGuess.textContent = `${value.toLocaleString()} cal`;
            }
        });
        if (!guessCompleted || !isCurrent()) return;

        elements.review.classList.remove('review-phase-guess');
        elements.review.classList.add('review-phase-calculating');
        elements.reviewMeter.classList.add('progress-viz--live');
        this.revealStages('actual', 'points', 'score');

        const actualCompleted = await animateCount({
            to: result.actualCalories,
            duration: REVIEW_TIMING.actualCaloriesCountUp,
            easingFunction: easing.linear,
            shouldContinue: isCurrent,
            onUpdate: value => {
                const liveScore = value > 0 ? calculateMultiguessScore(result.guess, value, this.rules) : 0;
                elements.reviewActual.textContent = `${value.toLocaleString()} cal`;
                elements.reviewScore.textContent = `${liveScore.toLocaleString()} / ${this.rules.maxItemScore}`;
                elements.reviewTotal.textContent = `Total: ${(previousTotal + liveScore).toLocaleString()} / ${this.maxScore}`;
                updateProgressBar(elements.reviewMeter, liveScore, this.rules.maxItemScore);
            }
        });
        if (!actualCompleted || !isCurrent()) return;

        elements.reviewActual.textContent = `${result.actualCalories.toLocaleString()} cal`;
        elements.reviewScore.textContent = `${result.score.toLocaleString()} / ${this.rules.maxItemScore}`;
        elements.reviewTotal.textContent = `Total: ${this.totalScore.toLocaleString()} / ${this.maxScore}`;
        updateProgressBar(elements.reviewMeter, result.score, this.rules.maxItemScore);

        const pointsCard = elements.review.querySelector('[data-review-stage="points"]');
        pointsCard.classList.add('is-locking');
        elements.reviewMeter.classList.add('is-locking');
        await this.waitForSequence(REVIEW_TIMING.lockImpact, sequenceId);
        if (!isCurrent()) return;

        pointsCard.classList.remove('is-locking');
        pointsCard.classList.add('is-locked');
        elements.reviewMeter.classList.remove('progress-viz--live', 'is-locking');
        elements.reviewMeter.classList.add('is-locked');
        elements.review.classList.remove('review-phase-calculating');
        elements.review.classList.add('review-phase-locked');

        await this.waitForSequence(REVIEW_TIMING.verdictDelay, sequenceId);
        if (!isCurrent()) return;
        this.revealStages('verdict');
        elements.nextItem.disabled = false;
        elements.reviewAnnouncement.textContent = `Your guess was ${result.guess} calories. Actual calories: ${result.actualCalories}. You earned ${result.score} points.`;
    }

    completeReviewSequence(result) {
        const { elements } = this;
        this.revealStages('guess', 'actual', 'points', 'score', 'verdict');
        elements.review.classList.add('review-phase-locked');
        elements.review.querySelector('[data-review-stage="points"]').classList.add('is-locked');
        elements.reviewMeter.classList.add('is-locked');
        elements.reviewTotal.textContent = `Total: ${this.totalScore.toLocaleString()} / ${this.maxScore}`;
        elements.reviewGuess.textContent = `${result.guess.toLocaleString()} cal`;
        elements.reviewActual.textContent = `${result.actualCalories.toLocaleString()} cal`;
        elements.reviewScore.textContent = `${result.score.toLocaleString()} / ${this.rules.maxItemScore}`;
        updateProgressBar(elements.reviewMeter, result.score, this.rules.maxItemScore);
        elements.nextItem.disabled = false;
        elements.reviewAnnouncement.textContent = `Your guess was ${result.guess} calories. Actual calories: ${result.actualCalories}. You earned ${result.score} points.`;
    }

    waitForSequence(duration, sequenceId) {
        return new Promise(resolve => {
            setTimeout(() => resolve(sequenceId === this.reviewSequenceId), duration);
        });
    }

    advance() {
        if (!this.active || !this.awaitingNext || this.elements.nextItem.disabled) return;
        this.reviewSequenceId++;
        if (this.itemIndex < this.rules.itemCount - 1) {
            this.itemIndex++;
            this.displayItem();
            this.save('guessing');
        } else {
            this.showResult();
            this.save('complete');
        }
    }

    get maxScore() {
        return this.rules.itemCount * this.rules.maxItemScore;
    }

    getChallengeLabel() {
        if (this.dateKey === getDailyDateKey()) return 'Daily';
        const dateLabel = new Intl.DateTimeFormat(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC'
        }).format(new Date(`${this.dateKey}T12:00:00Z`));
        return `Daily · ${dateLabel}`;
    }

    showResult() {
        const scoreTier = getScoreTier(this.totalScore, this.maxScore);
        const goldTrophy = this.totalScore > this.maxScore * 0.9;
        const summary = this.results.map((result, index) => `
            <li style="--summary-index: ${index}">
                <div class="multiguess-summary__copy">
                    <span>${escapeHTML(result.item.name)} <small>${escapeHTML(result.item.portion)}</small></span>
                    <span>${result.guess} vs. ${result.actualCalories} cal — ${result.score} pts</span>
                </div>
                <div class="mini-progress" aria-hidden="true">
                    <span style="--mini-progress: ${Math.round(result.score / this.rules.maxItemScore * 100)}%"></span>
                </div>
            </li>
        `).join('');
        const { elements } = this;
        const resultTitle = this.dateKey === getDailyDateKey()
            ? 'Challenge complete'
            : `Challenge complete · ${this.getChallengeLabel().replace('Daily · ', '')}`;

        elements.round.classList.add('hidden');
        elements.review.classList.add('hidden');
        elements.result.className = 'result-message multiguess-final celebrate';
        elements.result.innerHTML = `
            <p class="multiguess-final-kicker">${resultTitle}</p>
            <h2 tabindex="-1">${scoreTier.label}</h2>
            <p class="multiguess-final-score">${this.totalScore} <small>/ ${this.maxScore}</small></p>
            <div id="multiguess-final-meter" class="progress-viz progress-viz--${scoreTier.tone}"></div>
            <button type="button" id="share-result" class="play-again share-result">Share Result</button>
            <p id="share-status" class="share-status" role="status"></p>
            <div id="share-fallback" hidden><label for="share-text">Copy your result</label><textarea id="share-text" readonly></textarea></div>
            <span class="celebration-trophy${goldTrophy ? ' celebration-trophy--gold' : ''}">
                <img src="Aliencake-optimized.webp" alt="${goldTrophy ? 'Gold alien trophy' : 'Alien cake celebration'}" class="celebration-image">
            </span>
            <ul class="multiguess-summary">${summary}</ul>
        `;
        setProgressBar(document.getElementById('multiguess-final-meter'), this.totalScore, this.maxScore, {
            label: 'Total score',
            size: 'hero',
            delay: 180
        });
        createCelebrationBits(elements.result);
        this.onDailyComplete(elements.result);
        document.getElementById('share-result').addEventListener('click', () => this.share());
        focusHeading(elements.result.querySelector('h2'));
    }
    deactivate() {
        this.active = false;
        this.reviewSequenceId++;
    }

    async share() {
        const url = new URL(document.baseURI);
        url.search = '';
        url.hash = '';
        url.searchParams.set('menu', this.context.menu.id);
        url.searchParams.set('date', this.dateKey);
        const title = this.context.menu.gameTitle || 'Daily Calories';
        const text = buildShareText({
            title,
            dateKey: this.dateKey, results: this.results, maxItemScore: this.rules.maxItemScore, url: url.href
        });
        const status = document.getElementById('share-status');
        try {
            if (navigator.share) {
                await navigator.share({ title, text });
                status.textContent = 'Result shared.';
            } else if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                status.textContent = 'Result copied!';
            } else throw new Error('Clipboard unavailable');
        } catch (error) {
            if (error.name === 'AbortError') return;
            document.getElementById('share-fallback').hidden = false;
            const field = document.getElementById('share-text');
            field.value = text;
            field.focus();
            field.select();
            status.textContent = 'Select and copy your result below.';
        }
    }

}
