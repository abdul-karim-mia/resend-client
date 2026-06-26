// TOTP (RFC 6238) implementation using Web Crypto (HMAC-SHA1).
// Used for optional two-factor authentication. Base32 per RFC 4648.

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** Generate a random base32 secret (default 20 bytes → 32 chars). */
export function generateSecret(bytes = 20): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return base32Encode(buf)
}

export function base32Encode(buf: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31]
  return out
}

function base32Decode(input: string): Uint8Array {
  const clean = input.replace(/=+$/, '').toUpperCase().replace(/\s/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

async function hotp(secret: string, counter: number): Promise<string> {
  const key = base32Decode(secret)
  const buf = new ArrayBuffer(8)
  const view = new DataView(buf)
  // counter is < 2^53; write as two 32-bit halves
  view.setUint32(0, Math.floor(counter / 0x100000000))
  view.setUint32(4, counter >>> 0)

  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  )
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, buf))
  const offset = sig[sig.length - 1]! & 0x0f
  const bin =
    ((sig[offset]! & 0x7f) << 24) |
    ((sig[offset + 1]! & 0xff) << 16) |
    ((sig[offset + 2]! & 0xff) << 8) |
    (sig[offset + 3]! & 0xff)
  return (bin % 1_000_000).toString().padStart(6, '0')
}

/** Verify a 6-digit TOTP code, allowing ±1 time step for clock drift. */
export async function verifyTotp(secret: string, code: string, period = 30): Promise<boolean> {
  const normalized = code.replace(/\s/g, '')
  if (!/^\d{6}$/.test(normalized)) return false
  const counter = Math.floor(Date.now() / 1000 / period)
  for (const drift of [-1, 0, 1]) {
    if (await hotp(secret, counter + drift) === normalized) return true
  }
  return false
}

/** Build an otpauth:// URI for QR enrollment. */
export function otpauthUri(secret: string, account: string, issuer = 'resend-client'): string {
  const label = encodeURIComponent(`${issuer}:${account}`)
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: '6', period: '30' })
  return `otpauth://totp/${label}?${params.toString()}`
}
