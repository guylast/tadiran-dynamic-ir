"""Config flow for Tadiran Dynamic IR."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.config_entries import ConfigFlowResult
from homeassistant.helpers import selector

from .const import CONF_REMOTE_ENTITY, DOMAIN


class TadiranDynamicConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Configure a Tadiran TAC-297H climate controller."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Handle the initial configuration step."""
        if user_input is not None:
            remote_entity = user_input[CONF_REMOTE_ENTITY]
            await self.async_set_unique_id(remote_entity)
            self._abort_if_unique_id_configured()
            return self.async_create_entry(
                title="Tadiran AC", data={CONF_REMOTE_ENTITY: remote_entity}
            )

        schema = vol.Schema(
            {
                vol.Required(CONF_REMOTE_ENTITY): selector.EntitySelector(
                    selector.EntitySelectorConfig(domain="remote")
                )
            }
        )
        return self.async_show_form(step_id="user", data_schema=schema)
