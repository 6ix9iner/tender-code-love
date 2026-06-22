<?php
declare(strict_types=1);
namespace App\Auth;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Slim\Psr7\Response;

final class JwtMiddleware implements MiddlewareInterface
{
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $auth = $request->getHeaderLine('Authorization');
        if (!preg_match('/Bearer\s+(.+)/i', $auth, $m)) return self::deny('Missing bearer token');
        try {
            $decoded = self::verifySupabaseJwt($m[1]);
            $userId = $decoded['sub'] ?? null;
            if (!$userId) return self::deny('Invalid claims');
            return $handler->handle($request->withAttribute('user_id', $userId));
        } catch (\Throwable $e) {
            return self::deny('Invalid token: ' . $e->getMessage());
        }
    }

    /** @return array<string, mixed> */
    private static function verifySupabaseJwt(string $jwt): array
    {
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) throw new \RuntimeException('Malformed token');

        [$encodedHeader, $encodedPayload, $encodedSignature] = $parts;
        $header = self::decodeJsonPart($encodedHeader);
        $alg = $header['alg'] ?? '';
        $signingInput = $encodedHeader . '.' . $encodedPayload;
        $sig = self::base64UrlDecode($encodedSignature);

        if ($alg === 'HS256') {
            $secret = $_ENV['SUPABASE_JWT_SECRET'] ?? getenv('SUPABASE_JWT_SECRET') ?: '';
            if ($secret === '') throw new \RuntimeException('HS256 secret not configured');
            $expected = hash_hmac('sha256', $signingInput, $secret, true);
            if (!hash_equals($expected, $sig)) throw new \RuntimeException('Bad signature');
        } elseif ($alg === 'ES256' || $alg === 'RS256') {
            $kid = $header['kid'] ?? '';
            if ($kid === '') throw new \RuntimeException('Missing kid');
            $jwk = self::fetchJwk($kid);
            $pem = $alg === 'ES256' ? self::jwkEcToPem($jwk) : self::jwkRsaToPem($jwk);
            $derSig = $alg === 'ES256' ? self::ecRawToDer($sig) : $sig;
            $ok = openssl_verify($signingInput, $derSig, $pem, $alg === 'ES256' ? OPENSSL_ALGO_SHA256 : OPENSSL_ALGO_SHA256);
            if ($ok !== 1) throw new \RuntimeException('Bad signature');
        } else {
            throw new \RuntimeException('Unsupported alg ' . $alg);
        }

        $payload = self::decodeJsonPart($encodedPayload);
        $now = time();
        if (isset($payload['exp']) && (int) $payload['exp'] <= $now) throw new \RuntimeException('Expired token');
        if (isset($payload['nbf']) && (int) $payload['nbf'] > $now) throw new \RuntimeException('Token not active');
        if (isset($payload['iat']) && (int) $payload['iat'] > $now + 60) throw new \RuntimeException('Token issued in future');

        return $payload;
    }

    /** @return array<string, mixed> */
    private static function fetchJwk(string $kid): array
    {
        static $cache = null;
        static $cacheTime = 0;
        $url = rtrim($_ENV['SUPABASE_URL'] ?? getenv('SUPABASE_URL') ?: '', '/');
        if ($url === '') throw new \RuntimeException('SUPABASE_URL not set');
        if ($cache === null || (time() - $cacheTime) > 600) {
            $body = @file_get_contents($url . '/auth/v1/.well-known/jwks.json');
            if ($body === false) throw new \RuntimeException('JWKS fetch failed');
            $cache = json_decode($body, true);
            $cacheTime = time();
        }
        foreach (($cache['keys'] ?? []) as $k) {
            if (($k['kid'] ?? null) === $kid) return $k;
        }
        throw new \RuntimeException('Unknown kid');
    }

    /** @param array<string,mixed> $jwk */
    private static function jwkEcToPem(array $jwk): string
    {
        if (($jwk['kty'] ?? '') !== 'EC' || ($jwk['crv'] ?? '') !== 'P-256') throw new \RuntimeException('Bad EC key');
        $x = self::base64UrlDecode($jwk['x']);
        $y = self::base64UrlDecode($jwk['y']);
        if (strlen($x) !== 32 || strlen($y) !== 32) throw new \RuntimeException('Bad EC coords');
        // SubjectPublicKeyInfo for P-256
        $oid = hex2bin('301306072a8648ce3d020106082a8648ce3d030107');
        $pubBits = "\x00\x04" . $x . $y; // BIT STRING: 0 unused bits, uncompressed point
        $bitString = "\x03" . self::derLen(strlen($pubBits)) . $pubBits;
        $spki = "\x30" . self::derLen(strlen($oid . $bitString)) . $oid . $bitString;
        return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($spki), 64, "\n") . "-----END PUBLIC KEY-----\n";
    }

    /** @param array<string,mixed> $jwk */
    private static function jwkRsaToPem(array $jwk): string
    {
        $n = self::base64UrlDecode($jwk['n']);
        $e = self::base64UrlDecode($jwk['e']);
        $modulus = self::derInt($n);
        $exponent = self::derInt($e);
        $rsaKey = "\x30" . self::derLen(strlen($modulus . $exponent)) . $modulus . $exponent;
        $oid = hex2bin('300d06092a864886f70d0101010500');
        $bitString = "\x03" . self::derLen(strlen($rsaKey) + 1) . "\x00" . $rsaKey;
        $spki = "\x30" . self::derLen(strlen($oid . $bitString)) . $oid . $bitString;
        return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($spki), 64, "\n") . "-----END PUBLIC KEY-----\n";
    }

    private static function derInt(string $bytes): string
    {
        if (ord($bytes[0]) > 0x7f) $bytes = "\x00" . $bytes;
        return "\x02" . self::derLen(strlen($bytes)) . $bytes;
    }

    private static function derLen(int $len): string
    {
        if ($len < 0x80) return chr($len);
        $hex = ltrim(dechex($len), '0');
        if (strlen($hex) % 2) $hex = '0' . $hex;
        $bin = hex2bin($hex);
        return chr(0x80 | strlen($bin)) . $bin;
    }

    private static function ecRawToDer(string $sig): string
    {
        if (strlen($sig) !== 64) throw new \RuntimeException('Bad EC sig length');
        $r = ltrim(substr($sig, 0, 32), "\x00");
        $s = ltrim(substr($sig, 32), "\x00");
        if ($r === '' || ord($r[0]) > 0x7f) $r = "\x00" . $r;
        if ($s === '' || ord($s[0]) > 0x7f) $s = "\x00" . $s;
        $rEnc = "\x02" . self::derLen(strlen($r)) . $r;
        $sEnc = "\x02" . self::derLen(strlen($s)) . $s;
        return "\x30" . self::derLen(strlen($rEnc . $sEnc)) . $rEnc . $sEnc;
    }

    /** @return array<string, mixed> */
    private static function decodeJsonPart(string $part): array
    {
        $decoded = json_decode(self::base64UrlDecode($part), true);
        if (!is_array($decoded)) throw new \RuntimeException('Invalid token JSON');
        return $decoded;
    }

    private static function base64UrlDecode(string $value): string
    {
        $remainder = strlen($value) % 4;
        if ($remainder > 0) $value .= str_repeat('=', 4 - $remainder);
        $decoded = base64_decode(strtr($value, '-_', '+/'), true);
        if ($decoded === false) throw new \RuntimeException('Invalid token encoding');
        return $decoded;
    }

    private static function deny(string $msg): ResponseInterface
    {
        $r = new Response(401);
        $r->getBody()->write(json_encode(['error' => $msg]));
        return $r->withHeader('Content-Type', 'application/json');
    }
}
