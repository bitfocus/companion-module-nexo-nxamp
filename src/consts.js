export const default_port = 49280
export const msg_delay = 5
export const keep_alive_timeout = 30000
export const keep_alive_msg = ''
export const EOL = '\n'

export const choices = {
	power: [
		{ id: '1', label: 'On' },
		{ id: '0', label: 'Off' },
	],
	overMute: [
		{ id: '1', label: 'On' },
		{ id: '0', label: 'Off' },
	],
	muteState: [
		{ id: '1', label: 'On' },
		{ id: '0', label: 'Off' },
	],
}

export const actionOptions = {
	power: {
		type: 'dropdown',
		label: 'Power',
		id: 'power',
		default: choices.power[1].id,
		choices: choices.power,
	},
	overmute: {
		type: 'dropdown',
		label: 'Overmute',
		id: 'overmute',
		default: choices.overMute[1].id,
		choices: choices.overMute,
	},
	channelMute: {
		type: 'number',
		label: 'Channel',
		id: 'channelMute',
		min: 1,
		max: 4,
		default: 1,
		range: true,
		step: 1,
	},
	muteState: {
		type: 'dropdown',
		label: 'Mute',
		id: 'muteState',
		default: choices.muteState[1].id,
		choices: choices.muteState,
	},
}

export const cmd = {
	power: 'set AMP:Power 0 0 ',
	overMute: 'set AMP:Overmute 0 0 ',
	channelMute: 'set AMP:Ch/Mute ',
}
