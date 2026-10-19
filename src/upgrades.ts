import type {
	CompanionStaticUpgradeProps,
	CompanionStaticUpgradeResult,
	CompanionStaticUpgradeScript,
	CompanionUpgradeContext,
} from '@companion-module/base'
import { DEFAULT_PORT } from './api/index.js'
import { validPort, type ModuleConfig } from './config.js'

/**
 * The port was a textinput before API 2.x, so a saved config holds a string, or the number default if never edited.
 * One that is not a usable port becomes the default.
 * @returns the config with the port a number, or null if it was one already
 */
export function upgradePortToNumber(config: ModuleConfig | null): ModuleConfig | null {
	if (config === null) return null
	const port: unknown = config.port
	if (typeof port === 'number') return null
	return { ...config, port: validPort(port) ?? DEFAULT_PORT }
}

export const UpgradeScripts: CompanionStaticUpgradeScript<ModuleConfig>[] = [
	/*
	 * Place your upgrade scripts here
	 * Remember that once it has been added it cannot be removed!
	 */

	// 0: API 2.x — the port became a number field. No action or feedback option changed type: the channel was a number
	// field already, and the on and off dropdowns keep their choice ids
	function (
		_context: CompanionUpgradeContext<ModuleConfig>,
		props: CompanionStaticUpgradeProps<ModuleConfig, undefined>,
	): CompanionStaticUpgradeResult<ModuleConfig, undefined> {
		return {
			updatedConfig: upgradePortToNumber(props.config),
			updatedActions: [],
			updatedFeedbacks: [],
		}
	},
]
