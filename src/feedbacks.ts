import { combineRgb, type CompanionFeedbackDefinitions } from '@companion-module/base'
import type NxampInstance from './main.js'
import { isChannel } from './api/index.js'
import { channelOption } from './options.js'

/**
 * Feedback ids. The values are the ids saved against every button using the feedback, so they must never change — they
 * predate this enum and are camelCase for that reason.
 */
export enum FeedbackId {
	ChannelMute = 'channelMute',
	Power = 'power',
	Overmute = 'overMute',
}

export type FeedbackSchema = {
	[FeedbackId.ChannelMute]: { type: 'boolean'; options: { channelMute: number } }
	[FeedbackId.Power]: { type: 'boolean'; options: Record<string, never> }
	[FeedbackId.Overmute]: { type: 'boolean'; options: Record<string, never> }
}

const black = combineRgb(0, 0, 0)

const styles = {
	red: { bgcolor: combineRgb(255, 0, 0), color: black },
	green: { bgcolor: combineRgb(0, 204, 0), color: black },
}

// The amplifier is asked for everything these read on connecting, so the callbacks need ask for nothing

export function UpdateFeedbacks(self: NxampInstance): void {
	const feedbacks: CompanionFeedbackDefinitions<FeedbackSchema> = {
		[FeedbackId.ChannelMute]: {
			name: 'Channel Mute',
			description: 'True while the channel is muted',
			type: 'boolean',
			defaultStyle: styles.red,
			options: [channelOption],
			callback: ({ options }) => isChannel(options.channelMute) && self.channelMutes.get(options.channelMute) === true,
		},
		[FeedbackId.Power]: {
			name: 'Power',
			description: 'True while the amplifier is on',
			type: 'boolean',
			defaultStyle: styles.green,
			options: [],
			callback: () => self.power === true,
		},
		[FeedbackId.Overmute]: {
			name: 'Overmute',
			description: 'True while overmute is on',
			type: 'boolean',
			defaultStyle: styles.red,
			options: [],
			callback: () => self.overmute === true,
		},
	}

	self.setFeedbackDefinitions(feedbacks)
}
