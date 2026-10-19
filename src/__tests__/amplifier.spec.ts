import { setTimeout as sleep } from 'node:timers/promises'
import { InstanceStatus, type LogLevel } from '@companion-module/base'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	AmplifierConnection,
	getPower,
	KEEPALIVE,
	Priority,
	queryAll,
	setPower,
	type AmplifierTiming,
	type Report,
} from '../api/index.js'
import { closedPort, FakeAmplifier } from './fakeAmplifier.js'

let fake: FakeAmplifier
const amplifiers: AmplifierConnection[] = []

beforeEach(async () => {
	fake = new FakeAmplifier()
	await fake.listen()
})

afterEach(async () => {
	for (const amplifier of amplifiers.splice(0)) amplifier.destroy()
	await fake.close()
})

function open(timing: Partial<AmplifierTiming> = {}, port = fake.port) {
	const log = vi.fn<(level: LogLevel, message: string) => void>()
	const amplifier = new AmplifierConnection({
		host: '127.0.0.1',
		port,
		log,
		timing: { reconnectInterval: 100, ...timing },
	})
	const reports: Report[] = []
	const statuses: [InstanceStatus, string | null][] = []
	amplifier.on('report', (report) => reports.push(report))
	amplifier.on('status', (status, message) => statuses.push([status, message]))
	amplifiers.push(amplifier)
	amplifier.connect()
	return { amplifier, log, reports, statuses }
}

async function connected(timing: Partial<AmplifierTiming> = {}) {
	const opened = open(timing)
	await vi.waitFor(() => expect(opened.amplifier.isConnected).toBe(true))
	return opened
}

const logged = (log: ReturnType<typeof open>['log'], pattern: RegExp) =>
	log.mock.calls.filter(([, message]) => pattern.test(message)).map(([level]) => level)

describe('connecting', () => {
	it('reports connecting, then connected', async () => {
		const { statuses } = await connected()
		expect(statuses).toEqual([
			[InstanceStatus.Connecting, `Connecting to 127.0.0.1:${fake.port}`],
			[InstanceStatus.Ok, 'Connected'],
		])
	})

	it('logs a failure as an error once, then each retry quietly', async () => {
		const { log, statuses } = open({}, await closedPort())
		await vi.waitFor(() => expect(logged(log, /^Network error/).length).toBeGreaterThanOrEqual(3), { timeout: 2000 })
		expect(logged(log, /^Network error/).slice(0, 3)).toEqual(['error', 'debug', 'debug'])
		expect(statuses.at(-1)?.[0]).toBe(InstanceStatus.ConnectionFailure)
	})

	it('reconnects when the amplifier closes the connection', async () => {
		const { amplifier, statuses } = await connected()
		fake.dropConnections()
		await vi.waitFor(() =>
			expect(statuses).toContainEqual([InstanceStatus.Disconnected, 'Connection closed by amplifier']),
		)
		await vi.waitFor(() => expect(fake.connections).toBe(2))
		await vi.waitFor(() => expect(amplifier.isConnected).toBe(true))
		await amplifier.send(getPower())
		await vi.waitFor(() => expect(fake.lines(2)).toEqual([getPower()]))
	})

	it('refuses to send with no connection', async () => {
		const { amplifier } = open({}, await closedPort())
		await expect(amplifier.send(getPower())).rejects.toThrow('Not connected')
	})
})

