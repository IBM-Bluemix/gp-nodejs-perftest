/*      
 * Copyright IBM Corp. 2015
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// gp-config.json is required.
const process= require('process');
const argv = require('minimist')(process.argv.slice(2));
const configFile = argv.config || './gp-config.json';
const config = require(configFile);
const Cloudant = require('cloudant');
const GP = require('g11n-pipeline');
const pino = require('pino')({name: 'dumpCsv'});
const promtie = require('promtie');
const fsRaw = require('fs');
const fs = {
    writeFile: promtie.promisify(fsRaw.writeFile)
};
const cloudant = new Cloudant({
    account: config.cloudant.readerAccount || config.cloudant.account,
    key: config.cloudant.readerKey || config.cloudant.key,
    password: config.cloudant.readerPassword || config.cloudant.password
}, (err) => { if(err) pino.error(err); });
const db = promtie.promisifyAll(cloudant.db.use(config.cloudant.db));

const out = argv.out || './dump.csv';

pino.info('--out=%s', out);

db.list({include_docs: true})
.then(body => body.rows)
.then(rows => rows.map(row => { return {
     date: row.doc.date,
     commit: row.doc.info.commit,
     host: row.doc.info.host,
     store: row.doc.info.opts.store,
     storeHost: row.doc.info.opts.storeHost,
     test: row.doc.results.name,
     size: row.doc.results.params.size,
     count: row.doc.results.params.count,
     ms: row.doc.results.median,
     sd: row.doc.results.stDev
};}))
.then(rows => {
    pino.info(JSON.stringify(rows));
    return rows;
})
.then(rows => (require('to-csv'))(rows))
.then(data => fs.writeFile(out, data))
.then(x => pino.info('wrote',out), err => pino.error(err));
