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
            $secret = $_ENV['SUPABASE_JWT_SECRET'] ?? '';
            if ($secret === '') return self::deny('Server auth not configured');
            $decoded = self::verifySupabaseJwt($m[1], $secret);
            $userId = $decoded['sub'] ?? null;
            if (!$userId) return self::deny('Invalid claims');
            return $handler->handle($request->withAttribute('user_id', $userId));
        } catch (\Throwable $e) {
            return self::deny('Invalid token');
        }
    }

    /** @return array<string, mixed> */
    private static function verifySupabaseJwt(string $jwt, string $secret): array
    {
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) throw new \RuntimeException('Malformed token');

        [$encodedHeader, $encodedPayload, $encodedSignature] = $parts;
        $header = self::decodeJsonPart($encodedHeader);
        if (($header['alg'] ?? null) !== 'HS256') throw new \RuntimeException('Unsupported token algorithm');

        $expected = hash_hmac('sha256', $encodedHeader . '.' . $encodedPayload, $secret, true);
        $actual = self::base64UrlDecode($encodedSignature);
        if (!hash_equals($expected, $actual)) throw new \RuntimeException('Bad token signature');

        $payload = self::decodeJsonPart($encodedPayload);
        $now = time();
        if (isset($payload['exp']) && (int) $payload['exp'] <= $now) throw new \RuntimeException('Expired token');
        if (isset($payload['nbf']) && (int) $payload['nbf'] > $now) throw new \RuntimeException('Token not active');
        if (isset($payload['iat']) && (int) $payload['iat'] > $now + 60) throw new \RuntimeException('Token issued in future');

        return $payload;
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
