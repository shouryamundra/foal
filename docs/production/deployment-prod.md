# Deploy on production

When deploying an application to production you need to:
- use https (or set `sessionCookieSecure` to `false` in `config/settings.production.json`),
- set the `NODE_ENV` environment variable to `production`,
- specify the name of your domain in `config/settings.production.json` with the property `sessionCookieDomain` (or use the env variable `SETTINGS_SESSION_COOKIE_DOMAIN` for that).
- use database migrations instead of the TypeORM `synchronize` feature (it auto creates database schema on every application launch). You can disable this feature by setting the env variable `TYPEORM_SYNCHRONIZE` to false.