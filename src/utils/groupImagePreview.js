const axios = require('axios');
/**
 * Fetch group profile picture as buffer
 */
async function getGroupProfilePicBuffer(sock, groupId) {
    try {
        const url = await sock.profilePictureUrl(groupId, 'image');
        if (!url) return null;

        const res = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(res.data);
    } catch (err) {
        console.warn('⚠️ Could not fetch group profile picture');
        return null;
    }
}

function getContextInfo({
    title,
    body,
    thumbnail,
    renderLargerThumbnail = true
}) {
    return {
        externalAdReply: {
            title,
            body,
            mediaType: 1,
            showAdAttribution: false,
            renderLargerThumbnail,
            thumbnail
        }
    };
}

module.exports = {
    getGroupProfilePicBuffer,
    getContextInfo
};