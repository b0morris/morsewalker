/**
 * modeUIConfig defines the UI-related aspects of each mode, including whether
 * one or two info fields are displayed, their placeholders, and result headers.
 * Additionally, it specifies what the extra column header should be.
 */
export const modeUIConfig = {
  single: {
    showTuButton: false,
    showInfoField: false,
    infoFieldPlaceholder: '',
    showInfoField2: false,
    infoField2Placeholder: '',
    tableExtraColumn: false,
    extraColumnHeader: '',
    resultsHeader: 'Single Mode Results',
  },
  contest: {
    showTuButton: false,
    showInfoField: false,
    infoFieldPlaceholder: '',
    showInfoField2: false,
    infoField2Placeholder: '',
    tableExtraColumn: false,
    extraColumnHeader: '',
    resultsHeader: 'Contest Mode Results',
    contestConfig: {
      allowedLetters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      allowedNumbers: '0123456789',
      minCallsignLength: 3,
      maxCallsignLength: 6,
      requirePrefix: true,
      allowedPrefixes: [
        // US prefixes (70% total)
        { value: 'K', weight: 35 }, // 35%
        { value: 'W', weight: 20 }, // 20%
        { value: 'N', weight: 15 }, // 15%
        
        // AA-AL series (10% total)
        { value: 'AA', weight: 1.5 }, // 1.5%
        { value: 'AB', weight: 1.5 }, // 1.5%
        { value: 'AC', weight: 1.5 }, // 1.5%
        { value: 'AD', weight: 0.8 }, // 0.8%
        { value: 'AE', weight: 0.8 }, // 0.8%
        { value: 'AF', weight: 0.8 }, // 0.8%
        { value: 'AG', weight: 0.8 }, // 0.8%
        { value: 'AH', weight: 0.8 }, // 0.8%
        { value: 'AI', weight: 0.8 }, // 0.8%
        { value: 'AJ', weight: 0.8 }, // 0.8%
        { value: 'AK', weight: 0.8 }, // 0.8%
        { value: 'AL', weight: 0.8 }, // 0.8%

        // Canadian prefixes (10% total)
        { value: 'VE', weight: 5 }, // 5%
        { value: 'VA', weight: 2.5 }, // 2.5%
        { value: 'VO', weight: 2.5 }, // 2.5%

        // Mexican prefixes (10% total)
        { value: 'XA', weight: 0.4 }, // 0.4%
        { value: 'XB', weight: 0.4 }, // 0.4%
        { value: 'XC', weight: 0.4 }, // 0.4%
        { value: 'XD', weight: 0.4 }, // 0.4%
        { value: 'XE', weight: 0.4 }, // 0.4%
        { value: 'XF', weight: 0.4 }, // 0.4%
        { value: 'XG', weight: 0.4 }, // 0.4%
        { value: 'XH', weight: 0.4 }, // 0.4%
        { value: 'XI', weight: 0.4 }, // 0.4%
        { value: 'XJ', weight: 0.4 }, // 0.4%
        { value: 'XK', weight: 0.4 }, // 0.4%
        { value: 'XL', weight: 0.4 }, // 0.4%
        { value: 'XM', weight: 0.4 }, // 0.4%
        { value: 'XN', weight: 0.4 }, // 0.4%
        { value: 'XO', weight: 0.4 }, // 0.4%
        { value: 'XP', weight: 0.4 }, // 0.4%
        { value: 'XQ', weight: 0.4 }, // 0.4%
        { value: 'XR', weight: 0.4 }, // 0.4%
        { value: 'XS', weight: 0.4 }, // 0.4%
        { value: 'XT', weight: 0.4 }, // 0.4%
        { value: 'XU', weight: 0.4 }, // 0.4%
        { value: 'XV', weight: 0.4 }, // 0.4%
        { value: 'XW', weight: 0.4 }, // 0.4%
        { value: 'XX', weight: 0.4 }, // 0.4%
        { value: 'XY', weight: 0.4 }, // 0.4%
        { value: 'XZ', weight: 0.4 }, // 0.4%
      ],
    }
  },
  pota: {
    showTuButton: true,
    showInfoField: true,
    infoFieldPlaceholder: 'State',
    showInfoField2: false,
    infoField2Placeholder: '',
    tableExtraColumn: true,
    extraColumnHeader: 'State',
    resultsHeader: 'POTA Mode Results',
  },
  sst: {
    showTuButton: true,
    showInfoField: true,
    infoFieldPlaceholder: 'Name',
    showInfoField2: true,
    infoField2Placeholder: 'State',
    tableExtraColumn: true,
    extraColumnHeader: 'Additional Info',
    resultsHeader: 'SST Mode Results',
  },
  cwt: {
    showTuButton: true,
    showInfoField: true,
    infoFieldPlaceholder: 'Name',
    showInfoField2: true,
    infoField2Placeholder: 'CW Ops No.',
    tableExtraColumn: true,
    extraColumnHeader: 'Additional Info',
    resultsHeader: 'CWT Mode Results',
  },
  troubledLetters: {
    showTuButton: false,
    showInfoField: false,
    infoFieldPlaceholder: '',
    showInfoField2: false,
    infoField2Placeholder: '',
    tableExtraColumn: false,
    extraColumnHeader: '',
    resultsHeader: 'Troubled Letters Mode Results',
  },
};

