#!/usr/bin/env node

const fs = require('fs');

const profilePath = process.argv[2] || '1346.json';
const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));

function broadlinkPulses(encoded) {
  const packet = Buffer.from(encoded, 'base64');
  if (packet[0] !== 0x26) throw new Error(`Expected IR packet 0x26, got 0x${packet[0].toString(16)}`);
  const payloadLength = packet.readUInt16LE(2);
  const end = Math.min(packet.length, 4 + payloadLength);
  const pulses = [];
  for (let i = 4; i < end;) {
    let ticks = packet[i++];
    if (ticks === 0) {
      if (i + 1 >= end) break;
      ticks = packet.readUInt16BE(i);
      i += 2;
    }
    // 0x0d05 is the conventional Broadlink end marker.
    if (ticks === 0x0d05) break;
    pulses.push(ticks * 32.84);
  }
  return pulses;
}

function decodeFrames(encoded) {
  const pulses = broadlinkPulses(encoded);
  const frames = [];
  for (let i = 0; i + 129 < pulses.length; i++) {
    if (pulses[i] < 6500 || pulses[i + 1] < 3000) continue;
    const bytes = Buffer.alloc(8);
    let p = i + 2;
    let valid = true;
    for (let bit = 0; bit < 64; bit++, p += 2) {
      const a = pulses[p];
      const b = pulses[p + 1];
      if (a == null || b == null || Math.max(a, b) < 1000 || Math.min(a, b) > 1000) {
        valid = false;
        break;
      }
      if (a > b) bytes[Math.floor(bit / 8)] |= 1 << (bit % 8);
    }
    if (valid) frames.push(bytes);
  }
  return frames;
}

function checksum(bytes) {
  const sum = bytes.subarray(0, 7).reduce((a, b) => a + b, 0);
  const temp = Math.floor(bytes[2] / 2);
  const fan = (bytes[1] & 0xf0) >> 4;
  const swing = (bytes[6] & 0xc0) !== 0;
  return (sum - (0x0f * (3 + Math.floor(temp / 8)) + fan * 0x0f + (swing ? 0xb4 : 0))) & 0xff;
}

function commands() {
  const result = [{ label: 'off', mode: 'off', fan: null, temp: null, code: profile.commands.off }];
  for (const mode of profile.operationModes) {
    for (const fan of profile.fanModes) {
      for (let temp = profile.minTemperature; temp <= profile.maxTemperature; temp++) {
        result.push({ label: `${mode}/${fan}/${temp}`, mode, fan, temp, code: profile.commands[mode][fan][temp] });
      }
    }
  }
  return result;
}

const rows = [];
let repeatMismatches = 0;
let checksumMismatches = 0;
for (const command of commands()) {
  const frames = decodeFrames(command.code);
  if (!frames.length) throw new Error(`No frame decoded for ${command.label}`);
  if (frames.length > 1 && !frames[0].equals(frames[1])) repeatMismatches++;
  const bytes = frames[0];
  if (checksum(bytes) !== bytes[7]) checksumMismatches++;
  rows.push({ ...command, frames: frames.length, bytes });
}

const uniqueBy = (selector) => [...new Set(rows.map(selector))].sort();
const hex = (b) => [...b].map(x => x.toString(16).padStart(2, '0')).join(' ');

console.log(`Profile: ${profile.manufacturer} ${profile.supportedModels.join(', ')}`);
console.log(`Commands decoded: ${rows.length}`);
console.log(`Repeated-frame mismatches: ${repeatMismatches}`);
console.log(`IRTadiran checksum mismatches: ${checksumMismatches}`);
console.log(`Byte 0 values: ${uniqueBy(r => r.bytes[0].toString(16))}`);
console.log(`Byte 3 values: ${uniqueBy(r => r.bytes[3].toString(16))}`);
console.log(`Byte 4 values: ${uniqueBy(r => r.bytes[4].toString(16))}`);
console.log(`Byte 5 values: ${uniqueBy(r => r.bytes[5].toString(16))}`);
console.log(`Byte 6 values: ${uniqueBy(r => r.bytes[6].toString(16))}`);
console.log('');
for (const label of ['off', 'cool/auto/16', 'cool/low/24', 'cool/high/32', 'heat/auto/16', 'heat/medium/24', 'heat/high/32']) {
  const row = rows.find(r => r.label === label);
  console.log(`${label.padEnd(16)} ${hex(row.bytes)} checksum=${checksum(row.bytes).toString(16).padStart(2, '0')}`);
}

const output = {
  profile: profile.supportedModels[0],
  commandsDecoded: rows.length,
  repeatMismatches,
  checksumMismatches,
  mappings: Object.fromEntries(rows.map(r => [r.label, hex(r.bytes)])),
};
fs.writeFileSync('tadiran_decode_report.json', `${JSON.stringify(output, null, 2)}\n`);
