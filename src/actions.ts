import type { CompanionActionDefinitions } from '@companion-module/base'
import type NxampInstance from './main.js'
import { CHANNEL_COUNT, isChannel, setChannelMute, setOvermute, setPower } from './api/index.js'
import { channelOption, isOnOff, muteStateOption, overmuteOption, powerOption, type OnOff } from './options.js'

/**
 * Action ids. The values are the ids saved against every button using the action, so they must never change — they
 * predate this enum and are camelCase for that reason.
 */
export enum ActionId {
	Power = 'power',
	Overmute = 'overMute',
	ChannelMute = 'channelMute',
}

export type ActionSchema = {
	[ActionId.Power]: { options: { power: OnOff } }
	[ActionId.Overmute]: { options: { overmute: OnOff } }
	[ActionId.ChannelMute]: { options: { channelMute: number; muteState: OnOff } }
}

/** @returns true for On */
function checkOnOff(value: unknown, label: string, action: string): boolean {
	if (!isOnOff(value)) throw new Error(`${label} ${String(value)} is not On or Off, ${action} not sent`)
	return value === '1'
}

function checkChannel(value: unknown, action: string): number {
	if (!isChannel(value)) throw new Error(`Channel ${String(value)} is not 1 to ${CHANNEL_COUNT}, ${action} not sent`)
	return value
}

export function UpdateActions(self: NxampInstance): void {
	const actions: CompanionActionDefinitions<ActionSchema> = {
		[ActionId.Power]: {
			name: 'Power Control',
			description: 'Turn the amplifier on or off',
			options: [powerOption],
			callback: async ({ options }, context) => {
				const on = checkOnOff(options.power, 'Power', 'Power')
				await self.send(setPower(on), context.signal)
			},
		},
		[ActionId.Overmute]: {
			name: 'Overmute',
			description: 'Mute or unmute every channel at once',
			options: [overmuteOption],
			callback: async ({ options }, context) => {
				const on = checkOnOff(options.overmute, 'Overmute', 'Overmute')
				await self.send(setOvermute(on), context.signal)
			},
		},
		[ActionId.ChannelMute]: {
			name: 'Channel Mute',
			description: 'Mute or unmute a channel',
			options: [channelOption, muteStateOption],
			callback: async ({ options }, context) => {
				const channel = checkChannel(options.channelMute, 'Channel Mute')
				const muted = checkOnOff(options.muteState, 'Mute', 'Channel Mute')
				await self.send(setChannelMute(channel, muted), context.signal)
			},
		},
	}

	self.setActionDefinitions(actions)
}
