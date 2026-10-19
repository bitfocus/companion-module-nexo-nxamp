import { setTimeout as sleep } from 'node:timers/promises'
import {
	InstanceStatus,
	type CompanionActionDefinitions,
	type CompanionFeedbackDefinitions,
} from '@companion-module/base'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NxampInstance from '../main.js'
import type { ModuleConfig } from '../config.js'
import { AmplifierConnection, Priority, queryAll, setPower } from '../api/index.js'
import { ActionId, type ActionSchema } from '../actions.js'
import { FeedbackId, type FeedbackSchema } from '../feedbacks.js'
import { FakeAmplifier } from './fakeAmplifier.js'
import { checkFeedback, runAction } from './fixtures.js'

/** What InstanceBase needs from the host, with everything it forwards to Companion mocked */
function createContext() {
	return {
		id: 'test-instance',
		_isInstanceContext: true as const,
		label: 'test',
		upgradeScripts: [],
		saveConfig: vi.fn(),
		updateStatus: vi.fn(),
		oscSend: vi.fn(),
		recordAction: vi.fn(),
		setActionDefinitions: vi.fn(),
		subscribeActions: vi.fn(),
		unsubscribeActions: vi.fn(),
		setFeedbackDefinitions: vi.fn(),
		unsubscribeFeedbacks: vi.fn(),
		checkFeedbacks: vi.fn(),
		checkAllFeedbacks: vi.fn(),
		checkFeedbacksById: vi.fn(),
		setPresetDefinitions: vi.fn(),
		setCompositeElementDefinitions: vi.fn(),
		setVariableDefinitions: vi.fn(),
		setVariableValues: vi.fn(),
		getVariableValue: vi.fn(),
		sharedUdpSocketHandlers: new Map(),
		sharedUdpSocketJoin: vi.fn(),
		sharedUdpSocketLeave: vi.fn(),
		sharedUdpSocketSend: vi.fn(),
	}
}

let fake: FakeAmplifier
const instances: NxampInstance[] = []

beforeEach(async () => {
	fake = new FakeAmplifier()
	await fake.listen()
})

afterEach(async () => {
	for (const instance of instances.splice(0)) await instance.destroy()
	await fake.close()
	vi.restoreAllMocks()
})

function createInstance() {
	const context = createContext()
	const instance = new NxampInstance(context)
	const log = vi.spyOn(instance, 'log').mockImplementation(() => {})
	instances.push(instance)
	return { instance, context, log }
}

function config(overrides: Partial<ModuleConfig> = {}): ModuleConfig {
	return { host: '127.0.0.1', port: fake.port, ...overrides }
}

/** The definitions last given to Companion, for their callbacks to be run against the real instance */
const definedActions = (context: ReturnType<typeof createContext>) =>
	context.setActionDefinitions.mock.calls.at(-1)?.[0] as CompanionActionDefinitions<ActionSchema>
const definedFeedbacks = (context: ReturnType<typeof createContext>) =>
	context.setFeedbackDefinitions.mock.calls.at(-1)?.[0] as CompanionFeedbackDefinitions<FeedbackSchema>

/** The feedback ids passed to each checkFeedbacks call */
const checked = (context: ReturnType<typeof createContext>) => context.checkFeedbacks.mock.calls.map(([ids]) => ids)

/** Waits for the connection, and for the queries on connecting to be answered */
async function started(overrides: Partial<ModuleConfig> = {}) {
	const created = createInstance()
	await created.instance.init(config(overrides))
	await vi.waitFor(() => expect(created.context.updateStatus).toHaveBeenCalledWith(InstanceStatus.Ok, 'Connected'))
	await vi.waitFor(() => expect(created.instance.channelMutes.size).toBe(4))
	await sleep(20)
	return created
}

describe('starting', () => {
	it('asks for everything on connecting, and fills in the state and the feedbacks', async () => {
		fake.values.set('AMP:Power 0 0', '1')
		fake.values.set('AMP:Ch/Mute 2 0', '1')
		const { instance, context } = await started()
		expect(fake.lines()).toEqual(queryAll())
		expect(instance.power).toBe(true)
		expect(instance.overmute).toBe(false)
		expect([...instance.channelMutes.entries()].sort()).toEqual([
			[1, false],
			[2, false],
			[3, true],
			[4, false],
		])
		const defs = definedFeedbacks(context)
		expect(checkFeedback(defs, FeedbackId.Power)).toBe(true)
		expect(checkFeedback(defs, FeedbackId.Overmute)).toBe(false)
		expect(checkFeedback(defs, FeedbackId.ChannelMute, { channelMute: 3 })).toBe(true)
		expect(checked(context)).toEqual([
			[FeedbackId.Power],
			[FeedbackId.Overmute],
			[FeedbackId.ChannelMute],
			[FeedbackId.ChannelMute],
			[FeedbackId.ChannelMute],
			[FeedbackId.ChannelMute],
		])
	})

	it('reports a missing host or an unusable port as bad config, without connecting', async () => {
		const { instance, context } = createInstance()
		await instance.init(config({ host: '  ' }))
		expect(context.updateStatus).toHaveBeenLastCalledWith(InstanceStatus.BadConfig, 'No host')
		await instance.configUpdated(config({ port: 0 }))
		expect(context.updateStatus).toHaveBeenLastCalledWith(InstanceStatus.BadConfig, 'Invalid port 0')
		await sleep(50)
		expect(fake.connections).toBe(0)
		await expect(instance.send(setPower(true))).rejects.toThrow('Not connected')
	})

	it('asks again for everything after reconnecting', async () => {
		const { instance } = await started()
		fake.values.set('AMP:Overmute 0 0', '1')
		fake.dropConnections()
		await vi.waitFor(() => expect(fake.connections).toBe(2), { timeout: 4000 })
		await vi.waitFor(() => expect(fake.lines(2)).toEqual(queryAll()))
		await vi.waitFor(() => expect(instance.overmute).toBe(true))
	})
})

