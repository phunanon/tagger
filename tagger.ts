#!/usr/bin/node

import { readFileSync, writeFileSync, renameSync, existsSync } from 'fs';
import { exit } from 'process';

const args = process.argv.slice(2);
if (!args.length) {
  console.log(
    `Apply multiple tags to multiple files:
$ ./tagger.js File\ 1.opus File\ 2.opus album=Hyperdrama artist=Justice format=Opus mistake1 mistake2

Delete tag:
$ ./tagger.js r mistake1

Remove multiple tags from multiple files:
$ ./tagger.js r mistake2 File\ 1.opus

List files with all specified tags:
$ ./tagger.js album=Hyperdrama artist=Justice

List tags of specific files:
$ ./tagger.js

Undo last operation:
$ ./tagger.js undo

Apply tag to files with specific tags:
$ ./tagger.js album=Hyperdrama | xargs ./tagger.js format=Opus

Apply tags of specific file to other files:
$ ./tagger.js File\ 1.opus | xargs ./tagger.js File\ 2.opus

Get all tags for files with specific tags:
$ ./tagger.js album=Hyperdrama | xargs ./tagger.js

Apply tags of specific files by tag to specific files:
$ ./tagger.js album=Hyperdrama | xargs ./tagger.js | xargs ./tagger.js File\ 3.opus

And so on and so forth.`,
  );
  exit(0);
}

if (!existsSync('tags.json')) {
  writeFileSync('tags.json', '[]');
  console.log('Initialised tags.json');
}

if (args.some(a => a === 'undo')) {
  renameSync('tags.json', 'tags.undo.json');
  renameSync('tags.bak.json', 'tags.json');
  renameSync('tags.undo.json', 'tags.bak.json');
  console.log('Swapped tags.bak.json and tags.json');
  exit(0);
}

type Db = [string, string][];
const equal =
  ([a, b]: [string, string]) =>
  ([x, y]: [string, string]) =>
    a === x && b === y;
const escape = (path: string) => `"${path}"`;

const dbJson = readFileSync('tags.json').toString();
const db = JSON.parse(dbJson) as Db;
writeFileSync('tags.bak.json', dbJson);

const paths = args.filter(x => x.includes('.'));
const tags = args.filter(x => !x.includes('.') && x !== 'r');
const doRemove = args.some(a => a === 'r');
if (!paths.length && !doRemove) {
  function sieve(paths: string[], tags: string[]): string[] {
    const [tag, ...rest] = tags;
    if (!tag) return paths;
    const haveTag = paths.filter(p => db.some(a => a[0] === p && a[1] === tag));
    return sieve(haveTag, rest);
  }
  const paths = sieve([...new Set(db.map(a => a[0]))], tags);
  console.log(paths.map(escape).join('\n'));
  exit(0);
}

if (!tags.length) {
  const tags = new Set(db.filter(a => paths.includes(a[0])).map(a => a[1]));
  console.log(...[...tags].map(escape));
  exit(0);
}

const assocs = paths.flatMap(p => tags.map(t => [p, t] as [string, string]));

const newDb: Db = [];
if (doRemove) {
  if (assocs.length) {
    newDb.push(...db.filter(db => !assocs.some(equal(db))));
  } else {
    newDb.push(...db.filter(db => !tags.some(t => db[1] === t)));
  }
} else {
  newDb.push(...db);
  for (const assoc of assocs) {
    if (newDb.some(equal(assoc))) continue;
    newDb.push(assoc);
  }
}

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});
newDb.sort(([a, x], [b, y]) => {
  const compared = collator.compare(a, b);
  if (compared) return compared;
  return collator.compare(x, y);
});

writeFileSync('tags.json', JSON.stringify(newDb, null, 2));
console.log(newDb.length, 'associations');
