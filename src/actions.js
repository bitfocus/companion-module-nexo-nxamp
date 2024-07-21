import { actionOptions, cmd } from './consts.js'
export default function (self) {
	let actionList = []
	actionList['power'] = {
		name: 'Power Control',
		options: [actionOptions.power],
		callback: async (action) => {
			self.addCmdtoQueue(cmd.power + action.options.power)
		},
	}
	actionList['overMute'] = {
		name: 'Overmute',
		options: [actionOptions.overmute],
		callback: async (action) => {
			self.addCmdtoQueue(cmd.overMute + action.options.overmute)
		},
	}
	actionList['channelMute'] = {
		name: 'Channel Mute',
		options: [actionOptions.channelMute, actionOptions.muteState],
		callback: async (action) => {
			self.addCmdtoQueue(cmd.channelMute + (action.options.channelMute - 1) + ' 0 ' + Number(action.options.muteState))
		},
	}
	self.setActionDefinitions(actionList)
}
