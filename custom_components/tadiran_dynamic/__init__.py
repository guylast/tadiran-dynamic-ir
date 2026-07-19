"""Tadiran Dynamic IR integration."""

from __future__ import annotations

from pathlib import Path

from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant

PLATFORMS = [Platform.CLIMATE]
CARD_URL = "/tadiran_dynamic/tadiran-remote-card.js"
ICON_URL = "/tadiran_dynamic/tadiran-icon.webp"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Serve the bundled remote card and its icon."""
    frontend_path = Path(__file__).parent / "frontend"
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                CARD_URL, str(frontend_path / "tadiran-remote-card.js"), True
            ),
            StaticPathConfig(
                ICON_URL, str(frontend_path / "tadiran-icon.webp"), True
            ),
        ]
    )
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Tadiran Dynamic IR from a config entry."""
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
