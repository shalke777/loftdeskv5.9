const { timingSafeEqual } = require('node:crypto')

function isPrivateMode() { return process.env.LOFTDESK_PRIVATE_MODE === 'true' }
function privateOwnerAllowed(userId) {
  if (!isPrivateMode()) return true
  return Boolean(process.env.LOFTDESK_OWNER_USER_ID && userId === process.env.LOFTDESK_OWNER_USER_ID)
}
function secretMatches(provided, expected) {
  if (!provided || !expected) return false
  const left = Buffer.from(provided)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}
module.exports = { isPrivateMode, privateOwnerAllowed, secretMatches }