describe('sending', () => {
	it('ends each message with LF, and leaves the gap between them', async () => {
		const { amplifier } = await connected({ messageGap: 40 })
		const messages = queryAll().slice(0, 3)
		await Promise.all(messages.map(async (message) => amplifier.send(message)))
		await vi.waitFor(() => expect(fake.received).toHaveLength(3))
		expect(fake.lines()).toEqual(messages)
		const at = fake.received.map((r) => r.at)
		expect(at[1] - at[0]).toBeGreaterThanOrEqual(35)
		expect(at[2] - at[1]).toBeGreaterThanOrEqual(35)
	})

	it('keeps the gap after reconnecting', async () => {
		const { amplifier } = await connected({ messageGap: 40 })
		fake.dropConnections()
		await vi.waitFor(() => expect(fake.connections).toBe(2))
		await vi.waitFor(() => expect(amplifier.isConnected).toBe(true))
		await Promise.all([amplifier.send(getPower()), amplifier.send(getPower())])
		await vi.waitFor(() => expect(fake.received).toHaveLength(2))
		expect(fake.received[1].at - fake.received[0].at).toBeGreaterThanOrEqual(35)
	})

	it('sends an action ahead of background messages still waiting', async () => {
		const { amplifier } = await connected({ messageGap: 20 })
		const background = Array.from({ length: 5 }, async () => amplifier.send(getPower(), Priority.Background))
		const action = amplifier.send(setPower(true), Priority.Action)
		await Promise.all([...background, action])
		await vi.waitFor(() => expect(fake.lines()).toHaveLength(6))
		// The first background message may already be on its way
		expect(fake.lines().indexOf(setPower(true))).toBeLessThanOrEqual(1)
	})

	it('drops a message whose signal aborts before its turn, and sends the rest', async () => {
		const { amplifier } = await connected({ messageGap: 50 })
		const first = amplifier.send(getPower())
		const controller = new AbortController()
		const aborted = amplifier.send(setPower(true), Priority.Background, controller.signal)
		const last = amplifier.send(getPower())
		controller.abort(new Error('Aborted by the user'))
		await expect(aborted).rejects.toThrow('Aborted by the user')
		await Promise.all([first, last])
		await sleep(20)
		expect(fake.lines()).toEqual([getPower(), getPower()])
	})

	it('sends nothing for a signal aborted already', async () => {
		const { amplifier } = await connected()
		await expect(amplifier.send(setPower(true), Priority.Action, AbortSignal.abort())).rejects.toThrow()
		await sleep(20)
		expect(fake.lines()).toEqual([])
	})

	it('rejects everything still queued when the connection closes, and sends none of it on the next', async () => {
		// Long enough that the second message is still waiting for its gap when the connection is dropped
		const { amplifier } = await connected({ messageGap: 300 })
		const sends = Array.from({ length: 3 }, async () => amplifier.send(getPower()))
		await vi.waitFor(() => expect(fake.received).toHaveLength(1))
		fake.dropConnections()
		const results = await Promise.allSettled(sends)
		expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'rejected'])
		await vi.waitFor(() => expect(amplifier.isConnected).toBe(true))
		// Past the end of the gap, when the second message would have gone on this new connection
		await sleep(400)
		expect(fake.lines()).toEqual([getPower()])
	})
})

describe('receiving', () => {
	it('reports what the amplifier sends, however the lines are split', async () => {
		const { reports } = await connected()
		fake.broadcast('OK set AMP:Power 0 0 1\nOK set AMP:Ch/')
		await sleep(20)
		fake.broadcast('Mute 2 0 1\r\nOK get AMP:Overmute 0 0 0\n')
		await vi.waitFor(() => expect(reports).toHaveLength(3))
		expect(reports).toEqual([
			{ type: 'power', on: true },
			{ type: 'channelMute', channel: 3, muted: true },
			{ type: 'overmute', on: false },
		])
	})

	it('logs what it does not report', async () => {
		const { log, reports } = await connected()
		fake.broadcast('ERROR set InvalidArgument\nOK devstatus runmode "normal"\n')
		await vi.waitFor(() => expect(log).toHaveBeenCalledWith('debug', 'Device status: runmode "normal"'))
		expect(log).toHaveBeenCalledWith('warn', 'Amplifier replied ERROR set InvalidArgument')
		expect(reports).toEqual([])
	})

	it('carries on when a listener throws', async () => {
		const { amplifier, log, reports } = await connected()
		amplifier.on('report', () => {
			throw new Error('listener failed')
		})
		fake.broadcast('OK set AMP:Power 0 0 1\nOK set AMP:Power 0 0 0\n')
		await vi.waitFor(() => expect(reports).toHaveLength(2))
		expect(log).toHaveBeenCalledWith('error', 'Could not handle OK set AMP:Power 0 0 1: listener failed')
	})
})

describe('keepalive', () => {
	it('is sent every interval', async () => {
		await connected({ keepaliveInterval: 50 })
		await vi.waitFor(() => expect(fake.lines().filter((line) => line === KEEPALIVE).length).toBeGreaterThanOrEqual(3))
	})

	it('reconnects once an amplifier that has answered it goes quiet', async () => {
		const { log } = await connected({ keepaliveInterval: 50 })
		await vi.waitFor(() => expect(log).toHaveBeenCalledWith('debug', 'Device status: runmode "normal"'))
		fake.answering = false
		await vi.waitFor(() => expect(fake.connections).toBe(2), { timeout: 2000 })
		expect(log).toHaveBeenCalledWith('warn', expect.stringMatching(/^Nothing received from amplifier for \d+ ms/))
	})

	it('does not reconnect to an amplifier that has never answered it', async () => {
		fake.answersKeepalive = false
		await connected({ keepaliveInterval: 50 })
		await sleep(400)
		expect(fake.lines().filter((line) => line === KEEPALIVE).length).toBeGreaterThanOrEqual(3)
		expect(fake.connections).toBe(1)
	})
})

describe('destroy', () => {
	it('closes the connection for good, rejecting anything queued', async () => {
		const { amplifier } = await connected({ messageGap: 50 })
		const sends = [amplifier.send(getPower()), amplifier.send(getPower())]
		amplifier.destroy()
		expect((await Promise.allSettled(sends))[1].status).toBe('rejected')
		await vi.waitFor(() => expect(fake.openConnections).toBe(0))
		await expect(amplifier.send(getPower())).rejects.toThrow('Not connected')
		expect(() => amplifier.connect()).toThrow('destroyed')
	})
})
