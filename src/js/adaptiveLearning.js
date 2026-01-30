/**
 * Adaptive Learning Module for Contest Mode
 *
 * Tracks character mistakes during a session and adjusts the probability
 * of those characters appearing in future callsigns. Characters that are
 * frequently missed will appear more often.
 */

// Session-scoped mistake tracking
// Keys are characters (letters/numbers), values are mistake counts
let characterMistakes = {};

// Base weight for all characters (before any adaptive adjustment)
const BASE_WEIGHT = 1;

// How much each mistake increases the weight
const MISTAKE_WEIGHT_MULTIPLIER = 0.5;

// Maximum weight multiplier to prevent extreme bias
const MAX_WEIGHT_MULTIPLIER = 5;

/**
 * Records mistakes by comparing the expected callsign with the user's input.
 *
 * Identifies which characters the user got wrong and increments their
 * mistake count. Characters are compared position by position.
 *
 * @param {string} expectedCallsign - The correct callsign
 * @param {string} userInput - What the user typed
 */
export function recordMistakes(expectedCallsign, userInput) {
  if (!expectedCallsign || !userInput) return;

  const expected = expectedCallsign.toUpperCase();
  const input = userInput.toUpperCase();

  // Find characters that were missed or incorrect
  const maxLen = Math.max(expected.length, input.length);

  for (let i = 0; i < maxLen; i++) {
    const expectedChar = expected[i];
    const inputChar = input[i];

    // If the characters don't match, record the expected character as a mistake
    if (expectedChar && expectedChar !== inputChar) {
      // Only track alphanumeric characters (not slashes, etc.)
      if (/[A-Z0-9]/.test(expectedChar)) {
        if (!characterMistakes[expectedChar]) {
          characterMistakes[expectedChar] = 0;
        }
        characterMistakes[expectedChar]++;
        console.log(
          `Adaptive Learning: Recorded mistake for '${expectedChar}' (total: ${characterMistakes[expectedChar]})`
        );
      }
    }
  }
}

/**
 * Gets the current weight for a character based on its mistake history.
 *
 * Characters with more mistakes get higher weights, making them more
 * likely to appear in future callsigns.
 *
 * @param {string} char - The character to get the weight for
 * @returns {number} The weight for this character
 */
export function getCharacterWeight(char) {
  const mistakes = characterMistakes[char.toUpperCase()] || 0;
  const weight = BASE_WEIGHT + mistakes * MISTAKE_WEIGHT_MULTIPLIER;
  return Math.min(weight, MAX_WEIGHT_MULTIPLIER);
}

/**
 * Selects a random character from a string using weighted probabilities.
 *
 * Characters that the user has previously gotten wrong will be more likely
 * to be selected.
 *
 * @param {string} allowedChars - String of allowed characters to choose from
 * @returns {string} A single randomly selected character
 */
export function weightedRandomChar(allowedChars) {
  if (!allowedChars || allowedChars.length === 0) {
    return '';
  }

  // Build weighted array
  const weightedArray = [];
  for (const char of allowedChars) {
    weightedArray.push({
      value: char,
      weight: getCharacterWeight(char),
    });
  }

  // Calculate total weight
  const totalWeight = weightedArray.reduce((sum, item) => sum + item.weight, 0);

  if (totalWeight <= 0) {
    // Fallback to uniform random selection
    return allowedChars[Math.floor(Math.random() * allowedChars.length)];
  }

  // Pick a random number between 0 and totalWeight
  let randomValue = Math.random() * totalWeight;

  // Determine which character is selected
  let currentWeight = 0;
  for (const item of weightedArray) {
    currentWeight += item.weight;
    if (randomValue <= currentWeight) {
      return item.value;
    }
  }

  // Fallback (should not happen)
  return allowedChars[0];
}

/**
 * Resets all mistake tracking data.
 *
 * Call this when starting a new session or when the user clicks reset.
 */
export function resetAdaptiveLearning() {
  characterMistakes = {};
  console.log('Adaptive Learning: Session data cleared');
}

/**
 * Gets the current mistake statistics.
 *
 * Useful for debugging or displaying to the user.
 *
 * @returns {Object} A copy of the current mistake tracking data
 */
export function getMistakeStats() {
  return { ...characterMistakes };
}

/**
 * Checks if adaptive learning has any recorded mistakes.
 *
 * @returns {boolean} True if there are recorded mistakes
 */
export function hasRecordedMistakes() {
  return Object.keys(characterMistakes).length > 0;
}
