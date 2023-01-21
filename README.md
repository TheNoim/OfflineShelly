# Offline fallback shelly zigbee2mqtt control

This project aims to provide an offline fallback option for controlling a Zigbee2MQTT lamp using a shelly. In the event that Zigbee2MQTT or the network goes offline, the Shelly switch will automatically trigger its relay to toggle the light. When the network is online, the switch will use Zigbee2MQTT to directly control the light, preserving the smooth fade effect of compatible lamps.

