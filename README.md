# Tadiran Dynamic IR for Home Assistant

<p align="center">
  <img src="tadiran_icon.webp" alt="Tadiran Dynamic IR icon" width="160">
</p>

[![GitHub release](https://img.shields.io/github/v/release/guylast/tadiran-dynamic-ir)](https://github.com/guylast/tadiran-dynamic-ir/releases)
[![Validate](https://github.com/guylast/tadiran-dynamic-ir/actions/workflows/validate.yml/badge.svg)](https://github.com/guylast/tadiran-dynamic-ir/actions/workflows/validate.yml)

A custom Home Assistant climate integration for Tadiran air conditioners using
the TAC-297H V3.2/V3.3 infrared protocol and a Broadlink remote.

The integration generates complete AC state packets dynamically instead of
storing a separate Base64 command for every combination.

## Supported controls

Validated against SmartIR profile 1346 and captured TAC-297H commands:

- Power on and state-preserving power off
- Heat and cool
- 16-32 C target temperature
- Auto, low, medium, and high fan speed

Experimental, based on the published IRTadiran field mapping:

- Dry mode
- Fan-only mode
- Swing on/off

Experimental controls are marked with `*` on the bundled remote-style card.

## Manual installation

1. Copy `custom_components/tadiran_dynamic` into the Home Assistant
   `/config/custom_components/` directory.
2. Restart Home Assistant.
3. Open **Settings > Devices & services > Add integration**.
4. Search for **Tadiran Dynamic IR**.
5. Select the Broadlink remote facing the air conditioner.

## Dashboard card

The integration bundles and serves the custom card. Add a JavaScript module
resource to the dashboard:

```text
/tadiran_dynamic/tadiran-remote-card.js?v=0.2.1
```

Then add:

```yaml
type: custom:tadiran-remote-card
entity: climate.tadiran_ac
```

Use the actual entity ID if Home Assistant assigns a suffix.

## Install as a HACS custom repository

Repository URL:

```text
https://github.com/guylast/tadiran-dynamic-ir
```

To install it as a HACS custom repository:

1. Open HACS.
2. Open the top-right menu and select **Custom repositories**.
3. Enter the GitHub repository URL.
4. Select category **Integration**.
5. Add and download **Tadiran Dynamic IR**.
6. Restart Home Assistant.
7. Add the integration under **Settings > Devices & services**.
8. Register the dashboard resource shown above.

## Protocol research

The `research` directory contains profile 1346, controlled historical captures,
the decoder, comparison results, protocol notes, and standalone generators.

## Important limitation

The climate entity is optimistic. Broadlink transmits IR but does not receive
the state of the AC. Changes made with the physical remote are therefore not
automatically reflected in Home Assistant.
