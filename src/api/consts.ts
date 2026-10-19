/** The amplifier's remote control port, which is Yamaha's RCP port */
export const DEFAULT_PORT = 49280

/** The amplifier's channels. They are numbered from 1 here, as users see them, and from 0 on the wire */
export const CHANNEL_COUNT = 4

/** Least time from sending one message to sending the next */
export const MESSAGE_GAP_MS = 5

export const KEEPALIVE_INTERVAL_MS = 30000

/** Matches TCPHelper's own default */
export const RECONNECT_INTERVAL_MS = 2000

/** Ends every message, both ways */
export const EOL = '\n'

/** Longer than any reply. A line still unterminated at this length is not one, and is dropped */
export const MAX_LINE_LENGTH = 4096

/** Queue priorities: a higher one is sent first, and messages of the same priority go in the order queued */
export enum Priority {
	/** Queries and keepalives */
	Background = 0,
	/** Anything a user is waiting on, so a button press doesn't wait behind the queries on connecting */
	Action = 1,
}

/** The parameters this module reads and writes. Each is 1 for on and 0 for off */
export enum Parameter {
	Power = 'AMP:Power',
	Overmute = 'AMP:Overmute',
	/** Its x is the channel, from 0 */
	ChannelMute = 'AMP:Ch/Mute',
}
