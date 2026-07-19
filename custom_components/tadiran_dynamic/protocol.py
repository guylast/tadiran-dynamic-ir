"""TAC-297H state encoder and Broadlink packet generator."""

from __future__ import annotations

import base64

MODE_CODES = {
    "cool": 1,
    "heat": 2,
    # Published by IRTadiran but not yet verified against TAC-297H V3.3
    # captures. These are deliberately exposed as experimental modes.
    "fan_only": 3,
    "dry": 4,
}
FAN_CODES = {"auto": 4, "low": 1, "medium": 2, "high": 3}


def _checksum(frame: bytearray) -> int:
    """Calculate the powered-state checksum decoded from profile 1346."""
    temperature = frame[2] // 2
    fan = frame[1] >> 4
    swing = bool(frame[6] & 0xC0)
    adjustment = 15 * (3 + temperature // 8) + fan * 15
    if swing:
        adjustment += 0xB4
    return (sum(frame[:7]) - adjustment) & 0xFF


def state_frame(
    mode: str,
    fan_mode: str,
    temperature: int,
    *,
    power: bool = True,
    swing: bool = False,
) -> bytes:
    """Build the eight-byte TAC-297H state frame."""
    if mode not in MODE_CODES:
        raise ValueError(f"Unsupported mode: {mode}")
    if fan_mode not in FAN_CODES:
        raise ValueError(f"Unsupported fan mode: {fan_mode}")
    if not 16 <= temperature <= 32:
        raise ValueError("Temperature must be from 16 through 32")

    frame = bytearray(
        [
            0x01,
            (FAN_CODES[fan_mode] << 4) | MODE_CODES[mode],
            temperature * 2,
            0x00,
            0x00,
            0x30,
            0xC0 if swing else 0x00,
            0x00,
        ]
    )
    frame[7] = _checksum(frame)
    if not power:
        # Verified against the user's state-preserving OFF capture and the
        # fixed OFF state in SmartIR profile 1346.
        frame[5] = 0xC0
        frame[7] = (frame[7] + 9) & 0xFF
    return bytes(frame)


def _encode_pulse(microseconds: int) -> bytes:
    ticks = max(1, round(microseconds / 32.84))
    if ticks < 256:
        return bytes([ticks])
    return bytes([0, (ticks >> 8) & 0xFF, ticks & 0xFF])


def broadlink_packet(frame: bytes) -> bytes:
    """Wrap a TAC-297H frame in a Broadlink 0x26 IR packet."""
    pulses: list[int] = []
    for repeat in range(2):
        # Median timings measured across all 137 working profile-1346 codes.
        # They intentionally differ from the generic IRTadiran Arduino values.
        pulses.extend((8571, 4532))
        for byte in frame:
            for bit in range(8):
                if byte & (1 << bit):
                    pulses.extend((1806, 755))
                else:
                    pulses.extend((755, 1806))
        if repeat == 0:
            pulses.extend((1970, 22068))
    # Working captures terminate with a single mark before Broadlink's end
    # marker. The previous encoder emitted an additional, invalid space.
    pulses.append(1970)

    payload = b"".join(_encode_pulse(pulse) for pulse in pulses)
    payload += b"\x00\x0d\x05"
    return b"\x26\x00" + len(payload).to_bytes(2, "little") + payload


def broadlink_base64(
    mode: str,
    fan_mode: str,
    temperature: int,
    *,
    power: bool = True,
    swing: bool = False,
) -> str:
    """Return a Home Assistant-ready b64: Broadlink command."""
    frame = state_frame(
        mode, fan_mode, temperature, power=power, swing=swing
    )
    return "b64:" + base64.b64encode(broadlink_packet(frame)).decode("ascii")
