import type { CompanionInputFieldDropdown, CompanionInputFieldNumber, DropdownChoice } from '@companion-module/base'
import { CHANNEL_COUNT } from './api/index.js'

/** On or off. Strings, as they have been saved on buttons since before API 2.x */
export type OnOff = '1' | '0'

export const ON_OFF_CHOICES = [
	{ id: '1', label: 'On' },
	{ id: '0', label: 'Off' },
] as const satisfies DropdownChoice<OnOff>[]

export function isOnOff(value: unknown): value is OnOff {
	return ON_OFF_CHOICES.some((choice) => choice.id === value)
}

/**
 * In expression mode Companion matches the result to a choice loosely, so 1 and true give On, and 0 and false Off.
 * Anything else and the action is not run. Value mode is not checked, so the callbacks check again.
 */
function onOffOption<TKey extends string>(id: TKey, label: string): CompanionInputFieldDropdown<TKey, OnOff> {
	return {
		id,
		type: 'dropdown',
		label,
		choices: ON_OFF_CHOICES,
		default: ON_OFF_CHOICES[1].id,
		expressionDescription: 'Should return 1 for On, or 0 for Off',
	}
}

export const powerOption = onOffOption('power', 'Power')

export const overmuteOption = onOffOption('overmute', 'Overmute')

export const muteStateOption = onOffOption('muteState', 'Mute')

export const channelOption: CompanionInputFieldNumber<'channelMute'> = {
	id: 'channelMute',
	type: 'number',
	label: 'Channel',
	min: 1,
	max: CHANNEL_COUNT,
	default: 1,
	range: true,
	step: 1,
	asInteger: true,
	expressionDescription: `Should return a channel number, 1 to ${CHANNEL_COUNT}`,
}
