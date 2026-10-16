FROM composer:2 AS composer

FROM php:8.3-cli-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends git unzip libpq-dev libsqlite3-dev libxml2-dev libzip-dev libonig-dev \
    && docker-php-ext-install pdo_pgsql pdo_sqlite mbstring dom xml zip \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer /usr/bin/composer /usr/bin/composer
WORKDIR /var/www/html

EXPOSE 8000
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
