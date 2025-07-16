
const bcrypt = require('bcrypt');

// Utility om wachtwoorden te hashen
async function hashPassword(password) {
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);
    console.log(`Wachtwoord: ${password}`);
    console.log(`Hash: ${hash}`);
    return hash;
}

// Voorbeeld gebruik
if (process.argv[2]) {
    hashPassword(process.argv[2]);
} else {
    console.log('Gebruik: node hash-password.js "jouw-wachtwoord"');
}