/**
 * modeLogicConfig centralizes the message construction logic for various modes.
 * Each mode's functions define how CQ calls, exchanges, and final messages are generated,
 * removing the need for conditional branching (e.g., if/else statements) elsewhere.
 * Instead of embedding placeholders, these functions use template literals and accept
 * the necessary parameters directly.
 *
 * The extraInfoFieldKey and extraInfoFieldKey2 properties specify which callingStation
 * attributes are compared against the user's input during the TU step.
 */

export const modeLogicConfig = {
  single: {
    cqMessage: (yourStation, theirStation, arbitrary) =>
      `CQ DE ${yourStation.callsign} K`,
    yourExchange: (yourStation, theirStation, arbitrary) => `5NN`,
    theirExchange: (yourStation, theirStation, arbitrary) => `R 5NN TU`,
    yourSignoff: (yourStation, theirStation, arbitrary) => `TU EE`,
    theirSignoff: (yourStation, theirStation, arbitrary) => `EE`,
    requiresInfoField: false,
    requiresInfoField2: false,
    showTuStep: false,
    modeName: 'Single',
    extraInfoFieldKey: null,
    extraInfoFieldKey2: null,
  },
  pota: {
    cqMessage: (yourStation, theirStation, arbitrary) =>
      `CQ POTA DE ${yourStation.callsign}`,
    yourExchange: (yourStation, theirStation, arbitrary) => `UR 5NN <BK>`,
    theirExchange: (yourStation, theirStation, arbitrary) =>
      `<BK> UR 5NN ${theirStation.state} ${theirStation.state} <BK>`,
    yourSignoff: (yourStation, theirStation, arbitrary) =>
      `<BK> TU ${arbitrary} 73 EE`,
    theirSignoff: (yourStation, theirStation, arbitrary) => `EE`,
    requiresInfoField: true,
    requiresInfoField2: false,
    showTuStep: true,
    modeName: 'POTA',
    extraInfoFieldKey: 'state',
    extraInfoFieldKey2: null,
  },
  contest: {
    cqMessage: (yourStation, theirStation, arbitrary) =>
      `W`,
    yourExchange: (yourStation, theirStation, arbitrary) => `5NN`,
    theirExchange: (yourStation, theirStation, arbitrary) => `EE`,
    yourSignoff: (yourStation, theirStation, arbitrary) => ``,
    theirSignoff: null,
    requiresInfoField: false,
    requiresInfoField2: false,
    showTuStep: false,
    modeName: 'Contest',
    extraInfoFieldKey: null,
    extraInfoFieldKey2: null,
  },
  sst: {
    cqMessage: (yourStation, theirStation, arbitrary) =>
      `CQ SST ${yourStation.callsign}`,
    yourExchange: (yourStation, theirStation, arbitrary) =>
      `${yourStation.name} ${yourStation.state}`,
    theirExchange: (yourStation, theirStation, arbitrary) =>
      `TU ${yourStation.name} ${theirStation.name} ${theirStation.state}`,
    yourSignoff: (yourStation, theirStation, arbitrary) =>
      `GL ${arbitrary} TU ${yourStation.callsign} SST`,
    theirSignoff: null,
    requiresInfoField: true,
    requiresInfoField2: true,
    showTuStep: true,
    modeName: 'SST',
    extraInfoFieldKey: 'name',
    extraInfoFieldKey2: 'state',
  },
  cwt: {
    cqMessage: (yourStation, theirStation, arbitrary) =>
      `CQ CWT ${yourStation.callsign}`,
    yourExchange: (yourStation, theirStation, arbitrary) =>
      `${yourStation.name} CWA`,
    theirExchange: (yourStation, theirStation, arbitrary) =>
      `${theirStation.name} ${theirStation.cwopsNumber} TU`,
    yourSignoff: (yourStation, theirStation, arbitrary) =>
      `TU ${yourStation.callsign}`,
    theirSignoff: null,
    requiresInfoField: true,
    requiresInfoField2: true,
    showTuStep: true,
    modeName: 'CWT',
    extraInfoFieldKey: 'name',
    extraInfoFieldKey2: 'cwopsNumber',
  },
  troubledLetters: {
    cqMessage: (yourStation, theirStation, arbitrary) => ``,
    yourExchange: (yourStation, theirStation, arbitrary) => ``,
    theirExchange: (yourStation, theirStation, arbitrary) => `R`,
    yourSignoff: (yourStation, theirStation, arbitrary) => ``,
    theirSignoff: null,
    requiresInfoField: false,
    requiresInfoField2: false,
    showTuStep: false,
    modeName: 'Troubled Letters',
    extraInfoFieldKey: null,
    extraInfoFieldKey2: null,
  },
};
