<?php
declare(strict_types=1);
namespace App\Controllers;
use App\Supabase\Client as Supabase;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class GraphController
{
    public function __invoke(ServerRequestInterface $req, ResponseInterface $res): ResponseInterface
    {
        $userId = $req->getAttribute('user_id');
        $sb = new Supabase();
        $notes = $sb->get('notes', [
            'user_id' => 'eq.' . $userId,
            'archived' => 'eq.false',
            'select' => 'id,title',
        ]);
        $links = $sb->get('note_links', [
            'user_id' => 'eq.' . $userId,
            'select' => 'from_note_id,to_note_id',
        ]);
        $nodes = array_map(fn($n) => ['id' => $n['id'], 'title' => $n['title'], 'tags' => []], $notes);
        $edges = array_map(fn($l) => ['source' => $l['from_note_id'], 'target' => $l['to_note_id'], 'kind' => 'link'], $links);
        return SummarizeController::json($res, ['nodes' => $nodes, 'edges' => $edges]);
    }
}
