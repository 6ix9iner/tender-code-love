<?php
declare(strict_types=1);

use App\Auth\JwtMiddleware;
use App\Cors\CorsMiddleware;
use App\Controllers\SummarizeController;
use App\Controllers\InsightsController;
use App\Controllers\GraphController;
use App\Controllers\SearchController;
use App\Controllers\SuggestLinksController;
use Slim\Factory\AppFactory;

require __DIR__ . '/../vendor/autoload.php';

if (file_exists(__DIR__ . '/../.env')) {
    \Dotenv\Dotenv::createImmutable(__DIR__ . '/..')->load();
}

$app = AppFactory::create();
$app->addBodyParsingMiddleware();
$app->add(new CorsMiddleware());
$app->options('/{routes:.+}', fn($req, $res) => $res);

$app->get('/health', function ($req, $res) {
    $res->getBody()->write(json_encode(['ok' => true]));
    return $res->withHeader('Content-Type', 'application/json');
});

$app->group('', function ($g) {
    $g->post('/summarize',         SummarizeController::class);
    $g->post('/insights/generate', InsightsController::class);
    $g->get('/graph',              GraphController::class);
    $g->get('/search',             SearchController::class);
    $g->post('/suggest-links',     SuggestLinksController::class);
})->add(new JwtMiddleware());

$app->run();
