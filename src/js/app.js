// Import Bootstrap CSS
import 'bootswatch/dist/cerulean/bootstrap.min.css';

// Import custom styles
import '../css/style.css';

// Import Bootstrap JavaScript
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

// Import Font Awesome
import '@fortawesome/fontawesome-free/js/all.min.js';

import {
  audioContext,
  createMorsePlayer,
  getAudioLock,
  updateAudioLock,
  isBackgroundStaticPlaying,
  createBackgroundStatic,
  stopAllAudio,
} from './audio.js';
import { clearAllInvalidStates, getInputs } from './inputs.js';
import {
  compareStrings,
  respondWithAllStations,
  addStations,
  addTableRow,
  clearTable,
  updateActiveStations,
  printStation,
} from './util.js';
import { getYourStation, getCallingStation } from './stationGenerator.js';
import { updateStaticIntensity } from './audio.js';
import { modeLogicConfig, modeUIConfig } from './modes.js';

// Make modeLogicConfig accessible globally for other modules
window.modeLogicConfig = modeLogicConfig;

/**
 * Application state variables.
 *
 * - `currentMode`: Tracks the currently selected mode (e.g., single, multi-station).
 * - `inputs`: Stores the user-provided inputs retrieved from the form.
 * - `currentStations`: An array of stations currently active in multi-station mode.
 * - `currentStation`: The single active station in single mode.
 * - `activeStationIndex`: Tracks the index of the current active station in multi-station mode.
 * - `readyForTU`: Boolean indicating if the "TU" step is ready to proceed.
 * - `currentStationAttempts`: Counter for the number of attempts with the current station.
 * - `currentStationStartTime`: Timestamp for when the current station interaction started.
 * - `totalContacts`: Counter for the total number of completed contacts.
 * - `yourStation`: Stores the user's station configuration.
 * - `lastRespondingStations`: An array of stations that last responded to the user's call.
 * - `farnsworthLowerBy`: The amount to increase the Farnsworth spacing when using QRS.
 */
let currentMode;
let inputs = null;
let currentStations = [];
let currentStation = null;
let activeStationIndex = null;
let readyForTU = false; // This means that the last send was a perfect match
let currentStationAttempts = 0;
let currentStationStartTime = null;
let totalContacts = 0;
let yourStation = null;
let lastRespondingStations = null;
const farnsworthLowerBy = 6;

/**
 * Event listener setup.
 *
 * - Adds click and change event listeners to UI elements like buttons and checkboxes.
 * - Configures interactions for elements such as the CQ button, mode selection radios, and input fields.
 * - Includes special handling for QSB and Farnsworth UI components to dynamically enable/disable related inputs.
 */
