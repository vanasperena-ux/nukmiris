import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyRaw(raw: Buffer,signature: string,secret: Buffer): void {
  if (!Buffer.isBuffer(raw) || raw.length>1024*1024 || secret.length<16 || !/^sha256=[a-f0-9]{64}$/i.test(signature)) throw new Error('signature_rejected');
  const actual=Buffer.from(signature.slice(7),'hex');
  const expected=createHmac('sha256',secret).update(raw).digest();
  if (actual.length!==expected.length || !timingSafeEqual(actual,expected)) throw new Error('signature_rejected');
}
