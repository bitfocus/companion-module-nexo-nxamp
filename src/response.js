import { cmd, cmdType } from './consts.js'
export function processResponse(msg) {
	const data = msg.split(cmdType.space)
	if (data[0] !== cmdType.ok) {
		this.log('info', `Recieved ${msg}`)
		return
	}
	if (data[1] === cmd.devstatus) {
		return
	}
	if (data[1] === cmdType.set || data[1] === cmdType.get) {
		if (data.length !== 6) {
			this.log('warn', `Invalid message length: ${msg}`)
			return
		}
		switch (data[2]) {
			case cmd.power:
				this.NXAMP.power = parseInt(data[5])
				this.checkFeedbacks('power')
				break
			case cmd.overMute:
				this.NXAMP.overmute = parseInt(data[5])
				this.checkFeedbacks('overMute')
				break
			case cmd.channelMute:
				this.NXAMP.mute[`ch${parseInt(data[3]) + 1}`] = parseInt(data[5])
				this.checkFeedbacks('channelMute')
				break
			default:
				this.log('debug', `Unrecognised message: ${msg}`)
		}
	}
}
