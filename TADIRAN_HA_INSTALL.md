# Tadiran Dynamic IR installation

This package contains:

- `custom_components/tadiran_dynamic`: a config-flow climate integration that
  generates TAC-297H Broadlink codes dynamically.
- `custom_components/tadiran_dynamic/frontend/tadiran-remote-card.js`: a
  remote-shaped Lovelace card served by the integration.

## Install the integration

Copy `custom_components/tadiran_dynamic` into the Home Assistant configuration
directory so the final path is:

```text
/config/custom_components/tadiran_dynamic/
```

Restart Home Assistant. Then open **Settings > Devices & services > Add
integration**, search for **Tadiran Dynamic IR**, and select the Broadlink
remote that faces the air conditioner.

The integration creates a climate entity, normally `climate.tadiran_ac`.

## Register the remote card

The integration serves its bundled card automatically. Add this dashboard
resource:

```text
URL: /tadiran_dynamic/tadiran-remote-card.js?v=0.2.0
Type: JavaScript module
```

Refresh the browser, then add this card to a dashboard:

```yaml
type: custom:tadiran-remote-card
entity: climate.tadiran_ac
```

## Supported controls

- Power on/off with state-preserving OFF packets
- Heat and cool modes
- Target temperature from 16 through 32 C
- Auto, low, medium, and high fan speeds
- Experimental dry and fan-only modes
- Experimental swing on/off

State is optimistic because Broadlink transmits IR but does not receive AC
state. Changes made with the physical remote are not reflected automatically.

Dry, fan-only, and swing use fields published by IRTadiran but are not yet
verified against controlled TAC-297H V3.3 captures. They are marked with `*` in
the custom card.
