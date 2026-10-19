import { StringDecoder } from 'node:string_decoder'
import type { LogLevel } from '@companion-module/base'
import { CHANNEL_COUNT, EOL, MAX_LINE_LENGTH, Parameter } from './consts.js'
import { unhandledOption } from '../util.js'

export interface PowerReport {
	type: 'power'
	on: boolean
}

export interface OvermuteReport {
	type: 'overmute'
	on: boolean
}

export interface ChannelMuteReport {
	type: 'channelMute'
	/** From 1 to {@link CHANNEL_COUNT} */
	channel: number
	muted: boolean
}

/** The amplifier reporting a parameter's value, in answer to a get or a set */
export type Report = PowerReport | OvermuteReport | ChannelMuteReport

/** The answer to the keepalive */
export interface DevstatusResponse {
	type: 'devstatus'
	/** Everything after `OK devstatus`, such as `runmode "normal"` */
	status: string
}

/** A line the module only reports in the log */
export interface LogResponse {
	type: 'log'
	level: LogLevel
	message: string
}

export type Response = Report | DevstatusResponse | LogResponse

function log(level: LogLevel, message: string): LogResponse {
	return { type: 'log', level, message }
}

const PARAMETERS = new Set<string>(Object.values(Parameter))

function isParameter(value: string | undefined): value is Parameter {
	return value !== undefined && PARAMETERS.has(value)
}

/** A parameter's value, which is 1 for on and 0 for off. Anything else is undefined */
function onOff(value: string | undefined): boolean | undefined {
	switch (value) {
		case '1':
			return true
		case '0':
			return false
		default:
			return undefined
	}
}

/**
 * Decodes one line from the amplifier, without its end of line. A get or a set is answered
 * `OK <get|set> <parameter> <x> <y> <value>`, with y always 0 for the parameters this module uses.
 */
export function decodeLine(line: string): Response {
	const fields = line.split(' ')
	const [status, action, parameter, x, , value] = fields
	if (status === 'ERROR') return log('warn', `Amplifier replied ${line}`)
	if (status !== 'OK') return log('info', `Received ${line}`)
	if (action === 'devstatus') return { type: 'devstatus', status: fields.slice(2).join(' ') }
	if (action !== 'get' && action !== 'set') return log('debug', `Received ${line}`)
	if (fields.length !== 6) return log('warn', `Invalid message length: ${line}`)
	if (!isParameter(parameter)) return log('debug', `Unrecognised message: ${line}`)
	const on = onOff(value)
	if (on === undefined) return log('warn', `Invalid value ${value}: ${line}`)
	switch (parameter) {
		case Parameter.Power:
			return { type: 'power', on }
		case Parameter.Overmute:
			return { type: 'overmute', on }
		case Parameter.ChannelMute: {
			const channel = Number(x) + 1
			if (!/^\d+$/.test(x) || channel > CHANNEL_COUNT) return log('debug', `No channel ${x}, ignored: ${line}`)
			return { type: 'channelMute', channel, muted: on }
		}
		default:
			return unhandledOption(parameter, log('debug', `Unrecognised message: ${line}`))
	}
}

/** Splits what the amplifier sends into lines. A line can arrive in pieces, and several can arrive at once */
export class LineReader {
	readonly #decoder = new StringDecoder('utf8')
	#partial = ''

	/**
	 * @returns the lines completed, without their end of line, and the length of any unterminated line dropped for
	 * reaching {@link MAX_LINE_LENGTH}
	 */
	push(chunk: Buffer): { lines: string[]; discarded: number } {
		const lines = (this.#partial + this.#decoder.write(chunk)).split(EOL)
		this.#partial = lines.pop() ?? ''
		let discarded = 0
		if (this.#partial.length >= MAX_LINE_LENGTH) {
			discarded = this.#partial.length
			this.#partial = ''
		}
		return {
			lines: lines.map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line)).filter((line) => line !== ''),
			discarded,
		}
	}

	/** Drops any line in progress, for a new connection */
	reset(): void {
		this.#decoder.end()
		this.#partial = ''
	}
}
