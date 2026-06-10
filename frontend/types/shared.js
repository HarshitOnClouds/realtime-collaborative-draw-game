/**
 * @typedef {Object} DrawEvent
 * @property {'stroke_start' | 'stroke_move' | 'stroke_end' | 'clear' | 'undo'} type
 * @property {string} userId
 * @property {number} x
 * @property {number} y
 * @property {string} color
 * @property {number} brushSize
 * @property {number} timestamp
 * @property {string} strokeId
 */

/**
 * @typedef {Object} Player
 * @property {string} id
 * @property {string} name
 * @property {string} peerId
 * @property {string} color
 * @property {boolean} isConnected
 */

/**
 * @typedef {Object} Room
 * @property {string} id
 * @property {string} code
 * @property {string} hostId
 * @property {Player[]} players
 * @property {'waiting' | 'drawing' | 'replay' | 'ended'} status
 * @property {string} prompt
 * @property {DrawEvent[]} drawEvents
 * @property {number} timerDuration
 * @property {number} createdAt
 */

module.exports = {};
