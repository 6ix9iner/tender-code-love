<?php
declare(strict_types=1);
namespace App\Controllers;
use App\Qwen\QwenClient;
use App\Supabase\Client as Supabase;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class InsightsController
{
    public function __invoke(ServerRequestInterface $req, ResponseInterface $res): ResponseInterface
    {
        $userId = $req->getAttribute('user_id');
        $sb = new Supabase();
        $notes = $sb->get('notes', [
            'user_id' => 'eq.' . $userId,
            'archived' => 'eq.false',
            'select' => 'id,title,summary,updated_at,last_viewed_at',
            'order' => 'updated_at.desc',
            'limit' => 50,
        ]);
        $titles = array_map(fn($n) => '- ' . ($n['title'] ?? 'Untitled'), $notes);
        $payload = [];
        if (count($notes) > 0) {
            $qwen = new QwenClient();
            $raw = $qwen->chat(
                "You analyze a student's recent notes and produce a JSON object with three arrays: frequent_topics (string[]), suggested_focus (string[]), revision_candidates (string[]). Be concise, max 5 items each.",
                "Recent notes:\n" . implode("\n", $titles),
                'json'
            );
            $decoded = json_decode($raw, true);
            $payload = is_array($decoded) ? $decoded : ['raw' => $raw];
        }
        $sb->insert('insights', [[
            'user_id' => $userId,
            'kind' => 'study_summary',
            'payload' => $payload,
        ]]);
        return SummarizeController::json($res, ['ok' => true]);
    }
}
