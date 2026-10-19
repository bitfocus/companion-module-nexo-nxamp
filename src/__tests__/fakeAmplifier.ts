import { createServer, type Server, type Socket } from 'node:net'

// Written out here rather than taken from the module under test
const PARAMETERS = new Set(['AMP:Power', 'AMP:Overmute', 'AMP:Ch/Mute'])

export interface ReceivedLine {
	/** performance.now() on arrival */
	at: number
	/** Which connection it came on, counting from 1 */
	connection: number
	line: string
}

/**
 * An NXAMP on a loopback TCP port, for the module to connect to. It answers a get or a set in the form the module has
 * parsed since 2.1.0, such as `OK get AMP:Power 0 0 1`, and the keepalive as Yamaha RCP devices do. None of this was
 * captured from an amplifier, so it is what the module expects rather than a record of what an amplifier does.
 */
export class FakeAmplifier {
	readonly received: ReceivedLine[] = []
	/** Parameter values by `<parameter> <x> <y>`. One never set reads 0 */
	readonly values = new Map<string, string>()
	port = 0
	/** Connections accepted so far */
	connections = 0
	/** Off, the socket stays open but nothing is answered, as when the amplifier dies or a cable is pulled mid-path */
	answering = true
	/** Whether the keepalive (devstatus runmode) is answered */
	answersKeepalive = true
	readonly #server: Server
	readonly #sockets = new Set<Socket>()
	readonly #buffers = new Map<Socket, string>()

	constructor() {
		this.#server = createServer((socket) => {
			this.connections++
			const connection = this.connections
			this.#sockets.add(socket)
			this.#buffers.set(socket, '')
			socket.setEncoding('latin1')
			socket.on('data', (chunk: string) => this.#onData(socket, connection, chunk))
			socket.on('close', () => {
				this.#sockets.delete(socket)
				this.#buffers.delete(socket)
			})
			socket.on('error', () => {})
		})
	}

	async listen(): Promise<void> {
		await new Promise<void>((resolve) => this.#server.listen(0, '127.0.0.1', resolve))
		const address = this.#server.address()
		if (!address || typeof address === 'string') throw new Error('fake amplifier did not get a port')
		this.port = address.port
	}

	async close(): Promise<void> {
		this.dropConnections()
		await new Promise<void>((resolve) => this.#server.close(() => resolve()))
	}

	get openConnections(): number {
		return this.#sockets.size
	}

	/** Closes every connection from the amplifier's end */
	dropConnections(): void {
		for (const socket of this.#sockets) socket.destroy()
	}

	/** Writes to every connection, as is, so the caller supplies the end of line */
	broadcast(text: string): void {
		for (const socket of this.#sockets) socket.write(text)
	}

	/** Every line received, optionally only those on one connection */
	lines(connection?: number): string[] {
		return this.received.filter((r) => connection === undefined || r.connection === connection).map((r) => r.line)
	}

	#onData(socket: Socket, connection: number, chunk: string): void {
		const lines = ((this.#buffers.get(socket) ?? '') + chunk).split('\n')
		this.#buffers.set(socket, lines.pop() ?? '')
		for (const line of lines) {
			this.received.push({ at: performance.now(), connection, line })
			const reply = this.#answer(line)
			if (reply !== undefined && this.answering && !socket.destroyed) socket.write(`${reply}\n`)
		}
	}

	#answer(line: string): string | undefined {
		const [action, parameter, x, y, value] = line.split(' ')
		if (action === 'devstatus' && parameter === 'runmode') {
			return this.answersKeepalive ? 'OK devstatus runmode "normal"' : undefined
		}
		if ((action !== 'get' && action !== 'set') || !PARAMETERS.has(parameter)) return `ERROR ${action} UnknownAddress`
		const address = `${parameter} ${x} ${y}`
		if (action === 'set') this.values.set(address, value)
		return `OK ${action} ${address} ${this.values.get(address) ?? '0'}`
	}
}

/** A port nothing is listening on */
export async function closedPort(): Promise<number> {
	const amplifier = new FakeAmplifier()
	await amplifier.listen()
	const { port } = amplifier
	await amplifier.close()
	return port
}
