// SPDX-License-Identifier: MIT
// Throwaway signing keys for the tests: each as the encrypted key file genkey.mjs writes (at the lowest scrypt cost
// a key file may name, so a test opens it fast) and as the plain form a key file held before it was encrypted.
import { generateKeyPairSync } from "node:crypto";
import { encryptKey } from "../scripts/keyfile.mjs";

export const PASS = "throwaway passphrase";

/** { pub, secret, plain, file }: `secret` is the PKCS#8 base64 no output may hold, `file` the key file's text. */
export async function makeKey(pass = PASS) {
  const kp = generateKeyPairSync("ed25519");
  const der = kp.privateKey.export({ type: "pkcs8", format: "der" });
  const pub = kp.publicKey.export({ format: "jwk" }).x;
  const secret = der.toString("base64");
  const plain = Buffer.from(JSON.stringify({ pkcs8: secret, pub })).toString("base64");
  return { pub, secret, plain, file: await encryptKey(der, pass, { N: 2 ** 14 }) };
}

/** An `ask` that answers each passphrase prompt in turn (PASS once the list runs out) and records the prompts. */
export function answers(...list) {
  const asked = [];
  const ask = async (prompt) => {
    asked.push(prompt);
    return list.length ? list.shift() : PASS;
  };
  ask.asked = asked;
  return ask;
}
