import { actionOptions, cmd, cmdType, styles } from './consts.js'

export default function (self) {
	let feedbackDefs = []

	feedbackDefs['channelMute'] = {
		name: 'Channel Mute',
		type: 'boolean',
		label: 'Channel Mute',
		defaultStyle: styles.red,
		options: [actionOptions.channelMute],
		callback: ({ options }) => {
			return self.NXAMP.mute[`ch${options.channelMute}`] === 1
		},
		subscribe: ({ options }) => {
			const x = options.channelMute - 1
			const y = 0
			self.addCmdtoQueue(cmdType.get + cmdType.space + cmd.channelMute + cmdType.space + x + cmdType.space + y)
		},
	}

	feedbackDefs['power'] = {
		name: 'Power',
		type: 'boolean',
		label: 'Power',
		defaultStyle: styles.green,
		options: [],
		callback: () => {
			return self.NXAMP.power === 1
		},
		subscribe: () => {
			const x = 0
			const y = 0
			self.addCmdtoQueue(cmdType.get + cmdType.space + cmd.power + cmdType.space + x + cmdType.space + y)
		},
	}

	feedbackDefs['overMute'] = {
		name: 'Overmute',
		type: 'boolean',
		label: 'Overmute',
		defaultStyle: styles.red,
		options: [],
		callback: () => {
			return self.NXAMP.overmute === 1
		},
		subscribe: () => {
			const x = 0
			const y = 0
			self.addCmdtoQueue(cmdType.get + cmdType.space + cmd.overMute + cmdType.space + x + cmdType.space + y)
		},
	}

	self.setFeedbackDefinitions(feedbackDefs)
}
