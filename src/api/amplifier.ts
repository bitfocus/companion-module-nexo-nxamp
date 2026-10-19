import { EventEmitter } from 'node:events'
import { setTimeout as sleep } from 'node:timers/promises'
import { InstanceStatus, TCPHelper, type LogLevel } from '@companion-module/base'
import PQueue from 'p-queue'
import { EOL, KEEPALIVE_INTERVAL_MS, MESSAGE_GAP_MS, Priority, RECONNECT_INTERVAL_MS } from './consts.js'
import { KEEPALIVE } from './messages.js'
import { decodeLine, LineReader, type Report, type Response } from './responses.js'
import { errorMessage, unhandledOption } from '../util.js'

export interface AmplifierTiming {
	/** Least time from sending one message to sending the next */
	messageGap: number
	keepaliveInterval: number
	reconnectInterval: number
}

export const DEFAULT_TIMING: AmplifierTiming = {
	messageGap: MESSAGE_GAP_MS,
	keepaliveInterval: KEEPALIVE_INTERVAL_MS,
	reconnectInterval: RECONNECT_INTERVAL_MS,
}

/**
 * An amplifier that has answered a keepalive on this connection and then sends nothing for this many keepalive intervals
 * is taken to have gone, and the connection is reopened. A pulled cable or a power cut leaves the socket open, and TCP
 * can take many minutes to notice.
 *
 * Only an amplifier known to answer is watched. One that never answers the keepalive would otherwise be reconnected
 * every minute while idle.
 */
export const WATCHDOG_INTERVALS = 1.5

export interface AmplifierOptions {
	host: string
	port: number
	log: (level: LogLevel, message: string) => void
	/** Defaults to {@link DEFAULT_TIMING}. Tests shorten it */
	timing?: Partial<AmplifierTiming>
}

export interface AmplifierEvents {
	/** A connection has opened. Fires again on every reconnection */
	connected: []
	report: [report: Report]
	status: [status: InstanceStatus, message: string | null]
}

/**
 * The TCP connection to an NXAMP: line framing, pacing, keepalive and reconnection. Knows nothing of Companion beyond
 * reporting a status for it.
 */
export class AmplifierConnection extends EventEmitter<AmplifierEvents> {
	readonly #options: AmplifierOptions
	readonly #timing: AmplifierTiming
	readonly #queue = new PQueue({ concurrency: 1 })
	readonly #reader = new LineReader()
	#socket: TCPHelper | undefined
	/** Exists while a connection is open, and is aborted as it closes, which drops everything queued for it */
	#session: AbortController | undefined
	/** Settles once the amplifier may be sent the next message */
	#lineClear: Promise<void> = Promise.resolve()
	#keepaliveTimer: NodeJS.Timeout | undefined
	#lastReceived = 0
	#answersKeepalive = false
	/** Set by the first failure of an outage, so retries against an amplifier that is off don't flood the log */
	#outageLogged = false
	#lastStatus: { status: InstanceStatus; message: string | null } | undefined
	#destroyed = false

	constructor(options: AmplifierOptions) {
		super()
		this.#options = options
		this.#timing = { ...DEFAULT_TIMING, ...options.timing }
	}

	get isConnected(): boolean {
		return this.#session !== undefined
	}

