// src/utils/sessionManager.js
console.log('SessionManager loaded from:', __filename); 
const activeSessions = new Map();

function addSession(phoneNumber, sock) {
    if (!phoneNumber || !sock) {
        console.error('❌ Cannot add session: Missing phoneNumber or sock');
        return false;
    }
   // console.log(`➕ Adding session for ${phoneNumber}`, Object.keys(sock));
    activeSessions.set(phoneNumber, sock);
    return true;
}

function removeSession(phoneNumber) {
    if (!phoneNumber) return false;
   // console.log(`➖ Removing session for ${phoneNumber}`);
    return activeSessions.delete(phoneNumber);
}

function getActiveSessions() {
    const sessions = {};
    activeSessions.forEach((sock, phoneNumber) => {
        sessions[phoneNumber] = sock;
    });
   // console.log('📋 Active sessions:', Array.from(activeSessions.keys()));
    return sessions;
}

module.exports = {
    addSession,
    removeSession,
    getActiveSessions
};