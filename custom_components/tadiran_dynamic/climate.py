"""Climate entity for a dynamically encoded Tadiran TAC-297H."""

from __future__ import annotations

from typing import Any

from homeassistant.components.climate import ClimateEntity
from homeassistant.components.climate.const import ClimateEntityFeature, HVACMode
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import ATTR_TEMPERATURE, UnitOfTemperature
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback
from homeassistant.helpers.restore_state import RestoreEntity

from .const import (
    CONF_REMOTE_ENTITY,
    DEFAULT_FAN_MODE,
    DEFAULT_NAME,
    DEFAULT_TEMPERATURE,
    FAN_MODES,
    MAX_TEMPERATURE,
    MIN_TEMPERATURE,
)
from .protocol import broadlink_base64


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up the climate entity."""
    async_add_entities(
        [TadiranClimate(entry.entry_id, entry.data[CONF_REMOTE_ENTITY])]
    )


class TadiranClimate(ClimateEntity, RestoreEntity):
    """Optimistic TAC-297H climate entity backed by a Broadlink remote."""

    _attr_has_entity_name = True
    _attr_name = None
    _attr_temperature_unit = UnitOfTemperature.CELSIUS
    _attr_min_temp = MIN_TEMPERATURE
    _attr_max_temp = MAX_TEMPERATURE
    _attr_target_temperature_step = 1
    _attr_hvac_modes = [
        HVACMode.OFF,
        HVACMode.COOL,
        HVACMode.HEAT,
        HVACMode.DRY,
        HVACMode.FAN_ONLY,
    ]
    _attr_fan_modes = FAN_MODES
    _attr_swing_modes = ["off", "on"]
    _attr_supported_features = (
        ClimateEntityFeature.TARGET_TEMPERATURE
        | ClimateEntityFeature.FAN_MODE
        | ClimateEntityFeature.SWING_MODE
        | ClimateEntityFeature.TURN_ON
        | ClimateEntityFeature.TURN_OFF
    )
    _attr_assumed_state = True

    def __init__(self, entry_id: str, remote_entity: str) -> None:
        self._attr_unique_id = entry_id
        self._attr_device_info = {
            "identifiers": {("tadiran_dynamic", entry_id)},
            "name": DEFAULT_NAME,
            "manufacturer": "Tadiran",
            "model": "TAC-297H V3.2/V3.3",
        }
        self._remote_entity = remote_entity
        self._attr_hvac_mode = HVACMode.OFF
        self._last_active_mode = HVACMode.COOL
        self._attr_target_temperature = DEFAULT_TEMPERATURE
        self._attr_fan_mode = DEFAULT_FAN_MODE
        self._attr_swing_mode = "off"

    async def async_added_to_hass(self) -> None:
        """Restore the optimistic state after a restart."""
        await super().async_added_to_hass()
        previous = await self.async_get_last_state()
        if previous is None:
            return
        if previous.state in (
            HVACMode.COOL,
            HVACMode.HEAT,
            HVACMode.DRY,
            HVACMode.FAN_ONLY,
            HVACMode.OFF,
        ):
            self._attr_hvac_mode = HVACMode(previous.state)
            if self._attr_hvac_mode != HVACMode.OFF:
                self._last_active_mode = self._attr_hvac_mode
        temperature = previous.attributes.get(ATTR_TEMPERATURE)
        if temperature is not None:
            self._attr_target_temperature = int(temperature)
        fan_mode = previous.attributes.get("fan_mode")
        if fan_mode in FAN_MODES:
            self._attr_fan_mode = fan_mode
        swing_mode = previous.attributes.get("swing_mode")
        if swing_mode in self._attr_swing_modes:
            self._attr_swing_mode = swing_mode

    async def _async_transmit(self, *, power: bool = True) -> None:
        mode = self._last_active_mode if self._attr_hvac_mode == HVACMode.OFF else self._attr_hvac_mode
        command = broadlink_base64(
            mode.value,
            self._attr_fan_mode,
            int(self._attr_target_temperature),
            power=power,
            swing=self._attr_swing_mode == "on",
        )
        await self.hass.services.async_call(
            "remote",
            "send_command",
            {
                "command": command,
                "num_repeats": 1,
                "delay_secs": 0.4,
            },
            blocking=True,
            target={"entity_id": self._remote_entity},
        )

    async def async_set_hvac_mode(self, hvac_mode: HVACMode) -> None:
        if hvac_mode == HVACMode.OFF:
            await self.async_turn_off()
            return
        self._attr_hvac_mode = hvac_mode
        self._last_active_mode = hvac_mode
        await self._async_transmit()
        self.async_write_ha_state()

    async def async_set_temperature(self, **kwargs: Any) -> None:
        temperature = kwargs.get(ATTR_TEMPERATURE)
        if temperature is None:
            return
        self._attr_target_temperature = max(
            MIN_TEMPERATURE, min(MAX_TEMPERATURE, round(float(temperature)))
        )
        if self._attr_hvac_mode != HVACMode.OFF:
            await self._async_transmit()
        self.async_write_ha_state()

    async def async_set_fan_mode(self, fan_mode: str) -> None:
        if fan_mode not in FAN_MODES:
            return
        self._attr_fan_mode = fan_mode
        if self._attr_hvac_mode != HVACMode.OFF:
            await self._async_transmit()
        self.async_write_ha_state()

    async def async_set_swing_mode(self, swing_mode: str) -> None:
        if swing_mode not in self._attr_swing_modes:
            return
        self._attr_swing_mode = swing_mode
        if self._attr_hvac_mode != HVACMode.OFF:
            await self._async_transmit()
        self.async_write_ha_state()

    @property
    def extra_state_attributes(self) -> dict[str, str]:
        """Expose protocol-validation status for experimental controls."""
        return {
            "protocol_profile": "TAC-297H V3.2/V3.3",
            "validated_controls": "power,heat,cool,temperature,fan",
            "experimental_controls": "dry,fan_only,swing",
        }

    async def async_turn_on(self) -> None:
        self._attr_hvac_mode = self._last_active_mode
        await self._async_transmit()
        self.async_write_ha_state()

    async def async_turn_off(self) -> None:
        if self._attr_hvac_mode != HVACMode.OFF:
            self._last_active_mode = self._attr_hvac_mode
        await self._async_transmit(power=False)
        self._attr_hvac_mode = HVACMode.OFF
        self.async_write_ha_state()
