<?php
declare(strict_types=1);
namespace App\Controllers;
use App\Qwen\QwenClient;
use App\Supabase\Client as Supabase;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class SuggestLinksController
{
    public function __invoke(ServerRequestInterface $req, ResponseInterface $res): ResponseInterface
    {
        $userId = $req->getAttribute('user_id');
        $body = (array) $req->getParsedBody();
        $noteId = $body['note_id'] ?? null;
        if (!$noteId) return SummarizeController::json($res, ['error' => 'note_id required'], 400);
        $sb = new Supabase();
        $cur = $sb->get('notes', [
            'id' => 'eq.' . $noteId,
            'user_id' => 'eq.' . $userId,
            'select' => 'id,title,content',
        ]);
        if (!$cur) return SummarizeController::json($res, ['error' => 'not found'], 404);
        $note = $cur[0];
        $others = $sb->get('notes', [
            'user_id' => 'eq.' . $userId,
            'archived' => 'eq.false',
            'id' => 'neq.' . $noteId,
            'select' => 'id,title,summary',
            'limit' => 80,
        ]);
        $catalog = array_map(fn($n) => "{$n['id']} :: " . ($n['title'] ?? '') . ' :: ' . ($n['summary'] ?? ''), $others);
        $qwen = new QwenClient();
        $raw = $qwen->chat(
            'You suggest related notes from a catalog. Output JSON: {"suggestions":[{"id":"<uuid>","title":"...","reason":"..."}]}. Max 5. Only pick from the catalog.',
            "Current note:\nTitle: {$note['title']}\n\n{$note['content']}\n\nCatalog (id :: title :: summary):\n" . implode("\n", $catalog),
            'json'
        );
        $decoded = json_decode($raw, true);
        return SummarizeController::json($res, $decoded ?: ['suggestions' => []]);
    }
}
