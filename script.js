// Game variables
let menuData = null;
let currentItem = null;
let guessCount = 0;
const MAX_GUESSES = 6;
let gameActive = true;

// Game mode variables
let currentGameMode = 'daily'; // 'daily', 'classic', 'multiguess', 'discaloried', or 'discaloried-hard'
let dailyCountdownInterval = null;
const DAILY_STORAGE_KEY_PREFIX = 'cheesecakefactorydle:daily:';
const MULTIGUESS_DAILY_STORAGE_KEY_PREFIX = 'cheesecakefactorydle:multiguess:daily:';
const DAILY_HISTORY_DAYS = 30;
const DAILY_SELECTION_EPOCH = '2025-01-01T00:00:00Z';
let guessHistory = [];

// Discaloried game variables
let discaloriedItemsData = [];
let discaloriedGuesses = 5;
let discaloriedGameActive = false;
let lockedItems = new Set();
let discaloriedGuessHistory = [];

// Multiguess game variables
const MULTIGUESS_ITEM_COUNT = 3;
const MULTIGUESS_MAX_ITEM_SCORE = 1000;
let multiguessItems = [];
let multiguessItemIndex = 0;
let multiguessResults = [];
let multiguessAwaitingNext = false;

// Congratulatory titles
const congratulatoryTitles = [
    "Calorie Counting Champion!",
    "Nutrition Ninja!",
    "Diet Detective Extraordinaire!",
    "Portion Size Pro!",
    "Macro Master!",
    "Food Fact Wizard!",
    "Cheesecake Factory Expert!",
    "Dietary Data Genius!",
    "Caloric Content Connoisseur!",
    "Menu Maestro!"
];

// DOM elements
const foodImage = document.getElementById('food-image');
const foodName = document.getElementById('food-name');
const foodDescription = document.getElementById('food-description');
const calorieGuess = document.getElementById('calorie-guess');
const submitGuess = document.getElementById('submit-guess');
const feedback = document.getElementById('feedback');
const guessesList = document.getElementById('guesses-list');
const resultMessage = document.getElementById('result-message');

// Image overlay DOM elements
const imageOverlay = document.getElementById('image-overlay');
const overlayImage = document.getElementById('overlay-image');
const imageOverlayClose = document.getElementById('image-overlay-close');

// Game mode DOM elements
const dailyModeBtn = document.getElementById('daily-mode-btn');
const classicModeBtn = document.getElementById('classic-mode-btn');
const multiguessModeBtn = document.getElementById('multiguess-mode-btn');
const discaloriedModeBtn = document.getElementById('discaloried-mode-btn');
const discaloriedHardModeBtn = document.getElementById('discaloried-hard-mode-btn');
const dailyModeInfo = document.getElementById('daily-mode-info');
const classicGame = document.getElementById('classic-game');
const multiguessGame = document.getElementById('multiguess-game');
const discaloriedGame = document.getElementById('discaloried-game');

// Multiguess DOM elements
const multiguessRound = document.getElementById('multiguess-round');
const multiguessProgress = document.getElementById('multiguess-progress');
const multiguessScore = document.getElementById('multiguess-score');
const multiguessFoodImage = document.getElementById('multiguess-food-image');
const multiguessFoodName = document.getElementById('multiguess-food-name');
const multiguessFoodDescription = document.getElementById('multiguess-food-description');
const multiguessCalorieGuess = document.getElementById('multiguess-calorie-guess');
const multiguessSubmitGuess = document.getElementById('multiguess-submit-guess');
const multiguessFeedback = document.getElementById('multiguess-feedback');
const multiguessReview = document.getElementById('multiguess-review');
const multiguessReviewProgress = document.getElementById('multiguess-review-progress');
const multiguessReviewTotal = document.getElementById('multiguess-review-total');
const multiguessReviewImage = document.getElementById('multiguess-review-image');
const multiguessReviewName = document.getElementById('multiguess-review-name');
const multiguessReviewGuess = document.getElementById('multiguess-review-guess');
const multiguessReviewActual = document.getElementById('multiguess-review-actual');
const multiguessReviewScore = document.getElementById('multiguess-review-score');
const multiguessReviewDifference = document.getElementById('multiguess-review-difference');
const multiguessNextItem = document.getElementById('multiguess-next-item');
const multiguessResult = document.getElementById('multiguess-result');

// Discaloried DOM elements
const discaloriedItems = document.getElementById('discaloried-items');
const discaloriedGuessBtn = document.getElementById('discaloried-guess-btn');
const discaloriedFeedback = document.getElementById('discaloried-feedback');
const discaloriedResult = document.getElementById('discaloried-result');
const discaloriedGuessesSpan = document.getElementById('discaloried-guesses');

// Initialize the game
async function initGame() {
    try {
        // Load menu data
        const response = await fetch('menu.json');
        menuData = await response.json();

        // Set up event listeners
        submitGuess.addEventListener('click', handleGuess);
        calorieGuess.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleGuess();
            }
        });
        
        // Add input event listener for button color changes
        calorieGuess.addEventListener('input', updateButtonColor);

        // Set up game mode switching
        dailyModeBtn.addEventListener('click', () => switchGameMode('daily'));
        classicModeBtn.addEventListener('click', () => switchGameMode('classic'));
        multiguessModeBtn.addEventListener('click', () => switchGameMode('multiguess'));
        discaloriedModeBtn.addEventListener('click', () => switchGameMode('discaloried'));
        discaloriedHardModeBtn.addEventListener('click', () => switchGameMode('discaloried-hard'));
        
        // Set up Discaloried game listeners
        discaloriedGuessBtn.addEventListener('click', handleDiscaloriedGuess);

        // Set up Multiguess listeners
        multiguessSubmitGuess.addEventListener('click', handleMultiguessGuess);
        multiguessCalorieGuess.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                handleMultiguessGuess();
            }
        });
        multiguessNextItem.addEventListener('click', advanceMultiguess);
        
        // Set up image overlay listeners
        imageOverlayClose.addEventListener('click', closeImageOverlay);
        imageOverlay.addEventListener('click', function(e) {
            if (e.target === imageOverlay) {
                closeImageOverlay();
            }
        });
        overlayImage.addEventListener('click', closeImageOverlay);

        // Daily is the default mode.
        switchGameMode('daily');
    } catch (error) {
        console.error('Error initializing game:', error);
        feedback.textContent = 'Error loading menu data. Please refresh the page.';
    }
}

// Variables for rainbow animation
let rainbowAnimationId = null;

