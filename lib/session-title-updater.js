/**
 * Updates OpenCode session title with epic information
 * @param {Object} client - OpenCode SDK client
 * @param {string} sessionID - Session ID
 * @param {string} title - New title (can be multi-line with \n)
 * @returns {Promise<boolean>} True if successful
 */
export async function updateSessionTitle(client, sessionID, title) {
  try {
    await client.session.update({
      path: { sessionID },
      body: { title }
    });
    return true;
  } catch (error) {
    if (client) {
      client.app.log({
        body: {
          service: 'powerlevel',
          level: 'debug',
          message: `Failed to update session title: ${error.message}`
        }
      });
    }
    return false;
  }
}

/**
 * Gets current session info
 * @param {Object} client - OpenCode SDK client
 * @param {string} sessionID - Session ID
 * @returns {Promise<Object|null>} Session info or null if failed
 */
export async function getSessionInfo(client, sessionID) {
  try {
    const result = await client.session.get({
      path: { sessionID }
    });
    return result.data || null;
  } catch (error) {
    if (client) {
      client.app.log({
        body: {
          service: 'powerlevel',
          level: 'debug',
          message: `Failed to get session info: ${error.message}`
        }
      });
    }
    return null;
  }
}
