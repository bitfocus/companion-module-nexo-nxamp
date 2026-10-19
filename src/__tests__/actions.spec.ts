import { describe, expect, it } from 'vitest'
import { ActionId } from '../actions.js'
import { setChannelMute, setOvermute, setPower } from '../api/index.js'
import { actionDefinitions, fakeInstance, runAction } from './fixtures.js'

describe('action callbacks', () => {
	it('Power sends on or off, passing on the action signal', async () => {
		const fake = fakeInstance()
		const defs = actionDefinitions(fake)
		const signal = new AbortController().signal
		await runAction(defs, ActionId.Power, { power: '1' }, signal)
		await runAction(defs, ActionId.Power, { power: '0' }, signal)
		expect(fake.send.mock.calls).toEqual([
			[setPower(true), signal],
			[setPower(false), signal],
		])
	})

	it('Overmute sends on or off, passing on the action signal', async () => {
		const fake = fakeInstance()
		const defs = actionDefinitions(fake)
		const signal = new AbortController().signal
		await runAction(defs, ActionId.Overmute, { overmute: '1' }, signal)
		await runAction(defs, ActionId.Overmute, { overmute: '0' }, signal)
		expect(fake.send.mock.calls).toEqual([
			[setOvermute(true), signal],
			[setOvermute(false), signal],
		])
	})

	it('Channel Mute mutes or unmutes the channel, passing on the action signal', async () => {
		const fake = fakeInstance()
		const defs = actionDefinitions(fake)
		const signal = new AbortController().signal
		await runAction(defs, ActionId.ChannelMute, { channelMute: 2, muteState: '1' }, signal)
		await runAction(defs, ActionId.ChannelMute, { channelMute: 4, muteState: '0' }, signal)
		expect(fake.send.mock.calls).toEqual([
			[setChannelMute(2, true), signal],
			[setChannelMute(4, false), signal],
		])
	})

	// Value mode is not validated by Companion, and a saved value is restored as it was
	it.each([
		[ActionId.Power, { power: '2' }, /Power 2 is not On or Off/],
		[ActionId.Power, { power: 1 }, /Power 1 is not On or Off/],
		[ActionId.Power, {}, /Power undefined/],
		[ActionId.Overmute, { overmute: 'on' }, /Overmute on/],
		[ActionId.ChannelMute, { channelMute: 0, muteState: '1' }, /Channel 0 is not 1 to 4/],
		[ActionId.ChannelMute, { channelMute: 5, muteState: '1' }, /Channel 5/],
		[ActionId.ChannelMute, { channelMute: 1.5, muteState: '1' }, /Channel 1.5/],
		[ActionId.ChannelMute, { channelMute: '2', muteState: '1' }, /Channel 2/],
		[ActionId.ChannelMute, { channelMute: 2, muteState: true }, /Mute true/],
	])('%s refuses %o and sends nothing', async (actionId, options, error) => {
		const fake = fakeInstance()
		await expect(runAction(actionDefinitions(fake), actionId, options)).rejects.toThrow(error)
		expect(fake.send).not.toHaveBeenCalled()
	})
})

describe('action options', () => {
	it('keep the option ids saved on buttons', () => {
		const defs = actionDefinitions(fakeInstance())
		const ids = (actionId: ActionId) => (defs[actionId] || undefined)?.options.map((option) => option.id)
		expect(ids(ActionId.Power)).toEqual(['power'])
		expect(ids(ActionId.Overmute)).toEqual(['overmute'])
		expect(ids(ActionId.ChannelMute)).toEqual(['channelMute', 'muteState'])
	})

	it('choose on or off, defaulting to off', () => {
		const def = actionDefinitions(fakeInstance())[ActionId.Power]
		if (!def) throw new Error('Power is not defined')
		expect(def.options[0]).toMatchObject({
			type: 'dropdown',
			default: '0',
			choices: [
				{ id: '1', label: 'On' },
				{ id: '0', label: 'Off' },
			],
			expressionDescription: 'Should return 1 for On, or 0 for Off',
		})
	})

	it('take a whole channel number from 1 to 4', () => {
		const def = actionDefinitions(fakeInstance())[ActionId.ChannelMute]
		if (!def) throw new Error('Channel Mute is not defined')
		expect(def.options[0]).toMatchObject({ type: 'number', min: 1, max: 4, default: 1, asInteger: true })
	})
})