describe('reports', () => {
	it('recheck the feedbacks reading what changed, and only when it changes', async () => {
		const { instance, context } = await started()
		context.checkFeedbacks.mockClear()
		fake.broadcast('OK set AMP:Power 0 0 0\n') // unchanged
		fake.broadcast('OK set AMP:Ch/Mute 1 0 1\n') // channel 2
		await vi.waitFor(() => expect(instance.channelMutes.get(2)).toBe(true))
		await sleep(20)
		expect(checked(context)).toEqual([[FeedbackId.ChannelMute]])
		fake.broadcast('OK set AMP:Overmute 0 0 1\nOK set AMP:Power 0 0 1\n')
		await vi.waitFor(() => expect(instance.power).toBe(true))
		expect(instance.overmute).toBe(true)
		expect(checked(context)).toEqual([[FeedbackId.ChannelMute], [FeedbackId.Overmute], [FeedbackId.Power]])
	})
})

describe('actions', () => {
	it('reach the amplifier, whose replies update the feedbacks', async () => {
		const { instance, context } = await started()
		const actions = definedActions(context)
		await runAction(actions, ActionId.ChannelMute, { channelMute: 4, muteState: '1' })
		await runAction(actions, ActionId.Overmute, { overmute: '1' })
		await runAction(actions, ActionId.Power, { power: '1' })
		await vi.waitFor(() => expect(instance.power).toBe(true))
		expect(fake.lines().slice(queryAll().length)).toEqual([
			'set AMP:Ch/Mute 3 0 1',
			'set AMP:Overmute 0 0 1',
			'set AMP:Power 0 0 1',
		])
		const feedbacks = definedFeedbacks(context)
		expect(checkFeedback(feedbacks, FeedbackId.ChannelMute, { channelMute: 4 })).toBe(true)
		expect(checkFeedback(feedbacks, FeedbackId.Overmute)).toBe(true)
		expect(checkFeedback(feedbacks, FeedbackId.Power)).toBe(true)
	})

	it('go at action priority, with the action signal', async () => {
		const { context } = await started()
		const send = vi.spyOn(AmplifierConnection.prototype, 'send')
		const signal = new AbortController().signal
		await runAction(definedActions(context), ActionId.Power, { power: '1' }, signal)
		expect(send).toHaveBeenCalledExactlyOnceWith(setPower(true), Priority.Action, signal)
	})

	it('send nothing once aborted', async () => {
		const { context } = await started()
		const before = fake.received.length
		await expect(
			runAction(definedActions(context), ActionId.Power, { power: '1' }, AbortSignal.abort()),
		).rejects.toThrow()
		await sleep(30)
		expect(fake.received).toHaveLength(before)
	})
})

describe('config changes and teardown', () => {
	it('forget the state, and recheck every feedback so none keeps the state it had', async () => {
		fake.values.set('AMP:Power 0 0', '1')
		const { instance, context } = await started()
		expect(checkFeedback(definedFeedbacks(context), FeedbackId.Power)).toBe(true)
		const rechecked: boolean[] = []
		// As Companion would, running the callback of every feedback
		context.checkAllFeedbacks.mockImplementation(() => {
			rechecked.push(checkFeedback(definedFeedbacks(context), FeedbackId.Power))
		})
		await instance.configUpdated(config({ host: '' }))
		expect(rechecked).toEqual([false])
		expect(instance.power).toBeUndefined()
		expect(instance.channelMutes.size).toBe(0)
	})

	it('replace the connection', async () => {
		const { instance } = await started()
		await instance.configUpdated(config())
		await vi.waitFor(() => expect(fake.connections).toBe(2))
		await vi.waitFor(() => expect(fake.openConnections).toBe(1))
		await vi.waitFor(() => expect(instance.channelMutes.size).toBe(4))
		expect(fake.lines(2)).toEqual(queryAll())
	})

	it('destroy closes the connection for good', async () => {
		const { instance, context } = await started()
		await instance.destroy()
		await vi.waitFor(() => expect(fake.openConnections).toBe(0))
		expect(context.updateStatus).toHaveBeenLastCalledWith(InstanceStatus.Disconnected, null)
		await expect(instance.send(setPower(true))).rejects.toThrow('Not connected')
	})
})