	/** Opens the connection, replacing any already open. After that, TCPHelper reconnects by itself */
	connect(): void {
		if (this.#destroyed) throw new Error('Amplifier connection has been destroyed')
		this.#closeSocket()
		const { host, port } = this.#options
		this.#status(InstanceStatus.Connecting, `Connecting to ${host}:${port}`)
		const socket = new TCPHelper(host, port, { reconnect: true, reconnect_interval: this.#timing.reconnectInterval })
		this.#socket = socket
		socket.on('connect', () => this.#open())
		socket.on('data', (chunk) => this.#receive(chunk))
		socket.on('end', () => {
			this.#close()
			this.#status(InstanceStatus.Disconnected, 'Connection closed by amplifier')
			this.#logOutage('warn', `Connection closed by ${host}:${port}`)
		})
		socket.on('error', (err) => {
			this.#close()
			this.#status(InstanceStatus.ConnectionFailure, err.message)
			this.#logOutage('error', `Network error: ${err.message}`)
		})
	}

	/** Closes the connection for good. Anything still queued is rejected */
	destroy(): void {
		this.#destroyed = true
		this.removeAllListeners()
		this.#closeSocket()
	}

	/**
	 * Queues a message for the amplifier
	 * @param message without its end of line
	 * @param signal an action's context.signal. A message whose signal aborts before its turn is never sent
	 * @returns once the message is written to the socket
	 * @throws if there is no connection, or it closes or the signal aborts before the message is sent
	 */
	async send(message: string, priority: Priority = Priority.Background, signal?: AbortSignal): Promise<void> {
		const session = this.#session
		if (session === undefined) throw new Error('Not connected to amplifier')
		// p-queue listens on the combined signal from the moment the job is queued, which makes it pass an abort on
		// eagerly. Only reading .aborted could miss one: AbortSignal.any holds its sources weakly
		const combined = signal ? AbortSignal.any([session.signal, signal]) : session.signal
		await this.#queue.add(async ({ signal: jobSignal }) => this.#transmit(message, jobSignal), {
			priority,
			signal: combined,
		})
	}

	async #transmit(message: string, signal: AbortSignal | undefined): Promise<void> {
		// The wait is here, at the start of a job, rather than at the end of the one before. p-queue starts the next job as
		// soon as a running job's signal aborts, and the amplifier must still get its gap
		await this.#lineClear
		signal?.throwIfAborted()
		const socket = this.#socket
		if (!socket?.isConnected) throw new Error('Not connected to amplifier')
		this.#lineClear = sleep(this.#timing.messageGap)
		this.#options.log('debug', `Sending ${message}`)
		// Every message is ASCII
		if (!(await socket.sendAsync(Buffer.from(message + EOL, 'latin1')))) throw new Error('Not connected to amplifier')
	}

	#open(): void {
		this.#close()
		const { host, port } = this.#options
		this.#session = new AbortController()
		this.#reader.reset()
		this.#lineClear = Promise.resolve()
		this.#lastReceived = Date.now()
		this.#answersKeepalive = false
		this.#outageLogged = false
		this.#options.log('info', `Connected to ${host}:${port}`)
		this.#status(InstanceStatus.Ok, 'Connected')
		this.#scheduleKeepalive()
		this.emit('connected')
	}

	/** Ends the session, if one is open: everything queued for it is rejected, and its timers stopped */
	#close(): void {
		const session = this.#session
		if (session === undefined) return
		this.#session = undefined
		clearTimeout(this.#keepaliveTimer)
		this.#keepaliveTimer = undefined
		session.abort(new Error('Connection to amplifier closed'))
		this.#lineClear = Promise.resolve()
		this.#reader.reset()
	}

	#closeSocket(): void {
		this.#close()
		// TCPHelper's destroy removes its listeners first, so the old socket can't report anything once replaced
		this.#socket?.destroy()
		this.#socket = undefined
	}

	#receive(chunk: Buffer): void {
		this.#lastReceived = Date.now()
		const { lines, discarded } = this.#reader.push(chunk)
		if (discarded > 0) this.#options.log('debug', `Discarded ${discarded} characters with no end of line`)
		for (const line of lines) {
			try {
				this.#handle(decodeLine(line))
			} catch (err) {
				// This runs in the socket's data listener, where a throw would end the module's process
				this.#options.log('error', `Could not handle ${line}: ${errorMessage(err)}`)
			}
		}
	}

	#handle(response: Response): void {
		switch (response.type) {
			case 'power':
			case 'overmute':
			case 'channelMute':
				this.emit('report', response)
				break
			case 'devstatus':
				this.#answersKeepalive = true
				this.#options.log('debug', `Device status: ${response.status}`)
				break
			case 'log':
				this.#options.log(response.level, response.message)
				break
			default:
				unhandledOption(response, undefined)
		}
	}

	#scheduleKeepalive(): void {
		clearTimeout(this.#keepaliveTimer)
		this.#keepaliveTimer = setTimeout(() => this.#keepalive(), this.#timing.keepaliveInterval)
	}

	#keepalive(): void {
		this.#keepaliveTimer = undefined
		const silence = Date.now() - this.#lastReceived
		if (this.#answersKeepalive && silence > this.#timing.keepaliveInterval * WATCHDOG_INTERVALS) {
			this.#options.log('warn', `Nothing received from amplifier for ${silence} ms, reconnecting`)
			this.connect()
			return
		}
		this.send(KEEPALIVE).catch((err) => this.#options.log('debug', `Keepalive not sent: ${errorMessage(err)}`))
		this.#scheduleKeepalive()
	}

	#status(status: InstanceStatus, message: string | null): void {
		if (this.#lastStatus?.status === status && this.#lastStatus.message === message) return
		this.#lastStatus = { status, message }
		this.emit('status', status, message)
	}

	#logOutage(level: LogLevel, message: string): void {
		this.#options.log(this.#outageLogged ? 'debug' : level, message)
		this.#outageLogged = true
	}
}
