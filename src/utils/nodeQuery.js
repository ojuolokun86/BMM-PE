'use strict';

/**
 * WhatsApp default server JID
 */
const S_WHATSAPP_NET = 's.whatsapp.net';

/**
 * Generic low-level IQ query wrapper for Baileys sock.query()
 * @param {object} sock - Baileys socket instance
 * @param {object} options
 * @param {string} options.xmlns - XML namespace
 * @param {string} [options.type="get"] - IQ type (get/set/result/error)
 * @param {string} [options.to=S_WHATSAPP_NET] - target JID
 * @param {Array} [options.content=[]] - binary node content
 * @returns {Promise<object>} raw query result
 */
async function nodeQuery(sock, options = {}) {
    try {
        if (!sock || typeof sock.query !== 'function') {
            throw new Error('Invalid Baileys socket instance');
        }

        const {
            xmlns,
            type = 'get',
            to = S_WHATSAPP_NET,
            content = []
        } = options;

        if (!xmlns) {
            throw new Error('xmlns is required for nodeQuery');
        }

        const queryNode = {
            tag: 'iq',
            attrs: {
                xmlns,
                type,
                to
            },
            content
        };

        const result = await sock.query(queryNode);
        console.log('[nodeQuery] Result:', result);
        return result;

    } catch (error) {
        console.error('[nodeQuery] Error:', error.message);
        throw error;
    }
}

/**
 * Fetch profile picture metadata using low-level query
 * @param {object} sock - Baileys socket
 * @param {string} jid - user JID (e.g. 234xxx@s.whatsapp.net)
 * @returns {Promise<object>} raw response
 */
async function getProfilePicture(sock, jid) {
    try {
        if (!jid || typeof jid !== 'string') {
            throw new Error('Invalid JID provided');
        }

        return await nodeQuery(sock, {
            xmlns: 'w:profile:picture',
            type: 'get',
            to: S_WHATSAPP_NET,
            content: [
                {
                    tag: 'picture',
                    attrs: { jid }
                }
            ]
        });

    } catch (error) {
        console.error('[getProfilePicture] Error:', error.message);
        throw error;
    }
}

/**
 * Extract profile picture URL from raw binary node
 * @param {object} result - raw node result from sock.query()
 * @returns {string|null} picture URL or null
 */
function extractPictureUrl(result) {
    try {
        if (!result || !Array.isArray(result.content)) {
            return null;
        }

        const pictureNode = result.content.find(
            node => node.tag === 'picture'
        );

        if (!pictureNode || !pictureNode.attrs) {
            return null;
        }

        return pictureNode.attrs.url || null;

    } catch (error) {
        console.error('[extractPictureUrl] Error:', error.message);
        return null;
    }
}
async function testPing(sock) {
    try {
        const res = await sock.query({
            tag: 'iq',
            attrs: {
                to: 's.whatsapp.net',
                type: 'get',
                xmlns: 'w:p'
            },
            content: []
        });

        console.log('PING RESULT:', res);
        return res;

    } catch (err) {
        console.error('PING ERROR:', err);
    }
}

module.exports = {
    nodeQuery,
    getProfilePicture,
    extractPictureUrl,
    S_WHATSAPP_NET,
    testPing
};