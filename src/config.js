import { Regex } from '@companion-module/base'
import { default_port, choices } from './consts.js'

// Return config fields for web config
export function getConfigFields() {
	return [
		{
			type: 'static-text',
			id: 'info',
			label: 'Information',
			witdth: 12,
			value: 'This module is for NEXO NXAMP amplifiers',
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'Device IP',
			width: 12,
			regex: Regex.HOSTNAME,
		},
		{
			type: 'textinput',
			id: 'port',
			label: 'Control Port',
			width: 6,
			regex: Regex.PORT,
			default: default_port,
			tooltip: `Default, TCP:${default_port}`,
		},
	]
}
