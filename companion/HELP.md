# Module for NEXO NXAMP Power Amplifiers

This module supports NEXO NXAMP Power Amplifiers. Please submit a feature request on [Github](https://github.com/bitfocus/companion-module-nexo-nxamp/issues) if you require additional commands.

Requires Companion 5.1 or later.

## Configuration

Enter the amplifier's IP address, and the control port if it is not the default of 49280.

The module sends a keepalive every 30 seconds.

## Actions

- **Power Control** On / Off
- **Overmute** On / Off
- **Channel Mute** On / Off, for channel 1 to 4

## Feedbacks

- **Power** True while the amplifier is on
- **Overmute** True while overmute is on
- **Channel Mute** True while the channel is muted
