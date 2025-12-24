// const supabase = require('../supabaseClient');
// const { BufferJSON } = require('@whiskeysockets/baileys');

// const SERVER_ID = process.env.SERVER_ID || 'default';
// console.log('Using SERVER_ID:', SERVER_ID);

// async function saveSessionToSupabase(authId, phoneNumber, { creds, keys }) {
//     console.log(`${phoneNumber} - Saving session to Supabase... with $ creds: ${creds ? Object.keys(creds).length : 0}, keys: ${keys ? Object.keys(keys).length : 0}`);
//     try {
//         if (!creds || typeof creds !== 'object') {
//             console.warn(`⚠️ Skipping save for ${phoneNumber}: Invalid creds`);
//             return;
//         }
//         if (!keys || typeof keys !== 'object') {
//             console.warn(`⚠️ Skipping save for ${phoneNumber}: Invalid keys`);
//             return;
//         }
//         const serializedKeys = {};
//         for (const category in keys) {
//             serializedKeys[category] = {};
//             for (const id in keys[category]) {
//                 serializedKeys[category][id] = JSON.stringify(keys[category][id], BufferJSON.replacer);
//             }
//         }
//         const { error } = await supabase
//             .from('sessions')
//             .upsert({
//                 phoneNumber,
//                 authId,
//                 creds: JSON.stringify(creds, BufferJSON.replacer),
//                 keys: JSON.stringify(serializedKeys),
//                 server_id: SERVER_ID,
//             });
//         if (error) throw new Error(error.message);
//         console.log(`✅ Session saved to Supabase for ${phoneNumber}`);
//     } catch (err) {
//         console.error(`❌ Failed to save session for ${phoneNumber}:`, err.message);
//     }
// }

// async function loadSessionFromSupabase(phoneNumber) {
//     try {
//         const { data, error } = await supabase
//             .from('sessions')
//             .select('creds, keys, server_id, authId')
//             .eq('phoneNumber', phoneNumber)
//             .eq('server_id', SERVER_ID)
//             .single();
//         if (error?.code === 'PGRST116') return null;
//         if (error) throw new Error(error.message);
//         if (!data) return null;
//         const creds = JSON.parse(data.creds, BufferJSON.reviver);
//         const rawKeys = JSON.parse(data.keys);
//         const keys = {};
//         for (const category in rawKeys) {
//             keys[category] = {};
//             for (const id in rawKeys[category]) {
//                 keys[category][id] = JSON.parse(rawKeys[category][id], BufferJSON.reviver);
//             }
//         }
//         console.log('🔍 Loaded app-state-sync-key IDs:', Object.keys(keys['app-state-sync-key'] || {}));
//         return { creds, keys, authId: data.authId };
//     } catch (err) {
//         console.error(`❌ Could not load session for ${phoneNumber}:`, err.message);
//         return null;
//     }
// }

// async function deleteSessionFromSupabase(phoneNumber) {
//     try {
//         const { error } = await supabase
//             .from('sessions')
//             .delete()
//             .eq('phoneNumber', phoneNumber)
//             .eq('server_id', SERVER_ID);
//         if (error) throw new Error(error.message);
//         console.log(`✅ Session deleted for ${phoneNumber}`);
//     } catch (err) {
//         console.error(`❌ Could not delete session for ${phoneNumber}:`, err.message);
//     }
// }

// async function loadAllSessionsFromSupabase() {
//     try {
//         const { data, error } = await supabase
//             .from('sessions')
//             .select('phoneNumber, authId, creds, keys, server_id')
//             .eq('server_id', SERVER_ID); 
//         if (error) throw new Error(error.message);
//         return data || [];
//     } catch (err) {
//         console.error('❌ Could not load all sessions from Supabase:', err.message);
//         return [];
//     }
// }
// async function getSessionFromSupabase(authId, phoneNumber) {
//     const { data, error } = await supabase
//       .from('sessions')
//       .select('*')
//       .eq('authId', authId)
//       .eq('phoneNumber', phoneNumber)
//       .single();
//     if (error || !data) throw new Error('Session not found in Supabase');
//     return data;
//   }
// module.exports = {
//     saveSessionToSupabase,
//     loadSessionFromSupabase,
//     deleteSessionFromSupabase,
//     loadAllSessionsFromSupabase,
//     getSessionFromSupabase,
// };