document.addEventListener('DOMContentLoaded', () => {
  // UI elements
  const cqButton = document.getElementById('cqButton');
  const responseField = document.getElementById('responseField');
  const infoField = document.getElementById('infoField');
  const infoField2 = document.getElementById('infoField2');
  const sendButton = document.getElementById('sendButton');
  const tuButton = document.getElementById('tuButton');
  const resetButton = document.getElementById('resetButton');
  const stopButton = document.getElementById('stopButton');
  const modeRadios = document.querySelectorAll('input[name="mode"]');
  const yourCallsign = document.getElementById('yourCallsign');
  const yourName = document.getElementById('yourName');
  const yourSpeed = document.getElementById('yourSpeed');
  const yourSidetone = document.getElementById('yourSidetone');
  const yourVolume = document.getElementById('yourVolume');

  // Event Listeners
  cqButton.addEventListener('click', cq);
  sendButton.addEventListener('click', send);
  tuButton.addEventListener('click', tu);
  resetButton.addEventListener('click', reset);
  stopButton.addEventListener('click', stop);
  modeRadios.forEach((radio) => {
    radio.addEventListener('change', changeMode);
  });

  // Show/hide contest configuration when contest mode is selected
  modeRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      const contestConfig = document.getElementById('contestConfig');
      if (radio.value === 'contest') {
        contestConfig.style.display = 'block';
      } else {
        contestConfig.style.display = 'none';
      }
    });
  });

  // QSB
  const qsbCheckbox = document.getElementById('qsb');
  const qsbPercentage = document.getElementById('qsbPercentage');
  // Initially set the slider state based on the checkbox
  qsbPercentage.disabled = !qsbCheckbox.checked;
  // Add event listener to update the slider state when checkbox changes
  qsbCheckbox.addEventListener('change', () => {
    qsbPercentage.disabled = !qsbCheckbox.checked;
  });

  // Farnsworth elements
  const enableFarnsworthCheckbox = document.getElementById('enableFarnsworth');
  const farnsworthSpeedInput = document.getElementById('farnsworthSpeed');
  // Set initial state based on whether Farnsworth is enabled
  farnsworthSpeedInput.disabled = !enableFarnsworthCheckbox.checked;
  // Toggle the Farnsworth speed input when the checkbox changes
  enableFarnsworthCheckbox.addEventListener('change', () => {
    farnsworthSpeedInput.disabled = !enableFarnsworthCheckbox.checked;
  });

  // Cut Number elements
  const enableCutNumbersCheckbox = document.getElementById('enableCutNumbers');
  const cutNumberIds = [
    'cutT',
    'cutA',
    'cutU',
    'cutV',
    'cutE',
    'cutG',
    'cutD',
    'cutN',
  ];

  // Set initial state based on whether Cut Numbers is enabled
  cutNumberIds.forEach((id) => {
    const checkbox = document.getElementById(id);
    checkbox.disabled = !enableCutNumbersCheckbox.checked;
  });

  // Toggle the cut-number checkboxes when "Enable Cut Numbers" changes
  enableCutNumbersCheckbox.addEventListener('change', () => {
    cutNumberIds.forEach((id) => {
      const checkbox = document.getElementById(id);
      checkbox.disabled = !enableCutNumbersCheckbox.checked;
    });
  });

  function updateResponsiveButtons() {
    const responsiveButtons = document.querySelectorAll('.btn-responsive');
    responsiveButtons.forEach((button) => {
      if (window.innerWidth < 576) {
        button.classList.add('btn-sm');
      } else {
        button.classList.remove('btn-sm');
      }
    });
  }

  // Run on initial load
  updateResponsiveButtons();
  // Run on every window resize
  window.addEventListener('resize', updateResponsiveButtons);

  // Add hotkey for CQ (Ctrl + Shift + C)
  // Add an event listener for keydown events
  document.addEventListener('keydown', (event) => {
    // Check if Ctrl and Shift are pressed and the key is 'C'
    if (event.ctrlKey && event.shiftKey && event.key === 'C') {
      // Prevent default behavior to avoid browser conflicts
      event.preventDefault();

      // Call the CQ function
      cq();
    }
  });

  responseField.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      sendButton.click();
    } else if (event.key === ' ') {
      event.preventDefault();
      
      // Check if program is currently running
      const isRunning = currentStations.length > 0 || currentStation !== null;
      
      if (isRunning) {
        // If running, stop the program
        stop();
      } else {
        // If not running, start the program (CQ)
        cq();
      }
    }
  });

  infoField.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && tuButton.style.display !== 'none') {
      event.preventDefault();
      tuButton.click();
    }
  });

  infoField2.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && tuButton.style.display !== 'none') {
      event.preventDefault();
      tuButton.click();
    }
  });

  cqButton.addEventListener('click', () => {
    responseField.focus();
  });

  // Local Storage keys for user settings
  const keys = {
    yourCallsign: 'yourCallsign',
    yourName: 'yourName',
    yourState: 'yourState', // Added yourState
    yourSpeed: 'yourSpeed',
    yourSidetone: 'yourSidetone',
    yourVolume: 'yourVolume',
    // Callsign format options
    format1x1: 'format1x1',
    format1x2: 'format1x2',
    format1x3: 'format1x3',
    format2x1: 'format2x1',
    format2x2: 'format2x2',
    format2x3: 'format2x3',
    // Contest configuration
    slashPercentage: 'slashPercentage',
    allowedLetters: 'allowedLetters',
    allowedNumbers: 'allowedNumbers',
    minCallsignLength: 'minCallsignLength',
    maxCallsignLength: 'maxCallsignLength',
    requirePrefix: 'requirePrefix',
    allowedPrefixes: 'allowedPrefixes',
    // Responding station settings
    maxStations: 'maxStations',
    minStations: 'minStations',
    minSpeed: 'minSpeed',
    maxSpeed: 'maxSpeed',
    minTone: 'minTone',
    maxTone: 'maxTone',
    minVolume: 'minVolume',
    maxVolume: 'maxVolume',
    minWait: 'minWait',
    maxWait: 'maxWait',
    enableFarnsworth: 'enableFarnsworth',
    farnsworthSpeed: 'farnsworthSpeed',
    usOnly: 'usOnly',
    qrn: 'qrn',
    qsb: 'qsb',
    qsbPercentage: 'qsbPercentage',
    enableCutNumbers: 'enableCutNumbers',
    cutT: 'cutT',
    cutA: 'cutA',
    cutU: 'cutU',
    cutV: 'cutV',
    cutE: 'cutE',
    cutG: 'cutG',
    cutD: 'cutD',
    cutN: 'cutN',
  };

  /**
   * Local storage handling for user settings.
   *
   * - Loads saved values from local storage into input fields during initialization.
   * - Saves updated input field values to local storage whenever they change.
   * - Ensures persistence of user preferences across sessions.
   */
  yourCallsign.value =
    localStorage.getItem(keys.yourCallsign) || yourCallsign.value;
  yourName.value = localStorage.getItem(keys.yourName) || yourName.value;
  yourState.value = localStorage.getItem(keys.yourState) || yourState.value; // Load yourState
  yourSpeed.value = localStorage.getItem(keys.yourSpeed) || yourSpeed.value;
  yourSidetone.value =
    localStorage.getItem(keys.yourSidetone) || yourSidetone.value;
  yourVolume.value = localStorage.getItem(keys.yourVolume) || yourVolume.value;

  // Load responding station settings
  const maxStations = document.getElementById('maxStations');
  const minStations = document.getElementById('minStations');
  const minSpeed = document.getElementById('minSpeed');
  const maxSpeed = document.getElementById('maxSpeed');
  const minTone = document.getElementById('minTone');
  const maxTone = document.getElementById('maxTone');
  const minVolume = document.getElementById('minVolume');
  const maxVolume = document.getElementById('maxVolume');
  const minWait = document.getElementById('minWait');
  const maxWait = document.getElementById('maxWait');
  const enableFarnsworth = document.getElementById('enableFarnsworth');
  const farnsworthSpeed = document.getElementById('farnsworthSpeed');
  const usOnly = document.getElementById('usOnly');
  const qrnRadios = document.querySelectorAll('input[name="qrn"]');
  const qsb = document.getElementById('qsb');
  const enableCutNumbers = document.getElementById('enableCutNumbers');
  const cutT = document.getElementById('cutT');
  const cutA = document.getElementById('cutA');
  const cutU = document.getElementById('cutU');
  const cutV = document.getElementById('cutV');
  const cutE = document.getElementById('cutE');
  const cutG = document.getElementById('cutG');
  const cutD = document.getElementById('cutD');
  const cutN = document.getElementById('cutN');

  // Load responding station values
  if (maxStations) {
    maxStations.value = localStorage.getItem(keys.maxStations) || maxStations.value;
  }
  if (minStations) {
    minStations.value = localStorage.getItem(keys.minStations) || minStations.value;
  }
  if (minSpeed) {
    minSpeed.value = localStorage.getItem(keys.minSpeed) || minSpeed.value;
  }
  if (maxSpeed) {
    maxSpeed.value = localStorage.getItem(keys.maxSpeed) || maxSpeed.value;
  }
  if (minTone) {
    minTone.value = localStorage.getItem(keys.minTone) || minTone.value;
  }
  if (maxTone) {
    maxTone.value = localStorage.getItem(keys.maxTone) || maxTone.value;
  }
  if (minVolume) {
    minVolume.value = localStorage.getItem(keys.minVolume) || minVolume.value;
  }
  if (maxVolume) {
    maxVolume.value = localStorage.getItem(keys.maxVolume) || maxVolume.value;
  }
  if (minWait) {
    minWait.value = localStorage.getItem(keys.minWait) || minWait.value;
  }
  if (maxWait) {
    maxWait.value = localStorage.getItem(keys.maxWait) || maxWait.value;
  }
  if (enableFarnsworth) {
    const savedEnableFarnsworth = localStorage.getItem(keys.enableFarnsworth);
    enableFarnsworth.checked = savedEnableFarnsworth !== null ? savedEnableFarnsworth === 'true' : enableFarnsworth.checked;
  }
  if (farnsworthSpeed) {
    farnsworthSpeed.value = localStorage.getItem(keys.farnsworthSpeed) || farnsworthSpeed.value;
  }
  if (usOnly) {
    const savedUsOnly = localStorage.getItem(keys.usOnly);
    usOnly.checked = savedUsOnly !== null ? savedUsOnly === 'true' : usOnly.checked;
  }
  if (qrnRadios.length > 0) {
    const savedQrn = localStorage.getItem(keys.qrn);
    if (savedQrn) {
      const savedQrnRadio = document.querySelector(`input[name="qrn"][value="${savedQrn}"]`);
      if (savedQrnRadio) {
        savedQrnRadio.checked = true;
      }
    }
  }
  if (qsb) {
    const savedQsb = localStorage.getItem(keys.qsb);
    qsb.checked = savedQsb !== null ? savedQsb === 'true' : qsb.checked;
  }
  if (qsbPercentage) {
    qsbPercentage.value = localStorage.getItem(keys.qsbPercentage) || qsbPercentage.value;
  }
  if (enableCutNumbers) {
    const savedEnableCutNumbers = localStorage.getItem(keys.enableCutNumbers);
    enableCutNumbers.checked = savedEnableCutNumbers !== null ? savedEnableCutNumbers === 'true' : enableCutNumbers.checked;
  }
  if (cutT) {
    const savedCutT = localStorage.getItem(keys.cutT);
    cutT.checked = savedCutT !== null ? savedCutT === 'true' : cutT.checked;
  }
  if (cutA) {
    const savedCutA = localStorage.getItem(keys.cutA);
    cutA.checked = savedCutA !== null ? savedCutA === 'true' : cutA.checked;
  }
  if (cutU) {
    const savedCutU = localStorage.getItem(keys.cutU);
    cutU.checked = savedCutU !== null ? savedCutU === 'true' : cutU.checked;
  }
  if (cutV) {
    const savedCutV = localStorage.getItem(keys.cutV);
    cutV.checked = savedCutV !== null ? savedCutV === 'true' : cutV.checked;
  }
  if (cutE) {
    const savedCutE = localStorage.getItem(keys.cutE);
    cutE.checked = savedCutE !== null ? savedCutE === 'true' : cutE.checked;
  }
  if (cutG) {
    const savedCutG = localStorage.getItem(keys.cutG);
    cutG.checked = savedCutG !== null ? savedCutG === 'true' : cutG.checked;
  }
  if (cutD) {
    const savedCutD = localStorage.getItem(keys.cutD);
    cutD.checked = savedCutD !== null ? savedCutD === 'true' : cutD.checked;
  }
  if (cutN) {
    const savedCutN = localStorage.getItem(keys.cutN);
    cutN.checked = savedCutN !== null ? savedCutN === 'true' : cutN.checked;
  }

  // Update UI state after loading saved values
  // Update Farnsworth speed input state
  if (enableFarnsworth && farnsworthSpeed) {
    farnsworthSpeed.disabled = !enableFarnsworth.checked;
  }
  
  // Update QSB percentage input state
  if (qsb && qsbPercentage) {
    qsbPercentage.disabled = !qsb.checked;
  }
  
  // Update cut number checkboxes state
  if (enableCutNumbers) {
    const cutNumberIds = ['cutT', 'cutA', 'cutU', 'cutV', 'cutE', 'cutG', 'cutD', 'cutN'];
    cutNumberIds.forEach((id) => {
      const checkbox = document.getElementById(id);
      if (checkbox) {
        checkbox.disabled = !enableCutNumbers.checked;
      }
    });
  }

  // Load callsign format options
  const format1x1 = document.getElementById('1x1');
  const format1x2 = document.getElementById('1x2');
  const format1x3 = document.getElementById('1x3');
  const format2x1 = document.getElementById('2x1');
  const format2x2 = document.getElementById('2x2');
  const format2x3 = document.getElementById('2x3');
  
  // Load saved format preferences or use defaults
  const saved1x1 = localStorage.getItem(keys.format1x1);
  const saved1x2 = localStorage.getItem(keys.format1x2);
  const saved1x3 = localStorage.getItem(keys.format1x3);
  const saved2x1 = localStorage.getItem(keys.format2x1);
  const saved2x2 = localStorage.getItem(keys.format2x2);
  const saved2x3 = localStorage.getItem(keys.format2x3);
  
  format1x1.checked = saved1x1 !== null ? saved1x1 === 'true' : format1x1.checked;
  format1x2.checked = saved1x2 !== null ? saved1x2 === 'true' : format1x2.checked;
  format1x3.checked = saved1x3 !== null ? saved1x3 === 'true' : format1x3.checked;
  format2x1.checked = saved2x1 !== null ? saved2x1 === 'true' : format2x1.checked;
  format2x2.checked = saved2x2 !== null ? saved2x2 === 'true' : format2x2.checked;
  format2x3.checked = saved2x3 !== null ? saved2x3 === 'true' : format2x3.checked;

  // Load contest configuration
  const slashPercentage = document.getElementById('slashPercentage');
  const allowedLetters = document.getElementById('allowedLetters');
  const allowedNumbers = document.getElementById('allowedNumbers');
  const minCallsignLength = document.getElementById('minCallsignLength');
  const maxCallsignLength = document.getElementById('maxCallsignLength');
  const requirePrefix = document.getElementById('requirePrefix');
  const allowedPrefixes = document.getElementById('allowedPrefixes');
  
  if (slashPercentage) {
    slashPercentage.value = localStorage.getItem(keys.slashPercentage) || slashPercentage.value;
  }
  if (allowedLetters) {
    allowedLetters.value = localStorage.getItem(keys.allowedLetters) || allowedLetters.value;
  }
  if (allowedNumbers) {
    allowedNumbers.value = localStorage.getItem(keys.allowedNumbers) || allowedNumbers.value;
  }
  if (minCallsignLength) {
    minCallsignLength.value = localStorage.getItem(keys.minCallsignLength) || minCallsignLength.value;
  }
  if (maxCallsignLength) {
    maxCallsignLength.value = localStorage.getItem(keys.maxCallsignLength) || maxCallsignLength.value;
  }
  if (requirePrefix) {
    const savedRequirePrefix = localStorage.getItem(keys.requirePrefix);
    requirePrefix.checked = savedRequirePrefix !== null ? savedRequirePrefix === 'true' : requirePrefix.checked;
  }
  if (allowedPrefixes) {
    allowedPrefixes.value = localStorage.getItem(keys.allowedPrefixes) || allowedPrefixes.value;
  }

  // Save user settings to localStorage on input change
  yourCallsign.addEventListener('input', () => {
    localStorage.setItem(keys.yourCallsign, yourCallsign.value);
  });
  yourName.addEventListener('input', () => {
    localStorage.setItem(keys.yourName, yourName.value);
  });
  yourState.addEventListener('input', () => {
    // Save yourState
    localStorage.setItem(keys.yourState, yourState.value);
  });
  yourSpeed.addEventListener('input', () => {
    localStorage.setItem(keys.yourSpeed, yourSpeed.value);
  });
  yourSidetone.addEventListener('input', () => {
    localStorage.setItem(keys.yourSidetone, yourSidetone.value);
  });
  yourVolume.addEventListener('input', () => {
    localStorage.setItem(keys.yourVolume, yourVolume.value);
  });

  // Save responding station settings to localStorage on change
  if (maxStations) {
    maxStations.addEventListener('input', () => {
      localStorage.setItem(keys.maxStations, maxStations.value);
    });
  }
  if (minStations) {
    minStations.addEventListener('input', () => {
      localStorage.setItem(keys.minStations, minStations.value);
    });
  }
  if (minSpeed) {
    minSpeed.addEventListener('input', () => {
      localStorage.setItem(keys.minSpeed, minSpeed.value);
    });
  }
  if (maxSpeed) {
    maxSpeed.addEventListener('input', () => {
      localStorage.setItem(keys.maxSpeed, maxSpeed.value);
    });
  }
  if (minTone) {
    minTone.addEventListener('input', () => {
      localStorage.setItem(keys.minTone, minTone.value);
    });
  }
  if (maxTone) {
    maxTone.addEventListener('input', () => {
      localStorage.setItem(keys.maxTone, maxTone.value);
    });
  }
  if (minVolume) {
    minVolume.addEventListener('input', () => {
      localStorage.setItem(keys.minVolume, minVolume.value);
    });
  }
  if (maxVolume) {
    maxVolume.addEventListener('input', () => {
      localStorage.setItem(keys.maxVolume, maxVolume.value);
    });
  }
  if (minWait) {
    minWait.addEventListener('input', () => {
      localStorage.setItem(keys.minWait, minWait.value);
    });
  }
  if (maxWait) {
    maxWait.addEventListener('input', () => {
      localStorage.setItem(keys.maxWait, maxWait.value);
    });
  }
  if (enableFarnsworth) {
    enableFarnsworth.addEventListener('change', () => {
      localStorage.setItem(keys.enableFarnsworth, enableFarnsworth.checked);
    });
  }
  if (farnsworthSpeed) {
    farnsworthSpeed.addEventListener('input', () => {
      localStorage.setItem(keys.farnsworthSpeed, farnsworthSpeed.value);
    });
  }
  if (usOnly) {
    usOnly.addEventListener('change', () => {
      localStorage.setItem(keys.usOnly, usOnly.checked);
    });
  }
  if (qrnRadios.length > 0) {
    qrnRadios.forEach((radio) => {
      radio.addEventListener('change', () => {
        localStorage.setItem(keys.qrn, radio.value);
      });
    });
  }
  if (qsb) {
    qsb.addEventListener('change', () => {
      localStorage.setItem(keys.qsb, qsb.checked);
    });
  }
  if (qsbPercentage) {
    qsbPercentage.addEventListener('input', () => {
      localStorage.setItem(keys.qsbPercentage, qsbPercentage.value);
    });
  }
  if (enableCutNumbers) {
    enableCutNumbers.addEventListener('change', () => {
      localStorage.setItem(keys.enableCutNumbers, enableCutNumbers.checked);
    });
  }
  if (cutT) {
    cutT.addEventListener('change', () => {
      localStorage.setItem(keys.cutT, cutT.checked);
    });
  }
  if (cutA) {
    cutA.addEventListener('change', () => {
      localStorage.setItem(keys.cutA, cutA.checked);
    });
  }
  if (cutU) {
    cutU.addEventListener('change', () => {
      localStorage.setItem(keys.cutU, cutU.checked);
    });
  }
  if (cutV) {
    cutV.addEventListener('change', () => {
      localStorage.setItem(keys.cutV, cutV.checked);
    });
  }
  if (cutE) {
    cutE.addEventListener('change', () => {
      localStorage.setItem(keys.cutE, cutE.checked);
    });
  }
  if (cutG) {
    cutG.addEventListener('change', () => {
      localStorage.setItem(keys.cutG, cutG.checked);
    });
  }
  if (cutD) {
    cutD.addEventListener('change', () => {
      localStorage.setItem(keys.cutD, cutD.checked);
    });
  }
  if (cutN) {
    cutN.addEventListener('change', () => {
      localStorage.setItem(keys.cutN, cutN.checked);
    });
  }

  // Save callsign format options to localStorage on change
  format1x1.addEventListener('change', () => {
    localStorage.setItem(keys.format1x1, format1x1.checked);
  });
  format1x2.addEventListener('change', () => {
    localStorage.setItem(keys.format1x2, format1x2.checked);
  });
  format1x3.addEventListener('change', () => {
    localStorage.setItem(keys.format1x3, format1x3.checked);
  });
  format2x1.addEventListener('change', () => {
    localStorage.setItem(keys.format2x1, format2x1.checked);
  });
  format2x2.addEventListener('change', () => {
    localStorage.setItem(keys.format2x2, format2x2.checked);
  });
  format2x3.addEventListener('change', () => {
    localStorage.setItem(keys.format2x3, format2x3.checked);
  });

  // Save contest configuration to localStorage on change
  if (slashPercentage) {
    slashPercentage.addEventListener('input', () => {
      localStorage.setItem(keys.slashPercentage, slashPercentage.value);
    });
  }
  if (allowedLetters) {
    allowedLetters.addEventListener('input', () => {
      localStorage.setItem(keys.allowedLetters, allowedLetters.value);
    });
  }
  if (allowedNumbers) {
    allowedNumbers.addEventListener('input', () => {
      localStorage.setItem(keys.allowedNumbers, allowedNumbers.value);
    });
  }
  if (minCallsignLength) {
    minCallsignLength.addEventListener('input', () => {
      localStorage.setItem(keys.minCallsignLength, minCallsignLength.value);
    });
  }
  if (maxCallsignLength) {
    maxCallsignLength.addEventListener('input', () => {
      localStorage.setItem(keys.maxCallsignLength, maxCallsignLength.value);
    });
  }
  if (requirePrefix) {
    requirePrefix.addEventListener('change', () => {
      localStorage.setItem(keys.requirePrefix, requirePrefix.checked);
    });
  }
  if (allowedPrefixes) {
    allowedPrefixes.addEventListener('input', () => {
      localStorage.setItem(keys.allowedPrefixes, allowedPrefixes.value);
    });
  }

  // Handle QRN intensity changes
  const qrnRadioButtons = document.querySelectorAll('input[name="qrn"]');
  qrnRadioButtons.forEach((radio) => {
    radio.addEventListener('change', updateStaticIntensity);
  });

  // Determine mode from local storage or default to single
  const savedMode = localStorage.getItem('mode') || 'single';
  // Check the corresponding radio button based on savedMode
  const savedModeRadio = document.querySelector(
    `input[name="mode"][value="${savedMode}"]`
  );
  if (savedModeRadio) {
    savedModeRadio.checked = true;
  }

  // Set currentMode to the saved or default mode
  currentMode = savedMode;

  // Set initial visibility of contest configuration div based on saved mode
  const contestConfig = document.getElementById('contestConfig');
  if (savedMode === 'contest') {
    contestConfig.style.display = 'block';
  } else {
    contestConfig.style.display = 'none';
  }

  // Update basic stats on page load
  if (yourCallsign.value !== '') {
    fetch(`https://stats.${window.location.hostname}/api/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: currentMode, callsign: yourCallsign.value }),
    }).catch((error) => {
      console.error('Failed to send CloudFlare stats.');
    });
  }

  // Reset state to ensure no leftover stations when loading
  resetGameState();

  // Apply mode settings now that currentMode matches the dropdown and local storage
  applyModeSettings(currentMode);
});

/**
 * Retrieves the logic configuration for the current mode.
 *
 * Returns the object containing mode-specific logic and rules, such as
 * message templates and exchange formats, based on the selected mode.
 *
 * @returns {Object} The configuration object for the current mode.
 */
function getModeConfig() {
  return modeLogicConfig[currentMode];
}

/**
 * Updates the UI to reflect the current mode's configuration.
 *
 * Adjusts visibility, placeholders, and content of various UI elements like the
 * "TU" button, input fields, and results table. Also modifies extra columns in the
 * results table based on mode-specific requirements.
 *
 * @param {string} mode - The mode to apply settings for.
 */
function applyModeSettings(mode) {
  const config = modeUIConfig[mode];
  const tuButton = document.getElementById('tuButton');
  const infoField = document.getElementById('infoField');
  const infoField2 = document.getElementById('infoField2');
  const resultsTable = document.getElementById('resultsTable');
  const modeResultsHeader = document.getElementById('modeResultsHeader');

  // TU button visibility
  tuButton.style.display = config.showTuButton ? 'inline-block' : 'none';

  // Info field visibility & placeholder
  if (config.showInfoField) {
    infoField.style.display = 'inline-block';
    infoField.placeholder = config.infoFieldPlaceholder;
  } else {
    infoField.style.display = 'none';
    infoField.value = '';
  }

  // Info field 2 visibility & placeholder
  if (config.showInfoField2) {
    infoField2.style.display = 'inline-block';
    infoField2.placeholder = config.infoField2Placeholder;
  } else {
    infoField2.style.display = 'none';
    infoField2.value = '';
  }

  // Update results header text
  modeResultsHeader.textContent = config.resultsHeader;

  // Show/hide the extra column in the results table
  const extraColumns = resultsTable.querySelectorAll('.mode-specific-column');
  extraColumns.forEach((col) => {
    col.style.display = config.tableExtraColumn ? 'table-cell' : 'none';
  });

  // Update extra column header text
  const extraColumnHeaders = resultsTable.querySelectorAll(
    'thead .mode-specific-column'
  );
  extraColumnHeaders.forEach((header) => {
    header.textContent = config.extraColumnHeader || 'Additional Info';
  });
}

/**
 * Resets the game state and clears all UI elements.
 *
 * Resets variables related to stations, attempts, and contacts. Clears the results
 * table, disables the CQ button, stops all audio, and reinitializes the response field.
 */
function resetGameState() {
  currentStations = [];
  currentStation = null;
  activeStationIndex = null;
  readyForTU = false;
  currentStationAttempts = 0;
  currentStationStartTime = null;
  totalContacts = 0;

  updateActiveStations(0);
  clearTable('resultsTable');
  document.getElementById('responseField').value = '';
  document.getElementById('infoField').value = '';
  document.getElementById('infoField2').value = '';
  document.getElementById('cqButton').disabled = false;
  stopAllAudio();
  updateAudioLock(0);
}

/**
 * Handles changes to the operating mode.
 *
 * Updates the `currentMode` variable, saves the new mode to local storage,
 * resets the game state, clears invalid states, and applies the new mode's settings.
 */
function changeMode() {
  const selectedMode = document.querySelector(
    'input[name="mode"]:checked'
  ).value;
  currentMode = selectedMode;
  localStorage.setItem('mode', currentMode);
  resetGameState();
  clearAllInvalidStates();
  applyModeSettings(currentMode);
}

/**
 * Handles the "CQ" button click to call stations.
 *
 * - In multi-station modes, calling CQ adds more stations if enabled.
 * - In single mode, calling CQ fetches a new station if none is active.
 * - Plays the CQ message using the user's station configuration.
 */
function cq() {
  if (getAudioLock()) return;

  const modeConfig = getModeConfig();
  const cqButton = document.getElementById('cqButton');

  if (currentMode !== 'contest' && !modeConfig.showTuStep && currentStation !== null) {
    return;
  }

  let backgroundStaticDelay = 0;
  if (!isBackgroundStaticPlaying()) {
    createBackgroundStatic();
    backgroundStaticDelay = 2;
  }

  inputs = getInputs();
  if (inputs === null) return;

  yourStation = getYourStation();
  yourStation.player = createMorsePlayer(yourStation);

  let cqMsg = modeConfig.cqMessage(yourStation, null, null);
  let yourResponseTimer = yourStation.player.playSentence(
    cqMsg,
    audioContext.currentTime + backgroundStaticDelay
  );
  updateAudioLock(yourResponseTimer);

  if (modeConfig.showTuStep || currentMode === 'contest') {
    // Contest-like modes: CQ adds more stations
    
    // Ensure we have at least inputs.minStations if the mode supports it
    if (currentStations.length === 0 && inputs.minStations > 0) {
      // Add exactly inputs.minStations for initial call
      for (let i = 0; i < inputs.minStations; i++) {
        let callingStation = getCallingStation();
        printStation(callingStation);
        currentStations.push(callingStation);
      }
      console.log(`+ Added ${inputs.minStations} initial stations...`);
      updateActiveStations(currentStations.length);
    } else {
      // Normal behavior for subsequent calls
      addStations(currentStations, inputs);
    }
    
    respondWithAllStations(currentStations, yourResponseTimer);
    lastRespondingStations = currentStations;
  } else {
    // Single mode: Just get one station
    cqButton.disabled = true;
    nextSingleStation(yourResponseTimer);
  }
}

/**
 * Sends the user's response to a station or stations.
 *
 * Matches the user's input against active stations, handles repeat requests, and
 * processes partial or perfect matches. Plays responses and exchanges based on the
 * mode's configuration. Adjusts the game state for each scenario.
 */
function send() {
  if (getAudioLock()) return;
  const modeConfig = getModeConfig();
  const responseField = document.getElementById('responseField');
  const infoField = document.getElementById('infoField');
  const infoField2 = document.getElementById('infoField2');

  let responseFieldText = responseField.value.trim().toUpperCase();

  // Prevent sending if responseField text box is empty
  if (responseFieldText === '') {
    // If the response field is empty and there are no active stations, call CQ
    if (currentStations.length === 0) {
      cq();
    }
    return;
  }

  console.log(`--> Sending "${responseFieldText}"`);

  if (currentMode === 'contest') {
    // Contest mode - simplified behavior similar to single mode but with multiple stations
    if (currentStations.length === 0) return;

    let yourResponseTimer = yourStation.player.playSentence(responseFieldText);
    updateAudioLock(yourResponseTimer);

    // Handling repeats
    if (
      responseFieldText === '?' ||
      responseFieldText === 'AGN' ||
      responseFieldText === 'AGN?'
    ) {
      respondWithAllStations(currentStations, yourResponseTimer);
      lastRespondingStations = currentStations;
      currentStationAttempts++;
      return;
    }

    // Handle QRS
    if (responseFieldText === 'QRS') {
      // For each lastRespondingStations,
      // if Farensworth is already enabled, lower it by farnsworthLowerBy, but not less than 5
      lastRespondingStations.forEach((stn) => {
        if (stn.enableFarnsworth) {
          stn.farnsworthSpeed = Math.max(
            5,
            stn.farnsworthSpeed - farnsworthLowerBy
          );
        } else {
          stn.enableFarnsworth = true;
          stn.farnsworthSpeed = stn.wpm - farnsworthLowerBy;
        }
      });

      respondWithAllStations(lastRespondingStations, yourResponseTimer);
      currentStationAttempts++;
      return;
    }

    let results = currentStations.map((stn) =>
      compareStrings(stn.callsign, responseFieldText.replace('?', ''))
    );
    let hasQuestionMark = responseFieldText.includes('?');

    if (results.includes('perfect')) {
      let matchIndex = results.indexOf('perfect');
      if (hasQuestionMark) {
        // Perfect match but user unsure
        let theirResponseTimer = currentStations[
          matchIndex
        ].player.playSentence('RR', yourResponseTimer + 0.25);
        updateAudioLock(theirResponseTimer);
        currentStationAttempts++;
        return;
      } else {
        // Perfect confirmed match - in contest mode, just reply with 'E'
        let currentStation = currentStations[matchIndex];
        let theirResponseTimer = currentStation.player.playSentence(
          'E',
          yourResponseTimer + 0.5
        );
        updateAudioLock(theirResponseTimer);
        
        // Log the contact
        totalContacts++;
        const wpmString =
          `${currentStation.wpm}` +
          (currentStation.enableFarnsworth
            ? ` / ${currentStation.farnsworthSpeed}`
            : '');
        
        addTableRow(
          'resultsTable',
          totalContacts,
          currentStation.callsign,
          wpmString,
          currentStationAttempts,
          audioContext.currentTime - currentStationStartTime,
          '' // No additional info in contest mode
        );
        
        // Remove the worked station and reset counters
        currentStations.splice(matchIndex, 1);
        currentStationAttempts = 0;
        updateActiveStations(currentStations.length);
        
        // Ensure we have at least inputs.minStations active stations
        if (currentStations.length < inputs.minStations) {
          const stationsNeeded = inputs.minStations - currentStations.length;
          console.log(`+ Adding ${stationsNeeded} stations to maintain minimum...`);
          for (let i = 0; i < stationsNeeded; i++) {
            let callingStation = getCallingStation();
            printStation(callingStation);
            currentStations.push(callingStation);
          }
          updateActiveStations(currentStations.length);
        }
        // Additional chance of a new station joining beyond the minimum
        else if (Math.random() < 0.4) {
          addStations(currentStations, inputs);
        }
        
        // Respond with all remaining stations
        respondWithAllStations(currentStations, theirResponseTimer);
        lastRespondingStations = currentStations;
        currentStationStartTime = audioContext.currentTime;
        document.getElementById('responseField').value = '';
        document.getElementById('responseField').focus();
        return;
      }
    }

    if (results.includes('partial')) {
      // Partial matches: repeat them
      let partialMatchStations = currentStations.filter(
        (_, index) => results[index] === 'partial'
      );
      respondWithAllStations(partialMatchStations, yourResponseTimer);
      lastRespondingStations = partialMatchStations;
      currentStationAttempts++;
      return;
    }

    // No matches at all
    if (currentMode === 'contest') {
      // In contest mode, stations always respond even with no match
      respondWithAllStations(currentStations, yourResponseTimer);
      lastRespondingStations = currentStations;
      currentStationAttempts++;
      return;
    }
    currentStationAttempts++;
  } else if (modeConfig.showTuStep) {
    // Multi-station scenario with TU step
    if (currentStations.length === 0) return;

    let yourResponseTimer = yourStation.player.playSentence(responseFieldText);
    updateAudioLock(yourResponseTimer);

    // Handling repeats
    if (
      responseFieldText === '?' ||
      responseFieldText === 'AGN' ||
      responseFieldText === 'AGN?'
    ) {
      respondWithAllStations(currentStations, yourResponseTimer);
      lastRespondingStations = currentStations;
      currentStationAttempts++;
      return;
    }

    // Handle QRS
    if (responseFieldText === 'QRS') {
      // For each lastRespondingStations,
      // if Farensworth is already enabled, lower it by farnsworthLowerBy, but not less than 5
      lastRespondingStations.forEach((stn) => {
        if (stn.enableFarnsworth) {
          stn.farnsworthSpeed = Math.max(
            5,
            stn.farnsworthSpeed - farnsworthLowerBy
          );
        } else {
          stn.enableFarnsworth = true;
          stn.farnsworthSpeed = stn.wpm - farnsworthLowerBy;
        }
      });

      respondWithAllStations(lastRespondingStations, yourResponseTimer);
      currentStationAttempts++;
      return;
    }

    let results = currentStations.map((stn) =>
      compareStrings(stn.callsign, responseFieldText.replace('?', ''))
    );
    let hasQuestionMark = responseFieldText.includes('?');

    if (results.includes('perfect')) {
      let matchIndex = results.indexOf('perfect');
      if (hasQuestionMark) {
        // Perfect match but user unsure
        let theirResponseTimer = currentStations[
          matchIndex
        ].player.playSentence('RR', yourResponseTimer + 0.25);
        updateAudioLock(theirResponseTimer);
        currentStationAttempts++;
        return;
      } else {
        // Perfect confirmed match
        let yourExchange, theirExchange;
        yourExchange =
          ' ' +
          modeConfig.yourExchange(
            yourStation,
            currentStations[matchIndex],
            null
          );
        theirExchange = modeConfig.theirExchange(
          yourStation,
          currentStations[matchIndex],
          null
        );

        if (inputs.enableCutNumbers) {
          // inputs.cutNumbers is the object returned by getSelectedCutNumbers()
          // e.g. { '0': 'T', '9': 'N' } if T/0 and N/9 are selected
          const cutMap = inputs.cutNumbers;

          // Convert any digits in yourExchange and theirExchange
          // to their cut-letter equivalent, if found in cutMap
          yourExchange = yourExchange.replace(
            /\d/g,
            (digit) => cutMap[digit] || digit
          );
          theirExchange = theirExchange.replace(
            /\d/g,
            (digit) => cutMap[digit] || digit
          );
        }

        let yourResponseTimer2 = yourStation.player.playSentence(
          yourExchange,
          yourResponseTimer
        );
        updateAudioLock(yourResponseTimer2);
        let theirResponseTimer = currentStations[
          matchIndex
        ].player.playSentence(theirExchange, yourResponseTimer2 + 0.5);
        updateAudioLock(theirResponseTimer);
        currentStationAttempts++;

        if (modeConfig.requiresInfoField) {
          infoField.focus();
        }
        readyForTU = true;
        activeStationIndex = matchIndex;
        return;
      }
    }

    if (results.includes('partial')) {
      // Partial matches: repeat them
      let partialMatchStations = currentStations.filter(
        (_, index) => results[index] === 'partial'
      );
      respondWithAllStations(partialMatchStations, yourResponseTimer);
      lastRespondingStations = partialMatchStations;
      currentStationAttempts++;
      return;
    }

    // No matches at all
    if (currentMode === 'contest') {
      // In contest mode, stations always respond even with no match
      respondWithAllStations(currentStations, yourResponseTimer);
      lastRespondingStations = currentStations;
      currentStationAttempts++;
      return;
    }
    currentStationAttempts++;
  } else {
    // Single mode
    if (currentStation === null) return;

    let yourResponseTimer = yourStation.player.playSentence(responseFieldText);
    updateAudioLock(yourResponseTimer);

    if (
      responseFieldText === '?' ||
      responseFieldText === 'AGN' ||
      responseFieldText === 'AGN?'
    ) {
      let theirResponseTimer = currentStation.player.playSentence(
        currentStation.callsign,
        yourResponseTimer + Math.random() + 0.25
      );
      updateAudioLock(theirResponseTimer);
      currentStationAttempts++;
      return;
    }

    if (responseFieldText === 'QRS') {
      // If Farensworth is already enabled, lower it by farnsworthLowerBy, but not less than 5
      if (currentStation.enableFarnsworth) {
        currentStation.farnsworthSpeed = Math.max(
          5,
          currentStation.farnsworthSpeed - farnsworthLowerBy
        );
      } else {
        currentStation.enableFarnsworth = true;
        currentStation.farnsworthSpeed = currentStation.wpm - farnsworthLowerBy;
      }
      // Create a new player
      currentStation.player = createMorsePlayer(currentStation);
      let theirResponseTimer = currentStation.player.playSentence(
        currentStation.callsign,
        yourResponseTimer + Math.random() + 0.25
      );
      updateAudioLock(theirResponseTimer);
      currentStationAttempts++;
      return;
    }

    let compareResult = compareStrings(
      currentStation.callsign,
      responseFieldText.replace('?', '')
    );

    if (compareResult === 'perfect') {
      currentStationAttempts++;

      if (responseFieldText.includes('?')) {
        let theirResponseTimer = currentStation.player.playSentence(
          'RR',
          yourResponseTimer + 1
        );
        updateAudioLock(theirResponseTimer);
        return;
      }

      // Perfect match confirmed in single mode
      let yourExchange =
        ' ' + modeConfig.yourExchange(yourStation, currentStation, null);
      let theirExchange = modeConfig.theirExchange(
        yourStation,
        currentStation,
        null
      );

      let yourResponseTimer2 = yourStation.player.playSentence(
        yourExchange,
        yourResponseTimer
      );
      updateAudioLock(yourResponseTimer2);
      let theirResponseTimer = currentStation.player.playSentence(
        theirExchange,
        yourResponseTimer2 + 0.5
      );
      updateAudioLock(theirResponseTimer);
      let yourSignoff = modeConfig.yourSignoff(
        yourStation,
        currentStation,
        null
      );
      let yourResponseTimer3 = yourStation.player.playSentence(
        yourSignoff,
        theirResponseTimer + 0.5
      );
      updateAudioLock(yourResponseTimer3);
      let theirSignoff = modeConfig.theirSignoff(
        yourStation,
        currentStation,
        null
      );
      let theirResponseTimer2 = currentStation.player.playSentence(
        theirSignoff,
        yourResponseTimer3 + 0.5
      );
      updateAudioLock(theirResponseTimer2);

      totalContacts++;
      const wpmString =
        `${currentStation.wpm}` +
        (currentStation.enableFarnsworth
          ? ` / ${currentStation.farnsworthSpeed}`
          : '');
      addTableRow(
        'resultsTable',
        totalContacts,
        currentStation.callsign,
        wpmString,
        currentStationAttempts,
        audioContext.currentTime - currentStationStartTime,
        '' // No additional info in single mode
      );

      nextSingleStation(theirResponseTimer2);
      return;
    } else if (compareResult === 'partial') {
      currentStationAttempts++;
      let theirResponseTimer = currentStation.player.playSentence(
        currentStation.callsign,
        yourResponseTimer + Math.random() + 0.25
      );
      updateAudioLock(theirResponseTimer);
      return;
    }

    // No match in single mode
    currentStationAttempts++;
    let theirResponseTimer = currentStation.player.playSentence(
      currentStation.callsign,
      yourResponseTimer + Math.random() + 0.25
    );
    updateAudioLock(theirResponseTimer);
  }
}

/**
 * Finalizes a QSO (contact) in multi-station modes.
 *
 * Compares the user's input in extra info fields against the current station's
 * attributes. Logs results, updates the UI, and optionally fetches new stations.
 * Plays the user's and station's sign-off messages.
 */
function tu() {
  if (getAudioLock()) return;
  const modeConfig = getModeConfig();
  if (!modeConfig.showTuStep || !readyForTU) return;

  const infoField = document.getElementById('infoField');
  const infoField2 = document.getElementById('infoField2');
  let infoValue1 = infoField.value.trim();
  let infoValue2 = infoField2.value.trim();

  let currentStation = currentStations[activeStationIndex];
  totalContacts++;

  // Compare both fields if required
  let extraInfo = '';
  extraInfo += compareExtraInfo(
    modeConfig.extraInfoFieldKey,
    infoValue1,
    currentStation
  );
  if (modeConfig.requiresInfoField2 && modeConfig.extraInfoFieldKey2) {
    if (extraInfo.length > 0) extraInfo += ' / ';
    extraInfo += compareExtraInfo(
      modeConfig.extraInfoFieldKey2,
      infoValue2,
      currentStation
    );
  }

  let arbitrary = null;
  if (currentMode === 'sst') {
    arbitrary = infoValue1; // name
  } else if (currentMode === 'pota') {
    arbitrary = infoValue1; //state
  }

  let yourSignoffMessage = modeConfig.yourSignoff(
    yourStation,
    currentStation,
    arbitrary
  );

  let yourResponseTimer = yourStation.player.playSentence(
    yourSignoffMessage,
    audioContext.currentTime + 0.5
  );
  updateAudioLock(yourResponseTimer);

  let responseTimerToUse = yourResponseTimer; // fallback timer

  if (typeof modeConfig.theirSignoff === 'function') {
    // Call theirSignoff only if it returns a non-empty string
    let theirSignoffMessage = modeConfig.theirSignoff(
      yourStation,
      currentStation,
      null
    );
    let theirResponseTimer = currentStation.player.playSentence(
      theirSignoffMessage,
      yourResponseTimer + 0.5
    );
    updateAudioLock(theirResponseTimer);
    responseTimerToUse = theirResponseTimer;
  } else {
    // No theirSignoff defined or it's null.
    // The QSO ends here after yourSignoff.
  }

  const wpmString =
    `${currentStation.wpm}` +
    (currentStation.enableFarnsworth
      ? ` / ${currentStation.farnsworthSpeed}`
      : '');

  // Add the QSO result to the table
  addTableRow(
    'resultsTable',
    totalContacts,
    currentStation.callsign,
    wpmString,
    currentStationAttempts,
    audioContext.currentTime - currentStationStartTime,
    extraInfo
  );

  // Remove the worked station
  currentStations.splice(activeStationIndex, 1);
  activeStationIndex = null;
  currentStationAttempts = 0;
  readyForTU = false;
  updateActiveStations(currentStations.length);

  const responseField = document.getElementById('responseField');
  responseField.value = '';
  infoField.value = '';
  infoField2.value = '';
  responseField.focus();

  // Ensure we have at least inputs.minStations active stations
  if (modeConfig.showTuStep && currentStations.length < inputs.minStations) {
    const stationsNeeded = inputs.minStations - currentStations.length;
    console.log(`+ Adding ${stationsNeeded} stations to maintain minimum...`);
    for (let i = 0; i < stationsNeeded; i++) {
      let callingStation = getCallingStation();
      printStation(callingStation);
      currentStations.push(callingStation);
    }
    updateActiveStations(currentStations.length);
  }
  // Additional chance of a new station joining beyond the minimum
  else if (Math.random() < 0.4) {
    addStations(currentStations, inputs);
  }

  respondWithAllStations(currentStations, responseTimerToUse);
  lastRespondingStations = currentStations;
  currentStationStartTime = audioContext.currentTime;
}

/**
 * Compares the user's input against a station's corresponding property.
 *
 * Matches the input to attributes like name, state, or serial number, and
 * returns a string indicating correctness. For incorrect matches, shows
 * the expected value.
 *
 * @param {string} fieldKey - The station attribute to compare (e.g., name, state).
 * @param {string} userInput - The user's input value.
 * @param {Object} callingStation - The station object to compare against.
 * @returns {string} A string indicating correctness or showing the expected value.
 */
function compareExtraInfo(fieldKey, userInput, callingStation) {
  if (!fieldKey) return '';

  // Grab the raw expected value
  let expectedValue = callingStation[fieldKey];

  // Handle numeric fields separately:
  if (fieldKey === 'serialNumber' || fieldKey === 'cwopsNumber') {
    let userValInt = parseInt(userInput, 10);

    // Handle NaN (i.e., empty or non-numeric input)
    if (isNaN(userValInt)) {
      return `<span class="text-warning">
                <i class="fa-solid fa-triangle-exclamation me-1"></i>
              </span> (${expectedValue})`;
    }

    let correct = userValInt === Number(expectedValue);
    return correct
      ? `<span class="text-success">
           <i class="fa-solid fa-check me-1"></i><strong>${userValInt}</strong>
         </span>`
      : `<span class="text-warning">
           <i class="fa-solid fa-triangle-exclamation me-1"></i>${userValInt}
         </span> (${expectedValue})`;
  }

  // For string-based fields (e.g. name, state), force them to string
  let upperExpectedValue = String(expectedValue).toUpperCase();
  userInput = (userInput || '').toUpperCase().trim();

  // Special rule: if both are empty => "N/A"
  if (upperExpectedValue === '') {
    return 'N/A';
  }

  // Normal string comparison
  let correct = userInput === upperExpectedValue;
  return correct
    ? `<span class="text-success">
         <i class="fa-solid fa-check me-1"></i><strong>${userInput}</strong>
       </span>`
    : `<span class="text-warning">
         <i class="fa-solid fa-triangle-exclamation me-1"></i>${userInput}
       </span> (${upperExpectedValue})`;
}

/**
 * Fetches and sets up a new station in single mode after a completed QSO.
 *
 * Creates a new station object, initializes it with a Morse player, and plays
 * the station's callsign. Updates the game state and refocuses on the response field.
 *
 * @param {number} responseStartTime - The time at which the next station interaction begins.
 */
function nextSingleStation(responseStartTime) {
  const modeConfig = getModeConfig();
  const responseField = document.getElementById('responseField');
  const cqButton = document.getElementById('cqButton');

  let callingStation = getCallingStation();
  printStation(callingStation);
  currentStation = callingStation;
  currentStationAttempts = 0;
  updateActiveStations(1);

  callingStation.player = createMorsePlayer(callingStation);
  let theirResponseTimer = callingStation.player.playSentence(
    callingStation.callsign,
    responseStartTime + Math.random() + 1
  );
  updateAudioLock(theirResponseTimer);

  currentStationStartTime = theirResponseTimer;
  responseField.value = '';
  responseField.focus();

  cqButton.disabled = !modeConfig.showTuStep && currentStation !== null;
}

/**
 * Stops all audio playback and resets run state so space toggles reliably.
 *
 * Clears any active station(s) across all modes, re-enables the CQ button,
 * and updates the active stations indicator. Does not clear results/history.
 */
function stop() {
  stopAllAudio();
  const cqButton = document.getElementById('cqButton');
  cqButton.disabled = false;

  // Clear running state for both single and multi-station modes so toggle works
  currentStation = null;
  currentStationAttempts = 0;
  currentStationStartTime = null;
  currentStations = [];
  activeStationIndex = null;
  readyForTU = false;
  lastRespondingStations = null;
  updateActiveStations(0);
}

/**
 * Performs a full reset of the application.
 *
 * Clears the results table, resets all variables, stops audio playback,
 * and focuses on the response field. Adjusts the CQ button based on mode logic.
 */
function reset() {
  clearTable('resultsTable');

  totalContacts = 0;
  currentStation = null;
  currentStationAttempts = 0;
  currentStationStartTime = null;
  currentStations = [];
  activeStationIndex = null;
  readyForTU = false;

  updateActiveStations(0);
  updateAudioLock(0);
  stopAllAudio();

  const responseField = document.getElementById('responseField');
  const infoField = document.getElementById('infoField');
  const infoField2 = document.getElementById('infoField2');
  responseField.value = '';
  infoField.value = '';
  infoField2.value = '';
  responseField.focus();

  const modeConfig = getModeConfig();
  const cqButton = document.getElementById('cqButton');
  cqButton.disabled = false;
}