// Update button color based on input value
function updateButtonColor() {
    const guess = parseInt(calorieGuess.value.trim());
    
    // Clear any existing rainbow animation
    if (rainbowAnimationId) {
        clearInterval(rainbowAnimationId);
        rainbowAnimationId = null;
    }
    
    if (isNaN(guess) || calorieGuess.value.trim() === '') {
        // No input or invalid input - keep original red
        resetButtonColor();
        return;
    }
    
    if (guess > 2000) {
        // Above 2000 - rainbow animation
        startRainbowAnimation();
    } else {
        // 0-2000 range - interpolate between green, yellow, red
        const color = interpolateColor(guess, 2000);
        
        // Extract RGB values to determine appropriate text color
        const normalized = Math.min(guess / 2000, 1);
        let r, g, b;
        
        if (normalized <= 0.5) {
            const t = normalized * 2;
            r = Math.round(0 + (255 - 0) * t);
            g = 255;
            b = 0;
        } else {
            const t = (normalized - 0.5) * 2;
            r = 255;
            g = Math.round(255 - 255 * t);
            b = 0;
        }
        
        const textColor = getTextColorForBackground(r, g, b);
        
        submitGuess.style.backgroundColor = color;
        submitGuess.style.color = textColor;
        submitGuess.style.transition = 'background-color 0.3s, color 0.3s';
    }
}

// Reset button to original red color
function resetButtonColor() {
    if (rainbowAnimationId) {
        clearInterval(rainbowAnimationId);
        rainbowAnimationId = null;
    }
    submitGuess.style.backgroundColor = '#e31837';
    submitGuess.style.color = '#ffffff';
    submitGuess.style.transition = 'background-color 0.3s, color 0.3s';
}

// Interpolate color between green (low), yellow (medium), red (high)
function interpolateColor(value, maxValue) {
    // Normalize value to 0-1 range
    const normalized = Math.min(value / maxValue, 1);
    
    let r, g, b;
    
    if (normalized <= 0.5) {
        // Green to Yellow (0 to 0.5)
        const t = normalized * 2; // 0 to 1
        r = Math.round(0 + (255 - 0) * t); // 0 to 255
        g = 255; // Stay at 255
        b = 0; // Stay at 0
    } else {
        // Yellow to Red (0.5 to 1)
        const t = (normalized - 0.5) * 2; // 0 to 1
        r = 255; // Stay at 255
        g = Math.round(255 - 255 * t); // 255 to 0
        b = 0; // Stay at 0
    }
    
    return `rgb(${r}, ${g}, ${b})`;
}

// Calculate appropriate text color based on background brightness
function getTextColorForBackground(r, g, b) {
    // Calculate relative luminance using the formula for perceived brightness
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Use dark text for bright backgrounds, white text for dark backgrounds
    return luminance > 0.6 ? '#000000' : '#ffffff';
}

// Start rainbow animation for values above 2000
function startRainbowAnimation() {
    let hue = 0;
    rainbowAnimationId = setInterval(() => {
        hue = (hue + 5) % 360; // Increment hue and wrap around
        const color = `hsl(${hue}, 100%, 50%)`;
        
        // Convert HSL to RGB to determine appropriate text color
        const rgb = hslToRgb(hue / 360, 1, 0.5);
        const textColor = getTextColorForBackground(rgb.r, rgb.g, rgb.b);
        
        submitGuess.style.backgroundColor = color;
        submitGuess.style.color = textColor;
        submitGuess.style.transition = 'none'; // Remove transition for smooth animation
    }, 50); // Update every 50ms for smooth animation
}

