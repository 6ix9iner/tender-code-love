<?php
declare(strict_types=1);
namespace App\Cors;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

final class CorsMiddleware implements MiddlewareInterface
{
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $reqOrigin = $request->getHeaderLine('Origin');
        $configured = $_ENV['ALLOWED_ORIGIN'] ?? $_ENV['CORS_ALLOW_ORIGIN'] ?? '*';
        $allowed = array_map('trim', explode(',', $configured));

        if (in_array('*', $allowed, true)) {
            $allowOrigin = $reqOrigin !== '' ? $reqOrigin : '*';
        } elseif ($reqOrigin !== '' && in_array($reqOrigin, $allowed, true)) {
            $allowOrigin = $reqOrigin;
        } else {
            // permissive fallback for *.lovable.app / *.lovableproject.com previews
            $host = parse_url($reqOrigin, PHP_URL_HOST) ?? '';
            if ($host && (str_ends_with($host, '.lovable.app') || str_ends_with($host, '.lovableproject.com'))) {
                $allowOrigin = $reqOrigin;
            } else {
                $allowOrigin = $allowed[0] ?? '*';
            }
        }

        $response = $request->getMethod() === 'OPTIONS'
            ? new \Slim\Psr7\Response(204)
            : $handler->handle($request);

        return $response
            ->withHeader('Access-Control-Allow-Origin', $allowOrigin)
            ->withHeader('Vary', 'Origin')
            ->withHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            ->withHeader('Access-Control-Max-Age', '86400');
    }
}
