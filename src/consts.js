import { combineRgb } from '@companion-module/base'

export const default_port = 49280
export const msg_delay = 5
export const keep_alive_timeout = 30000
export const keep_alive_msg = 'devstatus runmode'
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

export const cmdType = {
	set: 'set',
	get: 'get',
	ok: 'OK',
	space: ' ',
}

export const cmd = {
	devstatus: 'devstatus',
	runmode: 'runmode',
	power: 'AMP:Power',
	overMute: 'AMP:Overmute',
	channelMute: 'AMP:Ch/Mute',
}

export const colours = {
	black: combineRgb(0, 0, 0),
	white: combineRgb(255, 255, 255),
	red: combineRgb(255, 0, 0),
	green: combineRgb(0, 204, 0),
	darkblue: combineRgb(0, 0, 102),
}

export const styles = {
	red: {
		bgcolor: colours.red,
		color: colours.black,
	},
	green: {
		bgcolor: colours.green,
		color: colours.black,
	},
	blue: {
		bgcolor: colours.darkblue,
		color: colours.white,
	},
}
