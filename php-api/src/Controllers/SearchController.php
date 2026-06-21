<?php
declare(strict_types=1);
namespace App\Controllers;
use App\Supabase\Client as Supabase;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class SearchController
{
    public function __invoke(ServerRequestInterface $req, ResponseInterface $res): ResponseInterface
    {
        $userId = $req->getAttribute('user_id');
        $q = trim((string) ($req->getQueryParams()['q'] ?? ''));
        if ($q === '') return SummarizeController::json($res, ['results' => []]);
        $sb = new Supabase();
        $rows = $sb->get('notes', [
            'user_id' => 'eq.' . $userId,
            'archived' => 'eq.false',
            'search_tsv' => 'fts(english).' . $q,
            'select' => 'id,title,summary',
            'limit' => 30,
        ]);
        $results = array_map(fn($r) => [
            'id' => $r['id'],
            'title' => $r['title'],
            'snippet' => $r['summary'] ?? '',
        ], $rows);
        return SummarizeController::json($res, ['results' => $results]);
    }
}
