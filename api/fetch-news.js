/**
 * Alias lama untuk cron news — dipertahankan agar URL /api/fetch-news tetap jalan.
 *
 * Implementasi sebenarnya ada di api/cron/fetch-news.js (jalur yang dipakai Vercel Cron).
 */

module.exports = require('./cron/fetch-news');
