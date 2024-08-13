import { Buffer } from 'node:buffer'
import { InstanceStatus, TCPHelper } from '@companion-module/base'
import { EOL, cmd, cmdType } from './consts.js'

export function queryOnConnect() {
	//function to make initial queries and start message command queue
	const x = '0'
	const y = '0'
	this.addCmdtoQueue(cmdType.get + cmdType.space + cmd.power + cmdType.space + x + cmdType.space + y)
	this.addCmdtoQueue(cmdType.get + cmdType.space + cmd.overMute + cmdType.space + x + cmdType.space + y)
	for (let i = 0; i < 4; i++) {
		this.addCmdtoQueue(cmdType.get + cmdType.space + cmd.channelMute + cmdType.space + i + cmdType.space + y)
	}
	this.startKeepAlive()
}

export function sendCommand(cmd) {
	if (cmd !== undefined) {
		if (this.socket !== undefined && this.socket.isConnected) {
			/*
			 * create a binary buffer pre-encoded 'latin1' (8bit no change bytes)
			 * sending a string assumes 'utf8' encoding
			 * which then escapes character values over 0x7F
			 * and destroys the 'binary' content
			 */
			const msg = Buffer.from(cmd + EOL, 'latin1')
			this.log('debug', `Sending message: ${msg}`)
			this.socket.send(msg)
			this.startKeepAlive()
		} else {
			this.log('warn', `Socket not connected, tried to send: ${cmd}`)
		}
	} else {
		this.log('warn', 'Command undefined')
	}
	return undefined
}

export function initTCP(host, port) {
	this.log('debug', 'initTCP')
	if (this.socket !== undefined) {
		this.socket.destroy()
		delete this.socket
	}
	if (host) {
		this.log('debug', 'Creating New Socket')

		this.updateStatus(InstanceStatus.Connecting, `Connecting to NXAMP : ${host}:${port}`)
		this.socket = new TCPHelper(this.config.host, this.config.port)

		this.socket.on('status_change', (status, message) => {
			this.updateStatus(status, message)
		})
		this.socket.on('error', (err) => {
			this.log('error', `Network error: ${err.message}`)
			this.updateStatus(InstanceStatus.ConnectionFailure, err.message)
			this.receiveBuffer = Buffer.from('')
		})
		this.socket.on('connect', () => {
			this.log('info', `Connected to NXAMP:  ${host}:${port}`)
			this.updateStatus(InstanceStatus.Ok, 'Connected')
			this.receiveBuffer = Buffer.from('')
			this.startCmdQueue()
			this.queryOnConnect()
		})
		this.socket.on('data', (chunk) => {
			//console.log (`Chunk Recieved: ${chunk}`)
			let i = 0,
				line = '',
				offset = 0
			this.receiveBuffer += chunk
			while ((i = this.receiveBuffer.indexOf(EOL, offset)) !== -1) {
				line = this.receiveBuffer.substring(offset, i)
				offset = i + 1
				this.processResponse(line.toString())
			}
			this.receiveBuffer = this.receiveBuffer.substring(offset)
		})
	} else {
		this.updateStatus(InstanceStatus.BadConfig)
	}
}
