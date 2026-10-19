import { describe, expect, it } from 'vitest'
import { GetConfigFields, validPort, type ModuleConfig } from '../config.js'
import { DEFAULT_PORT } from '../api/index.js'

describe('config fields', () => {
	it('keep the ids saved in existing configs, one for each config key, after the information text', () => {
		const [info, ...fields] = GetConfigFields()
		expect(info).toMatchObject({ type: 'static-text', id: 'info', width: 12 })
		const keys: (keyof ModuleConfig)[] = ['host', 'port']
		expect(fields.map((field) => field.id)).toEqual(keys)
	})

	it('make the port a number field defaulting to 49280', () => {
		expect(GetConfigFields().find((field) => field.id === 'port')).toMatchObject({
			type: 'number',
			default: DEFAULT_PORT,
			min: 1,
			max: 65535,
		})
		expect(DEFAULT_PORT).toBe(49280)
	})
})

describe('validPort', () => {
	it('accepts a whole number from 1 to 65535, as a number or text', () => {
		expect(validPort(49280)).toBe(49280)
		expect(validPort('49281')).toBe(49281)
		expect(validPort(65535)).toBe(65535)
	})

	it.each([0, 65536, 20.5, '', 'abc', undefined, null])('rejects %j', (port) => {
		expect(validPort(port)).toBeUndefined()
	})
})
