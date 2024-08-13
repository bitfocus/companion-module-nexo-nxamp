import { InstanceBase, runEntrypoint, InstanceStatus } from '@companion-module/base'
import UpgradeScripts from './upgrades.js'
import UpdateActions from './actions.js'
import UpdateFeedbacks from './feedbacks.js'
import UpdateVariableDefinitions from './variables.js'
import * as config from './config.js'
import * as keepAlive from './keepalive.js'
import * as queue from './queue.js'
import * as response from './response.js'
import * as tcp from './tcp.js'

class NXAMP extends InstanceBase {
	constructor(internal) {
		super(internal)
		Object.assign(this, { ...config, ...keepAlive, ...queue, ...response, ...tcp })
	}

	async init(config) {
		this.configUpdated(config)
	}

	async configUpdated(config) {
		this.config = config
		this.newNXAmp()
		this.updateStatus(InstanceStatus.Connecting)
		this.initTCP(this.config.host, this.config.port)
		this.updateActions() // export actions
		this.updateFeedbacks() // export feedbacks
		this.updateVariableDefinitions() // export variable definitions
	}

	// When module gets deleted
	async destroy() {
		this.log('debug', `destroy ${this.id}`)
		this.stopKeepAlive()
		this.stopCmdQueue()
		if (this.socket) {
			this.socket.destroy()
			delete this.socket
		}
	}

	newNXAmp() {
		if (this.NXAMP) {
			delete this.NXAMP
		}
		this.NXAMP = {
			power: null,
			overmute: null,
			mute: {
				ch1: null,
				ch2: null,
				ch3: null,
				ch4: null,
			},
		}
	}

	updateActions() {
		UpdateActions(this)
	}

	updateFeedbacks() {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions() {
		UpdateVariableDefinitions(this)
	}
}

runEntrypoint(NXAMP, UpgradeScripts)
