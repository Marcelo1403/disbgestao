import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pub = publicKey.export({ format: 'jwk' });
const prv = privateKey.export({ format: 'jwk' });
if (!pub.x || !pub.y || !prv.d) throw new Error('Nao foi possivel gerar as chaves VAPID.');
const b64u = value => Buffer.from(value, 'base64url');
const rawPublic = Buffer.concat([Buffer.from([4]), b64u(pub.x), b64u(pub.y)]).toString('base64url');
console.log('VAPID_PUBLIC_KEY=' + rawPublic);
console.log('VAPID_PRIVATE_KEY=' + prv.d);
