FROM php:8.3-cli-alpine
RUN apk add --no-cache git unzip libzip-dev oniguruma-dev \
    && docker-php-ext-install zip
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /app
COPY composer.json composer.lock* ./
RUN composer install --no-dev --optimize-autoloader --no-interaction
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "php -S 0.0.0.0:${PORT} -t public public/index.php"]
