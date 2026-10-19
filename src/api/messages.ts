import { CHANNEL_COUNT, Parameter } from './consts.js'

/** Asks for the run mode. The amplifier answers `OK devstatus runmode "…"` */
export const KEEPALIVE = 'devstatus runmode'

/** True for a whole number from 1 to {@link CHANNEL_COUNT} */
export function isChannel(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= CHANNEL_COUNT
}

/**
 * A channel number, counted from 1 as users see it, as the parameter's x
 * @throws RangeError for anything {@link isChannel} rejects. A message with a bad channel is never sent.
 */
function channelIndex(channel: number): number {
	if (!isChannel(channel)) throw new RangeError(`${channel} is not a channel from 1 to ${CHANNEL_COUNT}`)
	return channel - 1
}

// RCP addresses a parameter by x and y. y is 0 for each of these, and so is x for all but a channel's

function get(parameter: Parameter, x = 0): string {
	return `get ${parameter} ${x} 0`
}

function set(parameter: Parameter, x: number, on: boolean): string {
	return `set ${parameter} ${x} 0 ${on ? 1 : 0}`
}

export function getPower(): string {
	return get(Parameter.Power)
}

export function setPower(on: boolean): string {
	return set(Parameter.Power, 0, on)
}

export function getOvermute(): string {
	return get(Parameter.Overmute)
}

export function setOvermute(on: boolean): string {
	return set(Parameter.Overmute, 0, on)
}

/** @param channel from 1 to {@link CHANNEL_COUNT} */
export function getChannelMute(channel: number): string {
	return get(Parameter.ChannelMute, channelIndex(channel))
}

/** @param channel from 1 to {@link CHANNEL_COUNT} */
export function setChannelMute(channel: number, muted: boolean): string {
	return set(Parameter.ChannelMute, channelIndex(channel), muted)
}

/** Asks for everything the module shows, as it does on connecting */
export function queryAll(): string[] {
	const channels = Array.from({ length: CHANNEL_COUNT }, (_, i) => i + 1)
	return [getPower(), getOvermute(), ...channels.map(getChannelMute)]
}