// Convert HSL to RGB
function hslToRgb(h, s, l) {
    let r, g, b;

    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

function getValidProducts(requirePositiveCalories = false) {
    const allProducts = menuData.categories.reduce((products, category) => {
        if (category.products && Array.isArray(category.products)) {
            return products.concat(category.products);
        }
        return products;
    }, []);

    return allProducts.filter(product =>
        product.basecalories && 
        product.imagefilename && 
        product.name &&
        (!requirePositiveCalories || parseInt(product.basecalories) > 0)
    );
}

// Use UTC so every client changes to the next daily challenge at the same time.
function getDailyDateKey(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

function getDailyStorageKey(dateKey = getDailyDateKey()) {
    return `${DAILY_STORAGE_KEY_PREFIX}${dateKey}`;
}

function readDailyState() {
    try {
        const state = JSON.parse(localStorage.getItem(getDailyStorageKey()));
        return state && state.dateKey === getDailyDateKey() ? state : null;
    } catch (error) {
        console.warn('Unable to read the saved daily game:', error);
        return null;
    }
}

function writeDailyState(state) {
    try {
        localStorage.setItem(getDailyStorageKey(), JSON.stringify({
            ...state,
            dateKey: getDailyDateKey()
        }));

        for (let index = localStorage.length - 1; index >= 0; index--) {
            const key = localStorage.key(index);
            if (key && key.startsWith(DAILY_STORAGE_KEY_PREFIX) && key !== getDailyStorageKey()) {
                localStorage.removeItem(key);
            }
        }
    } catch (error) {
        console.warn('Unable to save the daily game:', error);
    }
}

function getMultiguessDailyStorageKey(dateKey = getDailyDateKey()) {
    return `${MULTIGUESS_DAILY_STORAGE_KEY_PREFIX}${dateKey}`;
}

function readMultiguessDailyState() {
    try {
        const state = JSON.parse(localStorage.getItem(getMultiguessDailyStorageKey()));
        return state && state.dateKey === getDailyDateKey() ? state : null;
    } catch (error) {
        console.warn('Unable to read the saved Multiguess challenge:', error);
        return null;
    }
}

function writeMultiguessDailyState(status) {
    try {
        localStorage.setItem(getMultiguessDailyStorageKey(), JSON.stringify({
            dateKey: getDailyDateKey(),
            status,
            itemIds: multiguessItems.map(item => String(item.id)),
            guesses: multiguessResults.map(result => result.guess)
        }));

        for (let index = localStorage.length - 1; index >= 0; index--) {
            const key = localStorage.key(index);
            if (key && key.startsWith(MULTIGUESS_DAILY_STORAGE_KEY_PREFIX) &&
                key !== getMultiguessDailyStorageKey()) {
                localStorage.removeItem(key);
            }
        }
    } catch (error) {
        console.warn('Unable to save the Multiguess challenge:', error);
    }
}

function saveDailyClassicState(status = gameActive ? 'active' : 'lost') {
    if (currentGameMode !== 'daily' || isDailyHardMode()) return;

    writeDailyState({
        type: 'classic',
        status,
        itemId: currentItem ? String(currentItem.id) : null,
        guesses: [...guessHistory],
        feedback: feedback.textContent
    });
}

function getDiscaloriedOrder() {
    return Array.from(document.querySelectorAll('.discaloried-box')).map(box => {
        const item = box.querySelector('.discaloried-item');
        return item ? item.dataset.itemId : null;
    });
}

function saveDailyDiscaloriedState(status = 'active') {
    if (currentGameMode !== 'daily' || !isDailyHardMode()) return;

    writeDailyState({
        type: 'discaloried-hard',
        status,
        challengeItems: discaloriedItemsData.map(item => String(item.id)),
        guesses: [...discaloriedGuessHistory],
        remainingGuesses: discaloriedGuesses,
        lockedItems: [...lockedItems],
        order: getDiscaloriedOrder(),
        feedback: discaloriedFeedback.textContent
    });
}

function isDailyHardMode(date = new Date()) {
    return date.getUTCDay() === 5;
}

function createSeededRandom(seed) {
    let state = 2166136261;

    for (let index = 0; index < seed.length; index++) {
        state ^= seed.charCodeAt(index);
        state = Math.imul(state, 16777619);
    }

    return function() {
        state += 0x6D2B79F5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffleItems(items, random = Math.random) {
    const shuffledItems = [...items];

    for (let index = shuffledItems.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(random() * (index + 1));
        [shuffledItems[index], shuffledItems[swapIndex]] = [shuffledItems[swapIndex], shuffledItems[index]];
    }

    return shuffledItems;
}

function chooseDailyItem(dateKey, recentItemIds, validProducts) {
    const random = createSeededRandom(`classic:${dateKey}`);
    const recentIds = new Set(recentItemIds.map(String));
    const maxAttempts = validProducts.length * 10;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const candidate = validProducts[Math.floor(random() * validProducts.length)];
        if (!recentIds.has(String(candidate.id))) {
            return candidate;
        }
    }

    // The menu should always have more than 30 valid items, but keep a deterministic fallback.
    return validProducts.find(product => !recentIds.has(String(product.id))) || validProducts[0];
}

function getDailyItemHistoryThrough(targetDate) {
    const validProducts = getValidProducts();
    const history = [];
    const target = new Date(`${getDailyDateKey(targetDate)}T00:00:00Z`);
    const day = new Date(DAILY_SELECTION_EPOCH);

    if (target < day) {
        day.setTime(target.getTime());
        day.setUTCDate(day.getUTCDate() - DAILY_HISTORY_DAYS);
    }

    while (day <= target) {
        // Fridays use the separate Discaloried Hard Mode set instead of one calorie item.
        if (!isDailyHardMode(day)) {
            const recentItems = history
                .filter(entry => {
                    const entryDate = new Date(`${entry.dateKey}T00:00:00Z`);
                    const daysAgo = (day - entryDate) / (24 * 60 * 60 * 1000);
                    return daysAgo > 0 && daysAgo <= DAILY_HISTORY_DAYS;
                })
                .map(entry => entry.itemId);
            const dateKey = getDailyDateKey(day);
            const item = chooseDailyItem(dateKey, recentItems, validProducts);
            history.push({ dateKey, itemId: String(item.id) });
        }
        day.setUTCDate(day.getUTCDate() + 1);
    }

    return history;
}

function updateDailyModeInfo() {
    const daily = currentGameMode === 'daily';
    dailyModeInfo.classList.toggle('hidden', !daily);

    if (!daily) return;

    const dateLabel = new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
    });
    const challengeType = isDailyHardMode() ? 'Discaloried Hard Mode' : 'guess the calories';
    dailyModeInfo.textContent = `Daily · ${dateLabel} · ${challengeType}`;
}

// Select a random food item from the menu for Classic mode.
function selectRandomItem() {
    const validProducts = getValidProducts();

    // Select a random product
    const randomIndex = Math.floor(Math.random() * validProducts.length);
    currentItem = validProducts[randomIndex];

    // Display the item
    displayItem(currentItem);
    
    // Reset button color when starting new game
    resetButtonColor();
}

// Select the same food item for every client on the current UTC date.
function selectDailyItem() {
    const validProducts = getValidProducts();
    const dailyDate = new Date(`${getDailyDateKey()}T00:00:00Z`);
    const history = getDailyItemHistoryThrough(dailyDate);
    const selectedItemId = history[history.length - 1].itemId;
    currentItem = validProducts.find(item => String(item.id) === selectedItemId);

    displayItem(currentItem);
    restoreDailyClassicState();
    resetButtonColor();
}

// Display the current food item
function displayItem(item) {
    // Set the image URL using the imagepath from menu.json
    const imageUrl = `${menuData.imagepath}${item.imagefilename}`;
    foodImage.src = imageUrl;

    // Set the food name and description
    foodName.textContent = item.name;
    foodDescription.textContent = item.description || '';

    // Reset game state
    guessCount = 0;
    guessHistory = [];
    gameActive = true;
    guessesList.innerHTML = '';
    feedback.textContent = '';
    resultMessage.textContent = '';
    resultMessage.className = 'result-message';
    calorieGuess.value = '';
    calorieGuess.focus();
}

function restoreDailyClassicState() {
    const state = readDailyState();

    if (!state || state.type !== 'classic' || state.itemId !== String(currentItem.id)) {
        saveDailyClassicState('active');
        return;
    }

    guessHistory = Array.isArray(state.guesses) ? state.guesses : [];
    guessCount = 0;
    guessesList.innerHTML = '';

    guessHistory.forEach(guess => {
        guessCount++;
        addGuessToList(guess, parseInt(currentItem.basecalories));
    });

    if (state.status === 'won') {
        handleCorrectGuess(parseInt(currentItem.basecalories));
    } else if (state.status === 'lost') {
        handleGameOver(parseInt(currentItem.basecalories));
    } else {
        gameActive = true;
        feedback.textContent = state.feedback || (guessCount > 0 ? `Not quite! ${guessCount}/${MAX_GUESSES} guesses used.` : '');
    }
}

// Handle a user guess
function handleGuess() {
    if (!gameActive) return;

    const guess = parseInt(calorieGuess.value.trim());

    // Validate input
    if (isNaN(guess) || guess < 0) {
        feedback.textContent = 'Please enter a valid number of calories.';
        return;
    }

    // Increment guess count
    guessCount++;
    guessHistory.push(guess);

    // Get actual calories
    const actualCalories = parseInt(currentItem.basecalories);

    // Calculate percentage difference
    const difference = Math.abs(guess - actualCalories);
    const percentDifference = (difference / actualCalories) * 100;

    // Calculate allowed margin (10% of actual calories, capped at 100)
    const allowedMargin = Math.max(Math.min(actualCalories * 0.1, 100), 10);

    // Check if guess is correct (within the allowed margin)
    const isCorrect = difference <= allowedMargin;

    // Add to previous guesses list
    addGuessToList(guess, actualCalories);

    // Clear input field
    calorieGuess.value = '';
    calorieGuess.focus();
    
    // Reset button color to original red
    resetButtonColor();

    // Check game state
    if (isCorrect) {
        handleCorrectGuess(actualCalories);
    } else if (guessCount >= MAX_GUESSES) {
        handleGameOver(actualCalories);
    } else {
        // Game continues
        feedback.textContent = `Not quite! ${guessCount}/${MAX_GUESSES} guesses used.`;
        saveDailyClassicState('active');
    }
}

// Add a guess to the previous guesses list
function addGuessToList(guess, actualCalories) {
    const listItem = document.createElement('li');

    // Calculate margin of error for feedback (same logic as in handleGuess)
    const difference = Math.abs(guess - actualCalories);
    const allowedMargin = Math.max(Math.min(actualCalories * 0.1, 100), 10);
    const isWithinMargin = difference <= allowedMargin;

    // Determine if guess is higher, lower, within margin, or correct
    let comparison;
    if (guess === actualCalories) {
        comparison = '✅ Correct!';
    } else if (isWithinMargin) {
        comparison = '🧀 Right on the cheese!';
    } else if (guess > actualCalories) {
        comparison = '⬇️ Too high';
    } else {
        comparison = '⬆️ Too low';
    }

    // Create guess text
    listItem.innerHTML = `
        <span>Guess #${guessCount}: ${guess} calories</span>
        <span>${comparison}</span>
    `;

    // Add styling for "right on the cheese" guesses
    if (isWithinMargin && guess !== actualCalories) {
        listItem.classList.add('right-on-cheese');
    }

    // Add to list
    guessesList.prepend(listItem);
}

// Handle a correct guess
function handleCorrectGuess(actualCalories) {
    gameActive = false;

    // Select a random congratulatory title
    const randomTitle = congratulatoryTitles[Math.floor(Math.random() * congratulatoryTitles.length)];

    // Clear the result message
    resultMessage.innerHTML = '';

    // Create and add the celebration image
    const celebrationImage = document.createElement('img');
    celebrationImage.src = 'Sebi_cheesecake.png';
    celebrationImage.alt = 'Celebration Image';
    celebrationImage.classList.add('celebration-image');
    resultMessage.appendChild(celebrationImage);

    // Add a line break
    resultMessage.appendChild(document.createElement('br'));

    // Add the success message
    const successMessage = document.createElement('p');
    successMessage.textContent = `🎉 ${randomTitle} The actual calorie count is ${actualCalories}.`;
    resultMessage.appendChild(successMessage);

    addDailyNextChallengeMessage(resultMessage);

    // Add the celebrate class
    resultMessage.classList.add('celebrate');

    // Scroll the congratulatory message into view
    resultMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Add button to play again
    addPlayAgainButton();
    saveDailyClassicState('won');
}

// Handle game over (too many guesses)
function handleGameOver(actualCalories) {
    gameActive = false;

    // Display game over message
    resultMessage.textContent = `😢 Better luck next time! The actual calorie count is ${actualCalories}.`;
    resultMessage.classList.add('game-over');

    addDailyNextChallengeMessage(resultMessage);

    // Add button to play again
    addPlayAgainButton();
    saveDailyClassicState('lost');
}

// Add a play again button
function addPlayAgainButton() {
    if (currentGameMode !== 'classic') return;

    const playAgainButton = document.createElement('button');
    playAgainButton.textContent = 'Play Again';
    playAgainButton.classList.add('play-again');
    playAgainButton.addEventListener('click', selectRandomItem);

    resultMessage.appendChild(document.createElement('br'));
    resultMessage.appendChild(playAgainButton);
}

function addDailyNextChallengeMessage(container) {
    if (currentGameMode !== 'daily' && currentGameMode !== 'multiguess') return;

    stopDailyCountdown();
    const nextChallengeMessage = document.createElement('p');
    nextChallengeMessage.className = 'daily-next-message';
    container.appendChild(nextChallengeMessage);

    const updateCountdown = () => {
        if (!document.body.contains(nextChallengeMessage)) {
            stopDailyCountdown();
            return;
        }

        const now = new Date();
        const nextDaily = new Date(now);
        nextDaily.setUTCHours(24, 0, 0, 0);
        const secondsRemaining = Math.max(0, Math.ceil((nextDaily - now) / 1000));
        const hours = Math.floor(secondsRemaining / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((secondsRemaining % 3600) / 60).toString().padStart(2, '0');
        const seconds = (secondsRemaining % 60).toString().padStart(2, '0');

        nextChallengeMessage.textContent = `Come back in ${hours}h${minutes}m${seconds}s for the next daily!`;
    };

    updateCountdown();
    dailyCountdownInterval = setInterval(updateCountdown, 1000);
}

function stopDailyCountdown() {
    if (dailyCountdownInterval) {
        clearInterval(dailyCountdownInterval);
        dailyCountdownInterval = null;
    }
}

function calculateMultiguessScore(guess, actualCalories) {
    const percentageWrongness = Math.abs(guess - actualCalories) / actualCalories;
    return Math.max(0, Math.round(MULTIGUESS_MAX_ITEM_SCORE * (1 - percentageWrongness)));
}

function initMultiguessGame() {
    const validProducts = getValidProducts(true);
    const random = createSeededRandom(`multiguess:${getDailyDateKey()}`);
    multiguessItems = shuffleItems(validProducts, random).slice(0, MULTIGUESS_ITEM_COUNT);
    multiguessItemIndex = 0;
    multiguessResults = [];
    multiguessAwaitingNext = false;
    multiguessRound.classList.remove('hidden');
    multiguessReview.classList.add('hidden');
    multiguessResult.className = 'result-message hidden';
    restoreMultiguessDailyState();
}

function restoreMultiguessDailyState() {
    const state = readMultiguessDailyState();
    const challengeItemIds = multiguessItems.map(item => String(item.id));
    const savedItemIds = Array.isArray(state?.itemIds) ? state.itemIds.map(String) : [];

    if (!state || challengeItemIds.join(',') !== savedItemIds.join(',')) {
        displayMultiguessItem();
        writeMultiguessDailyState('guessing');
        return;
    }

    const savedGuesses = Array.isArray(state.guesses)
        ? state.guesses.filter(guess => Number.isFinite(guess) && guess >= 0).slice(0, MULTIGUESS_ITEM_COUNT)
        : [];
    multiguessResults = savedGuesses.map((guess, index) => {
        const item = multiguessItems[index];
        const actualCalories = parseInt(item.basecalories);
        return {
            item,
            guess,
            actualCalories,
            score: calculateMultiguessScore(guess, actualCalories)
        };
    });

    if (state.status === 'complete' && multiguessResults.length === MULTIGUESS_ITEM_COUNT) {
        multiguessItemIndex = MULTIGUESS_ITEM_COUNT - 1;
        showMultiguessResult();
    } else if (state.status === 'review' && multiguessResults.length > 0) {
        multiguessItemIndex = multiguessResults.length - 1;
        multiguessAwaitingNext = true;
        showMultiguessReview(multiguessResults[multiguessResults.length - 1]);
    } else {
        multiguessItemIndex = Math.min(multiguessResults.length, MULTIGUESS_ITEM_COUNT - 1);
        displayMultiguessItem();
    }
}

function getMultiguessTotalScore() {
    return multiguessResults.reduce((total, result) => total + result.score, 0);
}

function displayMultiguessItem() {
    const item = multiguessItems[multiguessItemIndex];
    const imageUrl = `${menuData.imagepath}${item.imagefilename}`;

    multiguessRound.classList.remove('hidden');
    multiguessReview.classList.add('hidden');
    multiguessProgress.textContent = `Daily · Item ${multiguessItemIndex + 1} of ${MULTIGUESS_ITEM_COUNT}`;
    multiguessScore.textContent = `Score: ${getMultiguessTotalScore()} / ${MULTIGUESS_ITEM_COUNT * MULTIGUESS_MAX_ITEM_SCORE}`;
    multiguessFoodImage.src = imageUrl;
    multiguessFoodImage.alt = item.name;
    multiguessFoodName.textContent = item.name;
    multiguessFoodDescription.textContent = item.description || '';
    multiguessCalorieGuess.value = '';
    multiguessCalorieGuess.disabled = false;
    multiguessSubmitGuess.disabled = false;
    multiguessFeedback.textContent = '';
    multiguessAwaitingNext = false;
    multiguessCalorieGuess.focus();
}

function handleMultiguessGuess() {
    if (multiguessAwaitingNext || multiguessItems.length === 0) return;

    const guess = Number(multiguessCalorieGuess.value);
    if (!Number.isFinite(guess) || guess < 0 || multiguessCalorieGuess.value.trim() === '') {
        multiguessFeedback.textContent = 'Please enter a valid number of calories.';
        return;
    }

    const item = multiguessItems[multiguessItemIndex];
    const actualCalories = parseInt(item.basecalories);
    const score = calculateMultiguessScore(guess, actualCalories);
    multiguessResults.push({ item, guess, actualCalories, score });
    multiguessAwaitingNext = true;

    multiguessCalorieGuess.disabled = true;
    multiguessSubmitGuess.disabled = true;
    writeMultiguessDailyState('review');
    showMultiguessReview(multiguessResults[multiguessResults.length - 1]);
}

function showMultiguessReview(result) {
    const difference = result.guess - result.actualCalories;
    const percentageWrongness = Math.abs(difference) / result.actualCalories * 100;
    let differenceText;

    if (difference === 0) {
        differenceText = 'Perfect guess — exactly right!';
    } else {
        const direction = difference > 0 ? 'high' : 'low';
        differenceText = `${Math.abs(difference)} calories ${direction} · ${percentageWrongness.toFixed(1)}% off`;
    }

    multiguessReviewProgress.textContent = `Daily · Item ${multiguessItemIndex + 1} of ${MULTIGUESS_ITEM_COUNT}`;
    multiguessReviewTotal.textContent = `Total: ${getMultiguessTotalScore()} / ${MULTIGUESS_ITEM_COUNT * MULTIGUESS_MAX_ITEM_SCORE}`;
    multiguessReviewImage.src = `${menuData.imagepath}${result.item.imagefilename}`;
    multiguessReviewImage.alt = result.item.name;
    multiguessReviewName.textContent = result.item.name;
    multiguessReviewGuess.textContent = `${result.guess} cal`;
    multiguessReviewActual.textContent = `${result.actualCalories} cal`;
    multiguessReviewScore.textContent = `${result.score} / ${MULTIGUESS_MAX_ITEM_SCORE}`;
    multiguessReviewDifference.textContent = differenceText;
    multiguessNextItem.textContent = multiguessItemIndex === MULTIGUESS_ITEM_COUNT - 1 ? 'See Final Score' : 'Next Item';

    multiguessRound.classList.add('hidden');
    multiguessReview.classList.remove('hidden');
    multiguessNextItem.focus();
}

function advanceMultiguess() {
    if (!multiguessAwaitingNext) return;

    if (multiguessItemIndex < MULTIGUESS_ITEM_COUNT - 1) {
        multiguessItemIndex++;
        displayMultiguessItem();
        writeMultiguessDailyState('guessing');
    } else {
        showMultiguessResult();
        writeMultiguessDailyState('complete');
    }
}

function showMultiguessResult() {
    const totalScore = getMultiguessTotalScore();
    const maxScore = MULTIGUESS_ITEM_COUNT * MULTIGUESS_MAX_ITEM_SCORE;
    const summaryItems = multiguessResults.map(result => `
        <li>
            <span>${result.item.name}</span>
            <span>${result.guess} vs. ${result.actualCalories} cal — ${result.score} pts</span>
        </li>
    `).join('');

    multiguessRound.classList.add('hidden');
    multiguessReview.classList.add('hidden');
    multiguessResult.className = 'result-message multiguess-final celebrate';
    multiguessResult.innerHTML = `
        <h2>Daily Final Score</h2>
        <p class="multiguess-final-score">${totalScore} / ${maxScore}</p>
        <ul class="multiguess-summary">${summaryItems}</ul>
    `;

    addDailyNextChallengeMessage(multiguessResult);
    multiguessResult.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Game mode switching
function switchGameMode(mode) {
    stopDailyCountdown();
    currentGameMode = mode;
    
    // Update button states
    dailyModeBtn.classList.toggle('active', mode === 'daily');
    classicModeBtn.classList.toggle('active', mode === 'classic');
    multiguessModeBtn.classList.toggle('active', mode === 'multiguess');
    discaloriedModeBtn.classList.toggle('active', mode === 'discaloried');
    discaloriedHardModeBtn.classList.toggle('active', mode === 'discaloried-hard');
    
    const dailyHardMode = mode === 'daily' && isDailyHardMode();
    const showClassicGame = mode === 'classic' || (mode === 'daily' && !dailyHardMode);
    const showMultiguessGame = mode === 'multiguess';
    const showDiscaloriedGame = mode === 'discaloried' || mode === 'discaloried-hard' || dailyHardMode;

    // Show/hide game containers
    classicGame.classList.toggle('hidden', !showClassicGame);
    multiguessGame.classList.toggle('hidden', !showMultiguessGame);
    discaloriedGame.classList.toggle('hidden', !showDiscaloriedGame);
    updateDailyModeInfo();
    
    if (mode === 'daily') {
        initDailyGame();
    } else if (mode === 'multiguess') {
        initMultiguessGame();
    } else if (mode === 'discaloried' || mode === 'discaloried-hard') {
        initDiscaloriedGame();
    } else {
        selectRandomItem();
    }
}

function initDailyGame() {
    if (isDailyHardMode()) {
        initDiscaloriedGame(createSeededRandom(`hard:${getDailyDateKey()}`));
    } else {
        selectDailyItem();
    }
}

// Initialize Discaloried game
function initDiscaloriedGame(random = Math.random) {
    // Reset game state
    discaloriedGuesses = 5;
    discaloriedGameActive = true;
    lockedItems.clear();
    discaloriedGuessHistory = [];
    discaloriedFeedback.textContent = '';
    discaloriedResult.textContent = '';
    discaloriedResult.className = 'result-message';
    discaloriedGuessesSpan.textContent = discaloriedGuesses;
    discaloriedGuessBtn.disabled = false;
    
    const hardMode = currentGameMode === 'discaloried-hard' || (currentGameMode === 'daily' && isDailyHardMode());

    // Select 5 items
    if (hardMode) {
        selectDiscaloriedHardItems(random);
    } else {
        selectDiscaloriedItems(random);
    }
    
    // Display items
    displayDiscaloriedItems();

    if (currentGameMode === 'daily' && isDailyHardMode()) {
        restoreDailyDiscaloriedState();
    }
}

// Select 5 random items for Discaloried game
function selectDiscaloriedItems(random = Math.random) {
    const validProducts = getValidProducts(true);

    // Select 5 random products
    const selectedItems = [];
    const usedIndices = new Set();
    
    while (selectedItems.length < 5 && selectedItems.length < validProducts.length) {
        const randomIndex = Math.floor(random() * validProducts.length);
        if (!usedIndices.has(randomIndex)) {
            usedIndices.add(randomIndex);
            selectedItems.push(validProducts[randomIndex]);
        }
    }
    
    // Sort by calories (descending) to get correct order
    const correctOrder = [...selectedItems].sort((a, b) => 
        parseInt(b.basecalories) - parseInt(a.basecalories)
    );
    
    // Shuffle for display
    const shuffledItems = shuffleItems(selectedItems, random);
    
    // Store both arrays
    discaloriedItemsData = shuffledItems;
    discaloriedItemsData.correctOrder = correctOrder;
}

// Select 5 random items for Discaloried Hard Mode with 300-700 calorie difference and no duplicate calories
function selectDiscaloriedHardItems(random = Math.random) {
    const validProducts = getValidProducts(true);

    // Sort products by calories for easier selection
    const sortedProducts = validProducts.sort((a, b) => 
        parseInt(a.basecalories) - parseInt(b.basecalories)
    );

    let selectedItems = [];
    let attempts = 0;
    const maxAttempts = 1000; // Prevent infinite loop

    while (selectedItems.length < 5 && attempts < maxAttempts) {
        attempts++;
        
        // Pick a random starting item
        const startIndex = Math.floor(random() * (sortedProducts.length - 4));
        const candidateItems = [];
        
        // Try to find items within 700 calorie range starting from this item
        const baseCalories = parseInt(sortedProducts[startIndex].basecalories);
        
        for (let i = startIndex; i < sortedProducts.length; i++) {
            const itemCalories = parseInt(sortedProducts[i].basecalories);
            if (itemCalories - baseCalories <= 700) {
                candidateItems.push(sortedProducts[i]);
            } else {
                break; // Items are sorted, so no point checking further
            }
        }
        
        // If we found enough items within range, try to select 5 with constraints
        if (candidateItems.length >= 5) {
            selectedItems = [];
            const usedCalories = new Set();
            let selectionAttempts = 0;
            const maxSelectionAttempts = 100;
            
            while (selectedItems.length < 5 && selectionAttempts < maxSelectionAttempts) {
                selectionAttempts++;
                const randomIndex = Math.floor(random() * candidateItems.length);
                const candidate = candidateItems[randomIndex];
                const candidateCalories = parseInt(candidate.basecalories);
                
                // Check if this calorie amount is already used
                if (!usedCalories.has(candidateCalories)) {
                    selectedItems.push(candidate);
                    usedCalories.add(candidateCalories);
                }
            }
            
            // Check if we have 5 items and they meet the min/max difference constraints
            if (selectedItems.length === 5) {
                const calories = selectedItems.map(item => parseInt(item.basecalories));
                const minCal = Math.min(...calories);
                const maxCal = Math.max(...calories);
                const difference = maxCal - minCal;
                
                // Must have at least 300 calorie difference and at most 700
                if (difference >= 300 && difference <= 700) {
                    break;
                }
            }
            
            // Reset for next attempt
            selectedItems = [];
        }
    }

    // Fallback: if we couldn't find items within constraints, use relaxed selection
    if (selectedItems.length < 5) {
        console.warn('Could not find 5 items within 300-700 calorie range with unique calories, falling back to regular selection');
        const usedCalories = new Set();
        selectedItems = [];
        
        while (selectedItems.length < 5 && selectedItems.length < validProducts.length) {
            const randomIndex = Math.floor(random() * validProducts.length);
            const candidate = validProducts[randomIndex];
            const candidateCalories = parseInt(candidate.basecalories);
            
            // Still enforce no duplicate calories even in fallback
            if (!usedCalories.has(candidateCalories)) {
                usedCalories.add(candidateCalories);
                selectedItems.push(candidate);
            }
        }
    }
    
    // Sort by calories (descending) to get correct order
    const correctOrder = [...selectedItems].sort((a, b) => 
        parseInt(b.basecalories) - parseInt(a.basecalories)
    );
    
    // Shuffle for display
    const shuffledItems = shuffleItems(selectedItems, random);
    
    // Store both arrays
    discaloriedItemsData = shuffledItems;
    discaloriedItemsData.correctOrder = correctOrder;
    
    // Log the calorie range for debugging
    const calories = selectedItems.map(item => parseInt(item.basecalories));
    const minCal = Math.min(...calories);
    const maxCal = Math.max(...calories);
    const uniqueCalories = new Set(calories);
    console.log(`Discaloried Hard Mode: Selected items with calorie range ${minCal}-${maxCal} (difference: ${maxCal - minCal}), unique calories: ${uniqueCalories.size === 5 ? 'Yes' : 'No'}`);
}

// Display Discaloried items
function displayDiscaloriedItems() {
    // Clear all boxes
    const boxes = document.querySelectorAll('.discaloried-box');
    boxes.forEach(box => {
        box.innerHTML = '';
        box.classList.remove('locked');
    });
    
    // Place items in boxes
    discaloriedItemsData.forEach((item, index) => {
        const itemElement = document.createElement('div');
        itemElement.className = 'discaloried-item';
        itemElement.draggable = true;
        itemElement.dataset.itemId = item.id;
        
        const imageUrl = `${menuData.imagepath}${item.imagefilename}`;
        
        itemElement.innerHTML = `
            <img src="${imageUrl}" alt="${item.name}" class="discaloried-item-image">
            <div class="discaloried-item-info">
                <div class="discaloried-item-name">
                    <span class="item-name-text">${item.name}</span>
                    <span class="discaloried-item-calories" style="display: none;">${item.basecalories} cal</span>
                </div>
                <div class="discaloried-item-description">${item.description || ''}</div>
            </div>
        `;
        
        // Add drag and drop event listeners
        itemElement.addEventListener('dragstart', handleDragStart);
        itemElement.addEventListener('dragend', handleDragEnd);
        
        // Add image click listener for overlay
        const imageElement = itemElement.querySelector('.discaloried-item-image');
        imageElement.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent drag events
            showImageOverlay(imageUrl, item.name);
        });
        
        // Place item in corresponding box
        const box = boxes[index];
        box.appendChild(itemElement);
    });
    
    // Add drag and drop listeners to boxes
    boxes.forEach(box => {
        box.addEventListener('dragover', handleDragOver);
        box.addEventListener('drop', handleDrop);
        box.addEventListener('dragenter', handleDragEnter);
        box.addEventListener('dragleave', handleDragLeave);
    });
}

function applyLockedDiscaloriedItems() {
    document.querySelectorAll('.discaloried-box').forEach(box => {
        const item = box.querySelector('.discaloried-item');
        if (item && lockedItems.has(item.dataset.itemId)) {
            box.classList.add('locked');
            item.classList.add('locked');
            item.draggable = false;
        }
    });
}

function restoreDailyDiscaloriedState() {
    const state = readDailyState();

    const currentChallengeItems = discaloriedItemsData.map(item => String(item.id)).sort();
    const savedChallengeItems = Array.isArray(state?.challengeItems)
        ? state.challengeItems.map(String).sort()
        : [];

    if (!state || state.type !== 'discaloried-hard' ||
        currentChallengeItems.join(',') !== savedChallengeItems.join(',')) {
        saveDailyDiscaloriedState('active');
        return;
    }

    const correctOrder = discaloriedItemsData.correctOrder;
    const itemsById = new Map(discaloriedItemsData.map(item => [String(item.id), item]));
    const restoredItems = (Array.isArray(state.order) ? state.order : [])
        .map(itemId => itemsById.get(String(itemId)))
        .filter(Boolean);
    const restoredIds = new Set(restoredItems);
    const remainingItems = discaloriedItemsData.filter(item => !restoredIds.has(item));

    discaloriedItemsData = [...restoredItems, ...remainingItems];
    discaloriedItemsData.correctOrder = correctOrder;
    lockedItems = new Set((Array.isArray(state.lockedItems) ? state.lockedItems : [])
        .map(String)
        .filter(itemId => itemsById.has(itemId)));
    discaloriedGuessHistory = Array.isArray(state.guesses) ? state.guesses : [];
    discaloriedGuesses = Math.max(0, Math.min(5, Number.isInteger(state.remainingGuesses)
        ? state.remainingGuesses
        : 5 - discaloriedGuessHistory.length));
    discaloriedGuessesSpan.textContent = discaloriedGuesses;

    displayDiscaloriedItems();
    applyLockedDiscaloriedItems();

    if (state.status === 'won') {
        handleDiscaloriedWin();
    } else if (state.status === 'lost') {
        handleDiscaloriedLose();
    } else {
        discaloriedGameActive = true;
        discaloriedFeedback.textContent = state.feedback || '';
    }
}

// Drag and drop handlers
function handleDragStart(e) {
    if (lockedItems.has(e.target.dataset.itemId)) {
        e.preventDefault();
        return;
    }
    
    e.target.classList.add('dragging');
    e.dataTransfer.setData('text/plain', e.target.dataset.itemId);
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDragEnter(e) {
    e.preventDefault();
    const box = e.target.closest('.discaloried-box');
    if (box && !box.classList.contains('locked')) {
        box.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    e.preventDefault();
    const box = e.target.closest('.discaloried-box');
    if (box) {
        box.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    
    const draggedId = e.dataTransfer.getData('text/plain');
    const draggedElement = document.querySelector(`[data-item-id="${draggedId}"]`);
    const dropBox = e.target.closest('.discaloried-box');
    
    // Remove drag-over class
    dropBox.classList.remove('drag-over');
    
    if (draggedElement && dropBox) {
        // Don't allow dropping on locked boxes
        if (dropBox.classList.contains('locked')) {
            return;
        }
        
        const sourceBox = draggedElement.closest('.discaloried-box');
        const existingItem = dropBox.querySelector('.discaloried-item');
        
        if (existingItem && existingItem !== draggedElement) {
            // Animate swap between boxes
            animateSwap(draggedElement, existingItem, sourceBox, dropBox);
        } else {
            // Animate move to empty box
            animateMove(draggedElement, dropBox);
        }
    }
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    // Remove any remaining drag-over classes
    document.querySelectorAll('.discaloried-box').forEach(box => {
        box.classList.remove('drag-over');
    });
}

// Animation functions for smooth swapping
function animateSwap(draggedElement, existingItem, sourceBox, dropBox) {
    // Get initial positions
    const draggedRect = draggedElement.getBoundingClientRect();
    const existingRect = existingItem.getBoundingClientRect();
    
    // Add animating class to prevent interactions
    draggedElement.classList.add('animating');
    existingItem.classList.add('animating');
    
    // Move elements in DOM first (without animation)
    sourceBox.appendChild(existingItem);
    dropBox.appendChild(draggedElement);
    
    // Get final positions after DOM manipulation
    const draggedFinalRect = draggedElement.getBoundingClientRect();
    const existingFinalRect = existingItem.getBoundingClientRect();
    
    // Calculate how far each element needs to move back to its original position
    const draggedBackX = draggedRect.left - draggedFinalRect.left;
    const draggedBackY = draggedRect.top - draggedFinalRect.top;
    const existingBackX = existingRect.left - existingFinalRect.left;
    const existingBackY = existingRect.top - existingFinalRect.top;
    
    // Set initial transform to original positions (no transition yet)
    draggedElement.style.transition = 'none';
    existingItem.style.transition = 'none';
    draggedElement.style.transform = `translate(${draggedBackX}px, ${draggedBackY}px)`;
    existingItem.style.transform = `translate(${existingBackX}px, ${existingBackY}px)`;
    
    // Force reflow to ensure transforms are applied
    draggedElement.offsetHeight;
    existingItem.offsetHeight;
    
    // Re-enable transitions and animate to final position (transform: none)
    draggedElement.style.transition = '';
    existingItem.style.transition = '';
    draggedElement.style.transform = '';
    existingItem.style.transform = '';
    
    // Clean up after animation completes
    setTimeout(() => {
        draggedElement.classList.remove('animating');
        existingItem.classList.remove('animating');
    }, 500); // Match the CSS transition duration
}

function animateMove(draggedElement, dropBox) {
    // Get initial position
    const draggedRect = draggedElement.getBoundingClientRect();
    
    // Add animating class
    draggedElement.classList.add('animating');
    
    // Move element in DOM first (without animation)
    dropBox.appendChild(draggedElement);
    
    // Get final position after DOM manipulation
    const draggedFinalRect = draggedElement.getBoundingClientRect();
    
    // Calculate how far element needs to move back to its original position
    const deltaX = draggedRect.left - draggedFinalRect.left;
    const deltaY = draggedRect.top - draggedFinalRect.top;
    
    // Set initial transform to original position (no transition yet)
    draggedElement.style.transition = 'none';
    draggedElement.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    
    // Force reflow to ensure transform is applied
    draggedElement.offsetHeight;
    
    // Re-enable transition and animate to final position (transform: none)
    draggedElement.style.transition = '';
    draggedElement.style.transform = '';
    
    // Clean up after animation completes
    setTimeout(() => {
        draggedElement.classList.remove('animating');
    }, 500); // Match the CSS transition duration
}

// Handle Discaloried guess
function handleDiscaloriedGuess() {
    if (!discaloriedGameActive) return;
    
    const boxes = document.querySelectorAll('.discaloried-box');
    const correctOrder = discaloriedItemsData.correctOrder;
    
    let correctCount = 0;
    const newlyLocked = [];
    
    // Check each box
    boxes.forEach((box, index) => {
        const item = box.querySelector('.discaloried-item');
        if (!item) return;
        
        const itemId = item.dataset.itemId;
        const currentItem = discaloriedItemsData.find(item => item.id === itemId);
        const correctItem = correctOrder[index];
        
        if (currentItem.id === correctItem.id) {
            if (!lockedItems.has(itemId)) {
                // Newly correct item
                lockedItems.add(itemId);
                box.classList.add('locked');
                item.classList.add('locked');
                item.draggable = false;
                newlyLocked.push(item);
                correctCount++;
            }
        } else if (!lockedItems.has(itemId)) {
            // Incorrect item - add shake animation
            item.classList.add('shake');
            setTimeout(() => {
                item.classList.remove('shake');
            }, 500);
        }
    });
    
    // Update guesses
    discaloriedGuessHistory.push(getDiscaloriedOrder());
    discaloriedGuesses--;
    discaloriedGuessesSpan.textContent = discaloriedGuesses;
    
    // Check win condition
    if (lockedItems.size === 5) {
        handleDiscaloriedWin();
        return;
    }
    
    // Check lose condition
    if (discaloriedGuesses <= 0) {
        handleDiscaloriedLose();
        return;
    }
    
    // Update feedback
    if (newlyLocked.length > 0) {
        discaloriedFeedback.textContent = `Great! ${newlyLocked.length} item(s) locked in correct position!`;
    } else {
        discaloriedFeedback.textContent = `No items in correct position. ${discaloriedGuesses} guesses remaining.`;
    }

    saveDailyDiscaloriedState('active');
}

// Handle Discaloried win
function handleDiscaloriedWin() {
    discaloriedGameActive = false;
    discaloriedGuessBtn.disabled = true;
    
    // Show all calories
    const allItems = document.querySelectorAll('.discaloried-item');
    allItems.forEach(element => {
        const calorieElement = element.querySelector('.discaloried-item-calories');
        calorieElement.style.display = 'inline';
    });
    
    // Select a random congratulatory title
    const randomTitle = congratulatoryTitles[Math.floor(Math.random() * congratulatoryTitles.length)];
    
    // Clear the result message
    discaloriedResult.innerHTML = '';
    
    // Create and add the celebration image
    const celebrationImage = document.createElement('img');
    celebrationImage.src = 'Sebi_cheesecake.png';
    celebrationImage.alt = 'Celebration Image';
    celebrationImage.classList.add('celebration-image');
    discaloriedResult.appendChild(celebrationImage);
    
    // Add a line break
    discaloriedResult.appendChild(document.createElement('br'));
    
    // Add the success message
    const successMessage = document.createElement('p');
    successMessage.textContent = `🎉 ${randomTitle} You correctly ordered all dishes by calories!`;
    discaloriedResult.appendChild(successMessage);

    addDailyNextChallengeMessage(discaloriedResult);
    
    // Add the celebrate class
    discaloriedResult.classList.add('celebrate');
    
    // Scroll the congratulatory message into view
    discaloriedResult.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Add button to play again
    addDiscaloriedPlayAgainButton();
    saveDailyDiscaloriedState('won');
}

// Handle Discaloried lose
function handleDiscaloriedLose() {
    discaloriedGameActive = false;
    discaloriedGuessBtn.disabled = true;
    
    // Show all calories
    const allItems = document.querySelectorAll('.discaloried-item');
    allItems.forEach(element => {
        const calorieElement = element.querySelector('.discaloried-item-calories');
        calorieElement.style.display = 'inline';
    });
    
    // Show correct order
    const correctOrder = discaloriedItemsData.correctOrder;
    // Display game over message
    discaloriedResult.textContent = `😢 Better luck next time!`;
    discaloriedResult.classList.add('game-over');

    addDailyNextChallengeMessage(discaloriedResult);
    
    // Add button to play again
    addDiscaloriedPlayAgainButton();
    saveDailyDiscaloriedState('lost');
}

// Add a play again button for Discaloried
function addDiscaloriedPlayAgainButton() {
    if (currentGameMode === 'daily') return;

    const playAgainButton = document.createElement('button');
    playAgainButton.textContent = 'Play Again';
    playAgainButton.classList.add('play-again');
    playAgainButton.addEventListener('click', initDiscaloriedGame);

    discaloriedResult.appendChild(document.createElement('br'));
    discaloriedResult.appendChild(playAgainButton);
}

// Image overlay functions
function showImageOverlay(imageSrc, altText) {
    overlayImage.src = imageSrc;
    overlayImage.alt = altText;
    imageOverlay.classList.add('show');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeImageOverlay() {
    imageOverlay.classList.remove('show');
    document.body.style.overflow = ''; // Restore scrolling
}

// Start the game when the page loads
window.addEventListener('DOMContentLoaded', () => {
    initGame();

    // Add click event for Bell Pepper Farm text
    const bellPepperFarm = document.getElementById('bell-pepper-farm');
    const closeupContainer = document.getElementById('closeup-container');

    if (bellPepperFarm && closeupContainer) {
        bellPepperFarm.addEventListener('click', () => {
            closeupContainer.classList.toggle('hidden');
        });
    }
});
