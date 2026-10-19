import { describe, expect, it } from 'vitest'
import type {
	CompanionMigrationAction,
	CompanionMigrationFeedback,
	CompanionStaticUpgradeProps,
	CompanionUpgradeContext,
	ExpressionOrValue,
	JsonValue,
} from '@companion-module/base'
import { UpgradeScripts, upgradePortToNumber } from '../upgrades.js'
import { ActionId } from '../actions.js'
import { FeedbackId } from '../feedbacks.js'
import type { ModuleConfig } from '../config.js'
import { actionDefinitions, fakeInstance, feedbackDefinitions } from './fixtures.js'

/**
 * Upgrade scripts are order-sensitive: a stored upgrade index records how far a configuration has been migrated,
 * so scripts may only ever be appended. Pin the index rather than taking the last entry, so appending a script
 * can't silently retarget this suite.
 */
const API2_SCRIPT_INDEX = 0
const EXPECTED_SCRIPT_COUNT = 1

// Options reach upgrade scripts already wrapped as ExpressionOrValue — Companion does that before running them
const v = (value: JsonValue): ExpressionOrValue<JsonValue> => ({ isExpression: false, value })

const config = (port: unknown): ModuleConfig => ({ host: '10.0.0.1', port }) as ModuleConfig

function run(
	savedConfig: ModuleConfig | null,
	actions: CompanionMigrationAction[] = [],
	feedbacks: CompanionMigrationFeedback[] = [],
) {
	return UpgradeScripts[API2_SCRIPT_INDEX]({} as CompanionUpgradeContext<ModuleConfig>, {
		config: savedConfig,
		secrets: null,
		actions,
		feedbacks,
	} satisfies CompanionStaticUpgradeProps<ModuleConfig, undefined>)
}

describe('API 2.x upgrade script', () => {
	it('sits at the index this suite targets', () => {
		// Appending a script is fine — bump EXPECTED_SCRIPT_COUNT. Never insert, reorder or remove one.
		expect(UpgradeScripts).toHaveLength(EXPECTED_SCRIPT_COUNT)
	})

	it('makes the port a number', () => {
		expect(run(config('49280')).updatedConfig?.port).toBe(49280)
		expect(run(config(' 4000 ')).updatedConfig?.port).toBe(4000)
		expect(run(null).updatedConfig).toBeNull()
	})

	it('leaves the actions and feedbacks as they were saved', () => {
		const actions: CompanionMigrationAction[] = [
			{ id: 'a1', controlId: 'bank-1', actionId: ActionId.Power, options: { power: v('1') } },
			{
				id: 'a2',
				controlId: 'bank-1',
				actionId: ActionId.ChannelMute,
				options: { channelMute: v(3), muteState: v('0') },
			},
		]
		const feedbacks: CompanionMigrationFeedback[] = [
			{ id: 'f1', controlId: 'bank-1', feedbackId: FeedbackId.ChannelMute, options: { channelMute: v(2) } },
		]
		const result = run(config(49280), actions, feedbacks)
		expect(result.updatedActions).toEqual([])
		expect(result.updatedFeedbacks).toEqual([])
	})
})

describe('upgradePortToNumber', () => {
	it('leaves a port that is a number already, as the default is until edited', () => {
		expect(upgradePortToNumber(config(49280))).toBeNull()
	})

	it.each(['', 'abc', '0', '70000', '20.5'])('replaces %j, which is no port, with the default', (port) => {
		expect(upgradePortToNumber(config(port))?.port).toBe(49280)
	})

	it('keeps everything else in the config', () => {
		expect(upgradePortToNumber(config('49281'))).toEqual(config(49281))
	})
})

describe('saved ids', () => {
	it('are kept for every action and feedback, each of which is defined', () => {
		expect(Object.values(ActionId).sort()).toEqual(['channelMute', 'overMute', 'power'])
		expect(Object.values(FeedbackId).sort()).toEqual(['channelMute', 'overMute', 'power'])
		expect(Object.keys(actionDefinitions(fakeInstance())).sort()).toEqual(Object.values(ActionId).sort())
		expect(Object.keys(feedbackDefinitions(fakeInstance())).sort()).toEqual(Object.values(FeedbackId).sort())
	})
})
