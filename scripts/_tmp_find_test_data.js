// Temporary, read-only: finds media from the web E2E run. Removed after cleanup.
require('dotenv').config({ quiet: true });
const crypto = require('crypto');
const fs = require('fs');
const { Client } = require('pg');
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/\?.*$/, '') });
  await c.connect();
  const ids = (await c.query(`select id from "User" where phone like '9000%'`)).rows.map((r) => r.id);
  const q = async (label, sql) => {
    const rows = (await c.query(sql, [ids])).rows;
    console.log(label, rows.length, rows.slice(0, 1).map((r) => r.url));
    return rows.map((r) => r.url).filter(Boolean);
  };
  const urls = [
    ...(await q('post media', `select m.url from "PostMedia" m join "Post" p on p.id = m."postId" where p."userId" = any($1)`)),
    ...(await q('stories', `select "mediaUrl" url from "Story" where "userId" = any($1)`)),
    ...(await q('messages', `select "mediaUrl" url from "Message" where "senderId" = any($1) and "mediaUrl" is not null`)),
    ...(await q('user photos', `select "photoUrl" url from "User" where id = any($1) and "photoUrl" is not null`)),
    ...(await q('banners', `select "bannerUrl" url from "User" where id = any($1) and "bannerUrl" is not null`)),
  ];
  console.log('db urls total', urls.length, 'hosts', [...new Set(urls.map((u) => (u.startsWith('http') ? new URL(u).host : 'relative')))]);
  await c.end();

  const { CLOUDFLARE_R2_ACCOUNT_ID: acct, CLOUDFLARE_R2_ACCESS_KEY_ID: key, CLOUDFLARE_R2_SECRET_ACCESS_KEY: secret, CLOUDFLARE_R2_BUCKET_NAME: bucket } = process.env;
  if (!acct || !key) return console.log('no R2 credentials in .env');
  const s3 = new S3Client({ region: 'auto', endpoint: `https://${acct}.r2.cloudflarestorage.com`, credentials: { accessKeyId: key, secretAccessKey: secret } });
  const logoMd5 = crypto.createHash('md5').update(fs.readFileSync('../web/public/logo.png')).digest('hex');
  const since = new Date('2026-11-06T23:00:00Z');
  let token, total = 0;
  const recent = [];
  do {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
    (res.Contents || []).forEach((o) => {
      total++;
      if (o.LastModified >= since) recent.push({ key: o.Key, size: o.Size, at: o.LastModified.toISOString().slice(0, 16), logo: o.ETag.replace(/"/g, '') === logoMd5 });
    });
    token = res.NextContinuationToken;
  } while (token);
  const dbKeys = new Set(urls.filter((u) => u.startsWith('http')).map((u) => new URL(u).pathname.slice(1)));
  console.log('bucket objects', total, 'since session start', recent.length, 'identical to logo.png', recent.filter((o) => o.logo).length, 'referenced by test users', recent.filter((o) => dbKeys.has(o.key)).length);
  const other = recent.filter((o) => !o.logo && !dbKeys.has(o.key));
  console.log('recent, neither logo nor test-user media (would NOT touch):', other.length);
  console.table(other.slice(0, 10));
  fs.writeFileSync(process.env.TMP_OUT || 'NUL', JSON.stringify(recent.filter((o) => o.logo || dbKeys.has(o.key)).map((o) => o.key)));
})().catch((e) => { console.error(e.name, e.message); process.exit(1); });
