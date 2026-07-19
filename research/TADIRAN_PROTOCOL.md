# Tadiran TAC-297H V3.2 protocol analysis

This analysis uses SmartIR profile `1346.json` and assumes the published
IRTadiran protocol applies to the TAC-297H V3.2/V3.3 remotes.

## Validation result

- 137 commands decoded: one OFF command and 136 powered states.
- Each powered command contains two identical 64-bit frames.
- All 136 powered states satisfy the published IRTadiran checksum formula.
- The OFF command is a model-specific frame and does not use that powered-state
  checksum formula.

## Frame encoding

- Carrier: 38 kHz (from the published IRTadiran implementation).
- Header: approximately 8 ms mark, 4 ms space.
- Eight data bytes, transmitted least-significant bit first.
- Logical 1: approximately 1618 us mark, 545 us space.
- Logical 0: approximately 545 us mark, 1618 us space.
- Two copies of the 8-byte frame are transmitted.

## Powered-state byte layout

| Byte | Meaning |
|---:|---|
| 0 | Constant `0x01` |
| 1 | High nibble = fan; low nibble = mode |
| 2 | Target temperature multiplied by two |
| 3 | Constant `0x00` in profile 1346 |
| 4 | Constant `0x00` in profile 1346 |
| 5 | Power on: `0x30` |
| 6 | Swing off: `0x00`; published implementation proposes `0xC0` for swing on |
| 7 | Checksum |

Mode values:

- `1`: cool
- `2`: heat
- Published but not validated by profile 1346: `3` circulate/fan, `4` dry

Fan high-nibble values:

- `4`: auto
- `1`: low
- `2`: medium
- `3`: high

Examples:

```text
cool, auto, 16 C   01 41 20 00 00 30 00 0b
cool, low, 24 C    01 11 30 00 00 30 00 09
heat, medium, 24 C 01 22 30 00 00 30 00 0b
heat, high, 32 C   01 32 40 00 00 30 00 0d
```

Profile 1346 OFF frame:

```text
01 13 2c 00 00 c0 00 1f
```

The user's prior captures prove that the original remote can preserve its last
state in an OFF frame. For example, heat, low, 21 C was captured as:

```text
ON   01 12 2a 00 00 30 00 13
OFF  01 12 2a 00 00 c0 00 1c
```

For OFF, byte 5 changes from `0x30` to `0xC0`, and the checksum is the
equivalent powered-state checksum plus 9 (modulo 256). This rule also produces
profile 1346's fixed OFF checksum.

## Checksum

For powered states, with arithmetic reduced modulo 256:

```text
checksum = sum(bytes 0..6)
           - 15 * (3 + floor(temperature / 8))
           - 15 * fan_nibble
           - (swing_enabled ? 0xb4 : 0)
```

## Generator

Generate a normalized Broadlink code:

```bash
node tadiran_generate.js cool medium 24
node tadiran_generate.js heat high 27
node tadiran_generate.js off heat low 21
```

Swing generation is experimental because profile 1346 contains no swing-on
captures:

```bash
node tadiran_generate.js cool auto 24 true
```

Do not rely on generated dry, fan-only, swing, timer, sleep, or turbo states
until they have been compared with controlled captures from the original
TAC-297H V3.3 remote.
