import { describe, expect, it } from 'vitest'
import { FeedbackId } from '../feedbacks.js'
import { checkFeedback, fakeInstance, feedbackDefinitions } from './fixtures.js'

describe('Channel Mute feedback', () => {
	it('is true only for a muted channel', () => {
		const fake = fakeInstance()
		fake.self.channelMutes.set(2, true)
		fake.self.channelMutes.set(3, false)
		const defs = feedbackDefinitions(fake)
		expect(checkFeedback(defs, FeedbackId.ChannelMute, { channelMute: 2 })).toBe(true)
		expect(checkFeedback(defs, FeedbackId.ChannelMute, { channelMute: 3 })).toBe(false)
		// Not yet reported
		expect(checkFeedback(defs, FeedbackId.ChannelMute, { channelMute: 1 })).toBe(false)
	})

	it.each([0, 5, 2.5, '2'])('is false for channel %j', (channelMute) => {
		const fake = fakeInstance()
		fake.self.channelMutes.set(2, true)
		expect(checkFeedback(feedbackDefinitions(fake), FeedbackId.ChannelMute, { channelMute })).toBe(false)
	})

	it('keeps the option id saved on buttons, and describes the range for expressions', () => {
		const def = feedbackDefinitions(fakeInstance())[FeedbackId.ChannelMute]
		if (!def) throw new Error('Channel Mute is not defined')
		expect(def.options).toMatchObject([
			{ id: 'channelMute', expressionDescription: 'Should return a channel number, 1 to 4' },
		])
	})
})

describe.each([
	[FeedbackId.Power, 'power'],
	[FeedbackId.Overmute, 'overmute'],
] as const)('%s feedback', (feedbackId, state) => {
	it('is true only once the amplifier has reported it on', () => {
		const fake = fakeInstance()
		const defs = feedbackDefinitions(fake)
		expect(checkFeedback(defs, feedbackId)).toBe(false)
		fake.self[state] = true
		expect(checkFeedback(defs, feedbackId)).toBe(true)
		fake.self[state] = false
		expect(checkFeedback(defs, feedbackId)).toBe(false)
	})
})
