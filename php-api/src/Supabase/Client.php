<?php
declare(strict_types=1);
namespace App\Supabase;
use GuzzleHttp\Client as Http;

final class Client
{
    private Http $http;
    public function __construct()
    {
        $url = rtrim($_ENV['SUPABASE_URL'] ?? '', '/');
        $key = $_ENV['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
        $this->http = new Http([
            'base_uri' => $url . '/rest/v1/',
            'headers' => [
                'apikey' => $key,
                'Authorization' => 'Bearer ' . $key,
                'Content-Type' => 'application/json',
                'Prefer' => 'return=representation',
            ],
            'timeout' => 30,
        ]);
    }
    public function get(string $path, array $query = []): array
    {
        $r = $this->http->get($path, ['query' => $query]);
        return json_decode((string) $r->getBody(), true) ?? [];
    }
    public function patch(string $path, array $query, array $body): array
    {
        $r = $this->http->patch($path, ['query' => $query, 'json' => $body]);
        return json_decode((string) $r->getBody(), true) ?? [];
    }
    public function insert(string $path, array $body): array
    {
        $r = $this->http->post($path, ['json' => $body]);
        return json_decode((string) $r->getBody(), true) ?? [];
    }
}
