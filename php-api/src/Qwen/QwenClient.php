<?php
declare(strict_types=1);
namespace App\Qwen;
use GuzzleHttp\Client as Http;

final class QwenClient
{
    private Http $http;
    private string $model;
    public function __construct()
    {
        $key = $_ENV['DASHSCOPE_API_KEY'] ?? '';
        $this->model = $_ENV['QWEN_MODEL'] ?? 'qwen-max';
        $this->http = new Http([
            'base_uri' => 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/',
            'headers' => [
                'Authorization' => 'Bearer ' . $key,
                'Content-Type' => 'application/json',
            ],
            'timeout' => 60,
        ]);
    }
    public function chat(string $system, string $user, ?string $jsonMode = null): string
    {
        $body = [
            'model' => $this->model,
            'messages' => [
                ['role' => 'system', 'content' => $system],
                ['role' => 'user',   'content' => $user],
            ],
        ];
        if ($jsonMode) $body['response_format'] = ['type' => 'json_object'];
        $r = $this->http->post('chat/completions', ['json' => $body]);
        $j = json_decode((string) $r->getBody(), true);
        return $j['choices'][0]['message']['content'] ?? '';
    }
}
