import { InstanceBase, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, validPort, type ModuleConfig } from './config.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions, type ActionSchema } from './actions.js'
import { FeedbackId, UpdateFeedbacks, type FeedbackSchema } from './feedbacks.js'
import { AmplifierConnection, Priority, queryAll, type Report } from './api/index.js'
import { errorMessage, unhandledOption } from './util.js'

export type ModuleTypes = {
	config: ModuleConfig
	secrets: undefined
	actions: ActionSchema
	feedbacks: FeedbackSchema
	/** The module defines none */
	variables: Record<string, never>
}

export { UpgradeScripts }

export default class NxampInstance extends InstanceBase<ModuleTypes> {
	config!: ModuleConfig // Setup in init()
	/** As the amplifier last reported it, or undefined until it has */
	power: boolean | undefined
	/** As the amplifier last reported it, or undefined until it has */
	overmute: boolean | undefined
	/** The mute on each channel, from 1, as the amplifier last reported it. A channel it hasn't reported is absent */
	readonly channelMutes = new Map<number, boolean>()
	#amplifier: AmplifierConnection | undefined

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		await this.configUpdated(config)
	}

	// When module gets deleted
	async destroy(): Promise<void> {
		this.log('debug', `destroy ${this.id}`)
		this.#closeAmplifier()
		this.updateStatus(InstanceStatus.Disconnected)
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config
		this.#closeAmplifier()
		// The host may be another amplifier
		this.power = undefined
		this.overmute = undefined
		this.channelMutes.clear()
		UpdateActions(this)
		UpdateFeedbacks(this)
		// Every feedback reads the state just cleared, and setting the definitions again rechecks none of them
		this.checkAllFeedbacks()
		this.#openAmplifier()
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	/**
	 * Queues a message for the amplifier, ahead of any queries still waiting
	 * @param signal an action's context.signal, so a message the user no longer wants is dropped before it is sent
	 */
	async send(message: string, signal?: AbortSignal): Promise<void> {
		if (this.#amplifier === undefined) throw new Error('Not connected to amplifier')
		await this.#amplifier.send(message, Priority.Action, signal)
	}

	#openAmplifier(): void {
		const host = this.config.host?.trim()
		const port = validPort(this.config.port)
		if (!host) {
			this.updateStatus(InstanceStatus.BadConfig, 'No host')
			return
		}
		if (port === undefined) {
			this.updateStatus(InstanceStatus.BadConfig, `Invalid port ${String(this.config.port)}`)
			return
		}
		const amplifier = new AmplifierConnection({ host, port, log: (level, message) => this.log(level, message) })
		amplifier.on('status', (status, message) => this.updateStatus(status, message))
		amplifier.on('connected', () => this.#onConnected(amplifier))
		amplifier.on('report', (report) => this.#onReport(report))
		this.#amplifier = amplifier
		amplifier.connect()
	}

	#closeAmplifier(): void {
		this.#amplifier?.destroy()
		this.#amplifier = undefined
	}

	#onConnected(amplifier: AmplifierConnection): void {
		// Anything may have changed while disconnected
		for (const message of queryAll()) {
			amplifier
				.send(message, Priority.Background)
				.catch((err) => this.log('debug', `${message} not sent: ${errorMessage(err)}`))
		}
	}

	#onReport(report: Report): void {
		switch (report.type) {
			case 'power':
				if (this.power === report.on) return
				this.power = report.on
				this.checkFeedbacks(FeedbackId.Power)
				break
			case 'overmute':
				if (this.overmute === report.on) return
				this.overmute = report.on
				this.checkFeedbacks(FeedbackId.Overmute)
				break
			case 'channelMute':
				if (this.channelMutes.get(report.channel) === report.muted) return
				this.channelMutes.set(report.channel, report.muted)
				this.checkFeedbacks(FeedbackId.ChannelMute)
				break
			default:
				unhandledOption(report, undefined)
		}
	}
}
