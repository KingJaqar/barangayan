import * as ExpoCrypto from 'expo-crypto';
import { installPKCECrypto } from './pkce-crypto';

const secureRandom: Crypto['getRandomValues'] = array => {
  if (array instanceof DataView || array instanceof Float32Array || array instanceof Float64Array) throw new TypeError('PKCE random values require an integer typed array.');
  if (array.byteLength > 65_536) throw new Error('Random values exceed the WebCrypto limit.');
  ExpoCrypto.getRandomValues(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
  return array;
};
installPKCECrypto(globalThis, secureRandom, async (algorithm, data) => {
  const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
  if (name.toUpperCase() !== 'SHA-256') throw new Error('Only SHA-256 is supported by the native PKCE adapter.');
  return ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, data);
});
