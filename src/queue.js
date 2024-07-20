import { msg_delay } from './consts'

export function addCmdtoQueue(cmd) {
	if (cmd !== undefined) {
		if (this.cmdQueue === undefined) {
			this.cmdQueue = []
		}
		this.cmdQueue.push(cmd)
		return true
	}
	this.log('warn', `Invalid command: ${cmd}`)
	return false
}

export function processCmdQueue() {
	if (this.cmdQueue === undefined) {
		this.cmdQueue = []
	}
	if (this.cmdQueue.length > 0) {
		//dont send command if still waiting for response from last command
		this.sendCommand(this.cmdQueue.shift())
	}
	this.cmdTimer = setTimeout(() => {
		this.processCmdQueue()
	}, msg_delay)
}

export function stopCmdQueue() {
	if (this.cmdQueue) {
		clearTimeout(this.cmdQueue)
		delete this.cmdQueue
	}
}

export function startCmdQueue() {
	if (this.cmdQueue === undefined) {
		this.cmdQueue = []
	}
	this.cmdTimer = setTimeout(() => {
		this.processCmdQueue()
	}, msg_delay)
}
