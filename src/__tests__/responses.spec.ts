import { describe, expect, it } from 'vitest'
import { decodeLine, LineReader, MAX_LINE_LENGTH } from '../api/index.js'

// Lines in the form the module has parsed since 2.1.0, not captured from an amplifier
describe('decodeLine', () => {
	it.each([
		['OK get AMP:Power 0 0 1', { type: 'power', on: true }],
		['OK set AMP:Power 0 0 0', { type: 'power', on: false }],
		['OK get AMP:Overmute 0 0 1', { type: 'overmute', on: true }],
		['OK set AMP:Overmute 0 0 0', { type: 'overmute', on: false }],
		['OK get AMP:Ch/Mute 0 0 1', { type: 'channelMute', channel: 1, muted: true }],
		['OK set AMP:Ch/Mute 3 0 0', { type: 'channelMute', channel: 4, muted: false }],
	])('reports %s', (line, report) => {
		expect(decodeLine(line)).toEqual(report)
	})

	it('takes the answer to the keepalive', () => {
		expect(decodeLine('OK devstatus runmode "normal"')).toEqual({ type: 'devstatus', status: 'runmode "normal"' })
	})

	it('logs an error from the amplifier as a warning', () => {
		expect(decodeLine('ERROR set InvalidArgument')).toEqual({
			type: 'log',
			level: 'warn',
			message: 'Amplifier replied ERROR set InvalidArgument',
		})
	})

	it.each(['NOTIFY set AMP:Power 0 0 1', 'hello'])('logs %s, which is not an OK, as received', (line) => {
		expect(decodeLine(line)).toEqual({ type: 'log', level: 'info', message: `Received ${line}` })
	})

	it.each([
		['OK get AMP:Power 0 0', 'warn', /Invalid message length/],
		['OK get AMP:Power 0 0 1 "On"', 'warn', /Invalid message length/],
		['OK get AMP:Power 0 0 2', 'warn', /Invalid value 2/],
		['OK get AMP:Power 0 0 on', 'warn', /Invalid value on/],
		['OK get AMP:Gain 0 0 1', 'debug', /Unrecognised message/],
		['OK get AMP:Ch/Mute 4 0 1', 'debug', /No channel 4/],
		['OK get AMP:Ch/Mute -1 0 1', 'debug', /No channel -1/],
		['OK get AMP:Ch/Mute x 0 1', 'debug', /No channel x/],
		['OK scpmode keepalive 60000', 'debug', /Received/],
	])('only logs %s', (line, level, message) => {
		expect(decodeLine(line)).toEqual({ type: 'log', level, message: expect.stringMatching(message) })
	})
})

describe('LineReader', () => {
	const reader = () => new LineReader()
	const push = (r: LineReader, text: string) => r.push(Buffer.from(text, 'utf8'))

	it('gives each complete line, without its end of line, and keeps the rest for the next chunk', () => {
		const r = reader()
		expect(push(r, 'OK get AMP:Power 0 0 1\nOK get AMP:Over')).toEqual({
			lines: ['OK get AMP:Power 0 0 1'],
			discarded: 0,
		})
		expect(push(r, 'mute 0 0 0\n').lines).toEqual(['OK get AMP:Overmute 0 0 0'])
	})

	it('takes CR LF as well as LF, and skips empty lines', () => {
		expect(push(reader(), 'OK get AMP:Power 0 0 1\r\n\n\r\nOK set AMP:Power 0 0 0\n').lines).toEqual([
			'OK get AMP:Power 0 0 1',
			'OK set AMP:Power 0 0 0',
		])
	})

	it('joins a character split between chunks', () => {
		const r = reader()
		const bytes = Buffer.from('OK devstatus runmode "é"\n', 'utf8')
		const split = bytes.indexOf(0xc3) + 1
		expect(r.push(bytes.subarray(0, split)).lines).toEqual([])
		expect(r.push(bytes.subarray(split)).lines).toEqual(['OK devstatus runmode "é"'])
	})

	it('drops an unterminated line once it is too long to be a reply', () => {
		const r = reader()
		expect(push(r, 'x'.repeat(MAX_LINE_LENGTH - 1)).discarded).toBe(0)
		expect(push(r, 'x')).toEqual({ lines: [], discarded: MAX_LINE_LENGTH })
		expect(push(r, 'OK\n').lines).toEqual(['OK'])
	})

	it('drops a line in progress on reset', () => {
		const r = reader()
		push(r, 'OK get AMP:Pow')
		r.reset()
		expect(push(r, 'OK get AMP:Power 0 0 1\n').lines).toEqual(['OK get AMP:Power 0 0 1'])
	})
})
