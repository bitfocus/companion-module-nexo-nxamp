import { Regex, type SomeCompanionConfigField } from '@companion-module/base'
import { DEFAULT_PORT } from './api/index.js'

export type ModuleConfig = {
	host: string
	port: number
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'static-text',
			id: 'info',
			label: 'Information',
			width: 12,
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
			type: 'number',
			id: 'port',
			label: 'Control Port',
			width: 6,
			min: 1,
			max: 65535,
			default: DEFAULT_PORT,
			tooltip: `Default TCP:${DEFAULT_PORT}`,
		},
	]
}

/** The port from the config, or undefined if it is not one TCP can use */
export function validPort(port: unknown): number | undefined {
	const value = Number(port)
	return Number.isInteger(value) && value >= 1 && value <= 65535 ? value : undefined
}
