#!/usr/bin/env node

const fs = require('fs');

function pulses(encoded) {
  const packet = Buffer.from(encoded, 'base64');
  const end = Math.min(packet.length, 4 + packet.readUInt16LE(2));
  const result = [];
  for (let i = 4; i < end;) {
    let ticks = packet[i++];
    if (ticks === 0) {
      ticks = packet.readUInt16BE(i);
      i += 2;
    }
    if (ticks === 0x0d05) break;
    result.push(ticks * 32.84);
  }
  return result;
}

function frames(encoded) {
  const raw = pulses(encoded);
  const result = [];
  for (let i = 0; i + 129 < raw.length; i++) {
    if (raw[i] < 6500 || raw[i + 1] < 3000) continue;
    const bytes = Buffer.alloc(8);
    let valid = true;
    for (let bit = 0, p = i + 2; bit < 64; bit++, p += 2) {
      if (raw[p] == null || raw[p + 1] == null || Math.max(raw[p], raw[p + 1]) < 1000) {
        valid = false;
        break;
      }
      if (raw[p] > raw[p + 1]) bytes[bit >> 3] |= 1 << (bit & 7);
    }
    if (valid) result.push(bytes);
  }
  return result;
}

function poweredChecksum(bytes) {
  const sum = bytes.subarray(0, 7).reduce((a, b) => a + b, 0);
  const temperature = bytes[2] >> 1;
  const fan = bytes[1] >> 4;
  const swing = (bytes[6] & 0xc0) !== 0;
  return (sum - 15 * (3 + Math.floor(temperature / 8)) - fan * 15 - (swing ? 0xb4 : 0)) & 0xff;
}

function describe(bytes) {
  const modes = { 1: 'cool', 2: 'heat', 3: 'fan/circulate', 4: 'dry' };
  const fans = { 1: 'low', 2: 'medium', 3: 'high', 4: 'auto' };
  return {
    hex: [...bytes].map(x => x.toString(16).padStart(2, '0')).join(' '),
    mode: modes[bytes[1] & 0x0f] || `unknown(${bytes[1] & 0x0f})`,
    fan: fans[bytes[1] >> 4] || `unknown(${bytes[1] >> 4})`,
    temperature: bytes[2] / 2,
    powerByte: `0x${bytes[5].toString(16).padStart(2, '0')}`,
    swing: (bytes[6] & 0xc0) !== 0,
    checksumStored: `0x${bytes[7].toString(16).padStart(2, '0')}`,
    checksumCalculated: `0x${poweredChecksum(bytes).toString(16).padStart(2, '0')}`,
    checksumMatches: bytes[7] === poweredChecksum(bytes),
  };
}

const capturePath = process.argv[2] || 'captured_ac_codes.json';
const captures = JSON.parse(fs.readFileSync(capturePath, 'utf8'));
const output = {};
for (const [name, code] of Object.entries(captures)) {
  const decoded = frames(code);
  output[name] = {
    frameCount: decoded.length,
    repeatsMatch: decoded.length > 1 ? decoded[0].equals(decoded[1]) : null,
    ...describe(decoded[0]),
  };
  console.log(`${name.padEnd(5)} ${output[name].hex} mode=${output[name].mode} fan=${output[name].fan} temp=${output[name].temperature} power=${output[name].powerByte} checksum=${output[name].checksumMatches ? 'ok' : 'different'}`);
}
fs.writeFileSync('tadiran_capture_comparison.json', `${JSON.stringify(output, null, 2)}\n`);
