# companion-module-nexo-nxamp

See [HELP.md](./companion/HELP.md) and [LICENSE](./LICENSE)

## Version History

### Version 3.0.0

- Update to Companion module API 2.2, which needs Companion 5.1 or later
- Convert to TypeScript
- The port is now a number field
- On, off and the channel can be set by expression
- Messages still queued when an action is aborted are not sent
- Button presses are sent ahead of the queries on connecting
- Reconnect when an amplifier that answers the keepalive stops responding
- The keepalive is sent every 30 seconds, rather than after 30 seconds without sending
- The state is read once on connecting, rather than again each time an action or feedback is added
- Feedbacks are rechecked only when the amplifier reports a change
- Errors from the amplifier are logged as warnings
- Fix the message queue running on after the module is disabled, and once more for each reconnection

### Version 2.1.2

- Use Node 22

### Version 2.1.0

- Add feedbacks
- Update dependencies

### Version 2.0.0

- Update for Companion 3
- Add Keep Alive message

### Version 1.0.0

- First Release
