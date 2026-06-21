<?php
declare(strict_types=1);
namespace App\Controllers;
use App\Qwen\QwenClient;
use App\Supabase\Client as Supabase;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class SummarizeController
{
    public function __invoke(ServerRequestInterface $req, ResponseInterface $res): ResponseInterface
    {
        $userId = $req->getAttribute('user_id');
        $body = (array) $req->getParsedBody();
        $noteId = $body['note_id'] ?? null;
        if (!$noteId) return self::json($res, ['error' => 'note_id required'], 400);
        $sb = new Supabase();
        $rows = $sb->get('notes', [
            'id' => 'eq.' . $noteId,
            'user_id' => 'eq.' . $userId,
            'select' => 'id,title,content',
        ]);
        if (!$rows) return self::json($res, ['error' => 'not found'], 404);
        $note = $rows[0];
        $qwen = new QwenClient();
        $summary = trim($qwen->chat(
            "You are a study assistant. Summarize the student's note in 2-3 sentences. Focus on the core concept and any key formulas, dates, or definitions. Plain prose, no markdown.",
            "Title: {$note['title']}\n\n{$note['content']}"
        ));
        $sb->patch('notes', ['id' => 'eq.' . $noteId, 'user_id' => 'eq.' . $userId], ['summary' => $summary]);
        return self::json($res, ['summary' => $summary]);
    }
    public static function json(ResponseInterface $res, array $data, int $status = 200): ResponseInterface
    {
        $res->getBody()->write(json_encode($data));
        return $res->withStatus($status)->withHeader('Content-Type', 'application/json');
    }
}
