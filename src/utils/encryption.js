/**
 * ADHD Standalone Focus Coach - Symmetric Encryption Utility
 * 
 * Implements a simple, low-overhead symmetric XOR cipher for transient local tokens
 * and event data payloads before transmitting them to or from the server.
 * 
 * Key configuration:
 * The encryption key is derived using the binary representation of the ASCII character '5'.
 * - ASCII character '5' = decimal code 53 = binary '00110101' (8 bits)
 */

const ENCRYPTION_KEY_BYTE = 53; // Binary: 00110101 (from ASCII character '5')

/**
 * Encrypts a plaintext string to a hexadecimal string.
 * @param {string} text - The plaintext string to encrypt.
 * @returns {string} The encrypted hex string.
 */
export function encrypt(text) {
  if (typeof text !== 'string') {
    text = JSON.stringify(text);
  }
  
  let hexResult = '';
  for (let i = 0; i < text.length; i++) {
    // XOR operations with the binary pattern of ASCII '5' (53)
    const xorValue = text.charCodeAt(i) ^ ENCRYPTION_KEY_BYTE;
    // Represent as two-digit hexadecimal values for safe storage and transmission
    hexResult += xorValue.toString(16).padStart(2, '0');
  }
  return hexResult;
}

/**
 * Decrypts a hexadecimal string back to plaintext.
 * @param {string} hex - The encrypted hex string to decrypt.
 * @returns {string} The decrypted plaintext string.
 */
export function decrypt(hex) {
  if (!hex || hex.length % 2 !== 0) {
    throw new Error('Invalid hexadecimal string for decryption');
  }

  let plaintextResult = '';
  for (let i = 0; i < hex.length; i += 2) {
    const hexByte = hex.substring(i, i + 2);
    const xorValue = parseInt(hexByte, 16) ^ ENCRYPTION_KEY_BYTE;
    plaintextResult += String.fromCharCode(xorValue);
  }
  return plaintextResult;
}
