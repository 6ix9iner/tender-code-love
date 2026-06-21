<?php
declare(strict_types=1);
namespace App\Auth;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
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
            $decoded = JWT::decode($m[1], new Key($secret, 'HS256'));
            $userId = $decoded->sub ?? null;
            if (!$userId) return self::deny('Invalid claims');
            return $handler->handle($request->withAttribute('user_id', $userId));
        } catch (\Throwable $e) {
            return self::deny('Invalid token');
        }
    }
    private static function deny(string $msg): ResponseInterface
    {
        $r = new Response(401);
        $r->getBody()->write(json_encode(['error' => $msg]));
        return $r->withHeader('Content-Type', 'application/json');
    }
}
