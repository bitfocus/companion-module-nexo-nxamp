import { vi } from 'vitest'
import type {
	CompanionActionCallbackContext,
	CompanionActionDefinitions,
	CompanionActionEvent,
	CompanionFeedbackBooleanEvent,
	CompanionFeedbackCallbackContext,
	CompanionFeedbackDefinitions,
	CompanionOptionValues,
} from '@companion-module/base'
import type NxampInstance from '../main.js'
import { UpdateActions, type ActionId, type ActionSchema } from '../actions.js'
import { UpdateFeedbacks, type FeedbackId, type FeedbackSchema } from '../feedbacks.js'

function createMocks() {
	return {
		send: vi.fn<NxampInstance['send']>(async () => {}),
		setActionDefinitions: vi.fn<(defs: CompanionActionDefinitions<ActionSchema>) => void>(),
		setFeedbackDefinitions: vi.fn<(defs: CompanionFeedbackDefinitions<FeedbackSchema>) => void>(),
	}
}

export type FakeInstance = { self: NxampInstance } & ReturnType<typeof createMocks>

/**
 * A plain object standing in for the instance, for the definitions to be built from. The amplifier state is real;
 * everything that would reach Companion or the amplifier is a mock.
 */
export function fakeInstance(): FakeInstance {
	const mocks = createMocks()
	const self = {
		power: undefined,
		overmute: undefined,
		channelMutes: new Map<number, boolean>(),
		...mocks,
	} as unknown as NxampInstance
	return { self, ...mocks }
}

export function actionDefinitions(fake: FakeInstance): CompanionActionDefinitions<ActionSchema> {
	UpdateActions(fake.self)
	return fake.setActionDefinitions.mock.calls[0][0]
}

export function feedbackDefinitions(fake: FakeInstance): CompanionFeedbackDefinitions<FeedbackSchema> {
	UpdateFeedbacks(fake.self)
	return fake.setFeedbackDefinitions.mock.calls[0][0]
}

// The definitions' hooks are typed per action. These take any options, as the values Companion passes are not checked
type AnyCallback = (event: CompanionActionEvent, context: CompanionActionCallbackContext) => Promise<void> | void
type AnyFeedbackCallback = (event: CompanionFeedbackBooleanEvent, context: CompanionFeedbackCallbackContext) => boolean

/** Runs an action's callback as Companion would, with the option values already resolved */
export async function runAction(
	defs: CompanionActionDefinitions<ActionSchema>,
	actionId: ActionId,
	options: CompanionOptionValues,
	signal = new AbortController().signal,
): Promise<void> {
	const def = defs[actionId]
	if (!def) throw new Error(`${actionId} is not defined`)
	const event: CompanionActionEvent = {
		id: `action-${actionId}`,
		controlId: 'bank-1',
		actionId,
		surfaceId: undefined,
		options,
	}
	await (def.callback as AnyCallback)(event, { type: 'action', signal } as never)
}

export function checkFeedback(
	defs: CompanionFeedbackDefinitions<FeedbackSchema>,
	feedbackId: FeedbackId,
	options: CompanionOptionValues = {},
): boolean {
	const def = defs[feedbackId]
	if (!def) throw new Error(`${feedbackId} is not defined`)
	const event: CompanionFeedbackBooleanEvent = {
		type: 'boolean',
		id: `feedback-${feedbackId}`,
		controlId: 'bank-1',
		feedbackId,
		options,
		previousOptions: null,
	}
	return (def.callback as AnyFeedbackCallback)(event, { type: 'feedback', signal: new AbortController().signal })
}
