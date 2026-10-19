import { describe, expect, it } from 'vitest'
import {
	getChannelMute,
	getOvermute,
	getPower,
	isChannel,
	KEEPALIVE,
	queryAll,
	setChannelMute,
	setOvermute,
	setPower,
} from '../api/index.js'

describe('messages', () => {
	it('set power and overmute, with 1 for on and 0 for off', () => {
		expect(setPower(true)).toBe('set AMP:Power 0 0 1')
		expect(setPower(false)).toBe('set AMP:Power 0 0 0')
		expect(setOvermute(true)).toBe('set AMP:Overmute 0 0 1')
		expect(setOvermute(false)).toBe('set AMP:Overmute 0 0 0')
	})

	it('address a channel from 0 on the wire', () => {
		expect(setChannelMute(1, true)).toBe('set AMP:Ch/Mute 0 0 1')
		expect(setChannelMute(4, false)).toBe('set AMP:Ch/Mute 3 0 0')
		expect(getChannelMute(3)).toBe('get AMP:Ch/Mute 2 0')
	})

	it.each([0, 5, 1.5, Number.NaN])('refuse channel %d rather than send it', (channel) => {
		expect(() => setChannelMute(channel, true)).toThrow(RangeError)
		expect(() => getChannelMute(channel)).toThrow(RangeError)
	})

	it('ask for everything on connecting: power, overmute and each channel', () => {
		expect(queryAll()).toEqual([
			'get AMP:Power 0 0',
			'get AMP:Overmute 0 0',
			'get AMP:Ch/Mute 0 0',
			'get AMP:Ch/Mute 1 0',
			'get AMP:Ch/Mute 2 0',
			'get AMP:Ch/Mute 3 0',
		])
		expect(getPower()).toBe(queryAll()[0])
		expect(getOvermute()).toBe(queryAll()[1])
	})

	it('keep the keepalive the module has always sent', () => {
		expect(KEEPALIVE).toBe('devstatus runmode')
	})
})

describe('isChannel', () => {
	it.each([1, 2, 3, 4])('accepts %d', (channel) => {
		expect(isChannel(channel)).toBe(true)
	})

	it.each([0, 5, -1, 2.5, '2', undefined, null])('rejects %j', (channel) => {
		expect(isChannel(channel)).toBe(false)
	})
})
