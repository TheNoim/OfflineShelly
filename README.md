# ESPHome: Offline fallback mechanism to control Zigbee device via shelly

In this project, I provide an [ESPHome](https://esphome.io/)-based configuration to control a Zigbee device via a Shelly or similar device, while ensuring it remains operational offline.

## What you need

1. An ESPHome compatible device which has a switch and a relay
2. Zigbee Device connected via [ZHA](https://www.home-assistant.io/integrations/zha/) in [Home Assistant](https://www.home-assistant.io/)
3. Knowledge how to flash ESPHome
4. The Zigbee device needs to turn on after power loss. Most lamps have this as their default configuration

## How this works

I created a flow diagram to design the fallback process:

![Flow Diagram](assets/Flow%20Diagram.webp)

To explain it, when one of the following cases is true:

- ESPHome device is no longer connected to Home Assistant
- ZHA marked the Zigbee device as "unavailable"
- Toggling the Zigbee device fails after 2s

Then, we use the relay on the Shelly instead to control the device. If the device's last known state was on, we simply turn off the relay. If the last known state was off, we toggle the relay off and then back on. This approach ensures the device is in the expected state, even if Zigbee or WiFi stops working.

## How to use

```yaml your-esphome-config.yaml
# {... Your esphome configuration}

packages:
    # Optional: Predefined base for a Shelly 1L only
    Shelly1L:
        url: https://github.com/TheNoim/OfflineShelly
        files: [shelly-1l.yaml]
        ref: "1.0" # Release tag you want to use
        refresh: 1d
    # Offline mechanism
    OfflineShelly:
        url: https://github.com/TheNoim/OfflineShelly
        files: [offline-shelly.yaml]
        ref: "1.0" # Release tag you want to use
        refresh: 1d
        # You can also use it for multiple devices: https://esphome.io/components/packages#packages-as-templates
        # If you use multiple devices: The prefix needs to be different for each device. The relay can be the same
        vars:
            prefix: deckenlampe # Even if you don't want to control multiple device, you need to specify a prefix. It needs to follow the rules for an ESPHome id https://esphome.io/guides/configuration-types.html#config-id 
            zigbee_entity: light.arbeitszimmer_deckenlampe_light # Zigbee entity id in hass
            relay_id: deviceid # ESPHome relay id. Needs to be a switch

binary_sensor:
  - id: !extend switchid1 # ID from switch1
    on_state:
      then:
        # Script name format: ${prefix}_toggle
        script.execute: deckenlampe_toggle
        # For multiple devices: just use a list and run script for each prefix
```