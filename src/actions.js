import { actionOptions, cmd, cmdType } from './consts.js'
export default function (self) {
	let actionList = []
	actionList['power'] = {
		name: 'Power Control',
		options: [actionOptions.power],
		callback: (action) => {
			const x = 0
			const y = 0
			self.addCmdtoQueue(
				cmdType.set +
					cmdType.space +
					cmd.power +
					cmdType.space +
					x +
					cmdType.space +
					y +
					cmdType.space +
					action.options.power,
			)
		},
		subscribe: () => {
			const x = 0
			const y = 0
			self.addCmdtoQueue(cmdType.get + cmdType.space + cmd.power + cmdType.space + x + cmdType.space + y)
		},
	}
	actionList['overMute'] = {
		name: 'Overmute',
		options: [actionOptions.overmute],
		callback: (action) => {
			const x = 0
			const y = 0
			self.addCmdtoQueue(
				cmdType.set +
					cmdType.space +
					cmd.overMute +
					cmdType.space +
					x +
					cmdType.space +
					y +
					cmdType.space +
					action.options.overmute,
			)
		},
		subscribe: () => {
			const x = 0
			const y = 0
			self.addCmdtoQueue(cmdType.get + cmdType.space + cmd.overMute + cmdType.space + x + cmdType.space + y)
		},
	}
	actionList['channelMute'] = {
		name: 'Channel Mute',
		options: [actionOptions.channelMute, actionOptions.muteState],
		callback: async (action) => {
			const x = action.options.channelMute - 1
			const y = 0
			self.addCmdtoQueue(
				cmdType.set +
					cmdType.space +
					cmd.channelMute +
					cmdType.space +
					x +
					cmdType.space +
					y +
					cmdType.space +
					action.options.muteState,
			)
		},
		subscribe: (action) => {
			const x = action.options.channelMute - 1
			const y = 0
			self.addCmdtoQueue(cmdType.get + cmdType.space + cmd.channelMute + cmdType.space + x + cmdType.space + y)
		},
	}
	self.setActionDefinitions(actionList)
}
