#!/usr/bin/env node

// Generate a Broadlink Base64 command for the Tadiran TAC-297H state protocol.
// Validated against all 136 powered commands in SmartIR profile 1346.

const modeMap = { cool: 1, heat: 2, fan_only: 3, dry: 4 };
const fanMap = { auto: 4, low: 1, medium: 2, high: 3 };

function checksum(bytes) {
  const sum = bytes.subarray(0, 7).reduce((a, b) => a + b, 0);
  const temp = Math.floor(bytes[2] / 2);
  const fan = (bytes[1] & 0xf0) >> 4;
  const swing = (bytes[6] & 0xc0) !== 0;
  return (sum - (15 * (3 + Math.floor(temp / 8)) + fan * 15 + (swing ? 0xb4 : 0))) & 0xff;
}

function stateBytes(mode, fan, temperature, swing = false) {
  if (!(mode in modeMap)) throw new Error(`Mode must be one of: ${Object.keys(modeMap).join(', ')}`);
  if (!(fan in fanMap)) throw new Error(`Fan must be one of: ${Object.keys(fanMap).join(', ')}`);
  if (!Number.isInteger(temperature) || temperature < 16 || temperature > 32) {
    throw new Error('Temperature must be an integer from 16 through 32');
  }
  const bytes = Buffer.from([
    0x01,
    (fanMap[fan] << 4) | modeMap[mode],
    temperature * 2,
    0x00,
    0x00,
    0x30,
    swing ? 0xc0 : 0x00,
    0x00,
  ]);
  bytes[7] = checksum(bytes);
  return bytes;
}

function offStateBytes(mode, fan, temperature, swing = false) {
  const bytes = stateBytes(mode, fan, temperature, swing);
  const onChecksum = bytes[7];
  bytes[5] = 0xc0;
  // Confirmed by both the user's state-preserving OFF capture and profile
  // 1346's fixed OFF snapshot: OFF checksum = equivalent ON checksum + 9.
  bytes[7] = (onChecksum + 9) & 0xff;
  return bytes;
}

function encodePulse(microseconds) {
  const ticks = Math.max(1, Math.round(microseconds / 32.84));
  return ticks < 256
    ? Buffer.from([ticks])
    : Buffer.from([0, (ticks >> 8) & 0xff, ticks & 0xff]);
}

function broadlinkCode(bytes) {
  const pulses = [];
  for (let repeat = 0; repeat < 2; repeat++) {
    pulses.push(8000, 4000);
    for (const byte of bytes) {
      for (let bit = 0; bit < 8; bit++) {
        const one = (byte & (1 << bit)) !== 0;
        pulses.push(one ? 1618 : 545, one ? 545 : 1618);
      }
    }
    if (repeat === 0) pulses.push(1618, 31000);
  }
  pulses.push(1618, 1618);

  const pulseData = Buffer.concat(pulses.map(encodePulse));
  const terminator = Buffer.from([0x00, 0x0d, 0x05]);
  const payload = Buffer.concat([pulseData, terminator]);
  const header = Buffer.alloc(4);
  header[0] = 0x26;
  header[1] = 0x00;
  header.writeUInt16LE(payload.length, 2);
  return Buffer.concat([header, payload]).toString('base64');
}

if (require.main === module) {
  const args = process.argv.slice(2);
  try {
    const isOff = args[0] === 'off';
    const [mode, fan, tempText, swingText = 'false'] = isOff ? args.slice(1) : args;
    const bytes = isOff
      ? offStateBytes(mode, fan, Number(tempText), swingText === 'true')
      : stateBytes(mode, fan, Number(tempText), swingText === 'true');
    console.log(`state=${bytes.toString('hex').match(/../g).join(' ')}`);
    console.log(`b64:${broadlinkCode(bytes)}`);
  } catch (error) {
    console.error(`Usage: node tadiran_generate.js <cool|heat|fan_only|dry> <auto|low|medium|high> <16-32> [true|false]`);
    console.error(`   or: node tadiran_generate.js off <cool|heat|fan_only|dry> <auto|low|medium|high> <16-32> [true|false]`);
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { stateBytes, offStateBytes, broadlinkCode, checksum };
