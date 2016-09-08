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
const configCloudantFile = argv.configCloudant || './gp-config-cloudant.json';
const configCloudant = require(configCloudantFile);
const Cloudant = require('cloudant');
const GP = require('g11n-pipeline');
const pino = require('pino')();
const promtie = require('promtie');
const properties = require('properties-parser');
const statsAnalysis = require('stats-analysis');
const url = require('url');
const hrtimeMili = require('hrtime-mili');
const fsRaw = require('fs');
const request = require('request-promise-native');
const fs = {
    readFile: promtie.promisify(fsRaw.readFile)
};
const gitHead = promtie.promisify(require('git-head'));

const testData = require('./testData');
const cloudant = new Cloudant(configCloudant.cloudant, (err) => { if(err) pino.error(err); });
const db = cloudant.db.use(configCloudant.cloudant.db);


process.on('unhandledRejection', (reason) => {
    pino.error({unhandledRejection: reason});
});

// promise for git head
const commitInfo = new Promise( (resolve, reject) => {
        if(config.credentials.src) {
            // fetch from local dir
            pino.debug('Git info: '+ config.credentials.src);
            return resolve(gitHead(config.credentials.src+'/.git'));
        } else {
            const serverVersionUrl = url.resolve(config.credentials.url, './version');

            const serverVersionObj = 
            Promise.resolve(serverVersionUrl)
            .then(u => { pino.debug({fetching: u}); return u })
            .then(request)
            .then(resp => { pino.debug(resp); return resp; })
            .then(resp => JSON.parse(resp));

            // fetch git hash
            return serverVersionObj
            .then(o => o.components['gaas-translate'].source)
            .then(hash => resolve(hash));
        }
});

const serverConfig =
    Promise.resolve(config.credentials["server.env"])
        .then(function(fn) {
            if(fn) {
                pino.debug({reading: fn});
                return new Promise((resolve, reject) => {
                    properties.read(config.credentials["server.env"],
                        (err, props) => {if(err) return reject(err); return resolve(props);}
                    );
                });
            } else {
                // more stuff from serverVersionObj if needed.
                return Promise.resolve({
                    CLOUDANT_ACCOUNT: '(something)',
                    STORE_PROVIDER: 'cloudant'
                }); // empty settings
            }
        });

const serverOpts = serverConfig
                .then((props) => {return{
                    store: props.STORE_PROVIDER || "cloudant",
                    storeHost: (url.parse(props.CLOUDANT_ACCOUNT||"").hostname) || ((props.CLOUDANT_ACCOUNT||"<none>")+'.cloudant.com')
                }});

/**
 * Crufty promisified call into the low level REST api…
 */
function adminCall(client, api, param) {
    return new Promise((resolve, reject) => {
        pino.debug('adminCall: ', api, param);
        client.ready(param, function(err, param, apis) {
            if(err) { pino.error(err); return reject(err); }
            pino.debug(api, param);
            apis.admin[api](param, function onSuccess(o) {
                if(o.obj.status !== 'SUCCESS') {
                    return reject(Error(o.obj.status));
                } else {
                    return resolve(o.obj);
                }
            }, function onFailure(o) {
                return reject(Error(o));
            });
        });
    });
}

/**
 * Globalization Pipeline. As a promise.
 */
const gp = Promise.resolve({credentials: config.credentials})
    .then(opts => GP.getClient(opts))
    .then(client => {
        if(client._options.credentials.admin) {
            const newInstanceData = {
                serviceInstanceId: client._options.credentials.instanceId,
                body: {
                    serviceId: '0xDEADBEEF',
                    orgId: '0xDEADBEEF',
                    spaceId: '0xDEADBEEF',
                    planId: '0xDEADBEEF',
                    disabled: false
                }
            };
            pino.debug('Going to create ',newInstanceData);
            return adminCall(client, 'getServiceInstanceInfo', 
                {serviceInstanceId: client._options.credentials.instanceId})
            .then(info => pino.debug('Service Instance already OK,not re-creating', client._options.credentials.instanceId),
                    err => { return adminCall(client, 'createServiceInstance', newInstanceData); })
            .then(x => {  return Promise.resolve(client); });
        } else {
            // normal- you’re all set.
            return Promise.resolve(client);
        }
    })
    .then(client => {
        // const pClient = promtie.promisifyAll(client);
        // return pClient.bundles({})
        return new Promise((resolve,reject) => {
            client.bundles({}, (err, bundles) => {
                if(err) return reject(err);
                return resolve(bundles);
            });
        })
        .then(bundles => Object.keys(bundles||[]))
        .then(bundles => {
            // client.bundles({}, (err,data) => console.log(Object.keys(data)));
            pino.info({deleting: bundles});
            return bundles;
        })
        .then(promtie.map(subBundle => new Promise((resolve,reject) => {
            client.bundle(subBundle).delete({}, (err, data) => {
                if(err) return reject(err);
                return resolve(data);
            });
        })))
        .then(promtie.settle)
        .then(x => {
            pino.debug('OK, settled', x);
            return Promise.resolve(client);
        });
    });
   /* .then(client => {
        pino.info('Got clinet');
        return promtie.promisify(client.ping)({})
        .then(p => pino.info(p),true)
        .then(p => Promise.resolve(client));
    })*/;


// ———

// Get our config info
const info = promtie.values({
    host: url.parse(config.credentials.url).host,
    commit: commitInfo,
    opts: serverOpts
})
.then(promtie.values);

// Dump out the output, just for information
info
.then(result => pino.info({info: result}), err => pino.error(err));

// verify GP is OK
gp
.then(x => pino.debug('Client OK: '));


// ———————

// our bundle
const bundle = gp.then((client) => client.bundle('testBundle'), err => pino.error(err));


function nullTest(params) {
    return Promise.resolve((cb,n) => {
        cb(null,n);
    });
}

/**
 * These return a  test function.
 * The test function takes one parameter, (cb(err))
 */
function writeData(params) {
    const td = testData(params.size);

    return bundle
    .then(bundle => Promise.resolve((cb, n) => {
        // cb(null,n);
        bundle.uploadStrings({
            languageId: 'en',
            strings: td
        }, (err, data) => {
            // pino.info('CB!', err, data, n);
            cb(err, n);
        });
    }));
}


// function entryGetInfo(params) {
//     // const td = testData(params.size);

//     return bundle
//     .then(bundle => Promise.resolve((cb, n) => {
//         // cb(null,n);
//         bundle.uploadStrings({
//             languageId: 'en',
//             strings: td
//         }, (err, data) => {
//             // pino.info('CB!', err, data, n);
//             cb(err, n);
//         });
//     }));
// }

function getStrings(params) {
    const td = testData(params.size);

    return bundle
    .then(bundle => Promise.resolve((cb, n) => {
        // cb(null,n);
        bundle.getStrings({
            languageId: 'en',
        }, (err, data) => {
            // pino.info('CB!', err, data, n);
            cb(err, n);
        });
    }));
}

function doTestRun(testFn) {
    return (params) => new Promise((resolve, reject) => {
        testFn(params)
        .then(subTestFn => {
            if(!params.count) return reject('Bad count for ' + testFn.name+' : ' + params.count);
            pino.debug(testFn.name +' Begin ' + params.count+'  iterations');
            const start = process.hrtime();
            const runIt = (err, n) => {
                if(err) {
                    pino.error('Test %s failed on %d: %s', testFn.name, params.count, err );
                    return reject(err);
                }
                if(n>params.count) {
                    const end = process.hrtime(start);
                    pino.debug('Done on iteration %d at %d ms', n, hrtimeMili(end));
                    // LOG
                    return resolve({params: params, name: testFn.name, ms: hrtimeMili(end)});
                } else {
                    // pino.info('Continuing iteration %d/%d', n, params.count);
                    subTestFn(runIt, n+1);
                }
            };
            runIt(null, 0);
        }, reject)
    });
}

const doTestRunStats = (testFn) => {
    // Run several times
    return (params) => promtie.times(10, i => Promise.resolve(params).then(doTestRun(testFn)), { concurrency: 1 })
    .then(allstats => {
        const name = allstats[0].name;
        const remainder = allstats.slice(1); // ignore first
        const times = allstats.map(v => (v.ms/params.count));
        
        return { name: name, params: params,
            //  times: times, 
            times: statsAnalysis.filterOutliers(times), // remove outliers
            median: statsAnalysis.median(times),
            stDev: statsAnalysis.stdev(times)
        };
    });
};

const writeResults = (results) => {
    pino.debug({results: results});
    pino.info({params: results.params, test: results.name, ms: results.median, "±": results.stDev});
    if(!configCloudant.cloudant.disabled) process.nextTick(() => {
        info.then(info => {
            db.insert({info: info, results: results, date: new Date().toUTCString() }, (err, body, header) => {
                if(err) return pino.error(err);
                return pino.debug({doc: results, body: body});
            });
        })
    });
    return results;
};
// -- CONSTANTS

const BUNDLE_SMALL = 5;
const BUNDLE_MED = 100;
const COUNT_SHORT = 10;
const COUNT_MED = 50;

// Do test run
// ensure gp is there


promtie.settle([gp, bundle])
.then(params => {
    return bundle
        .then(bundle => promtie.promisifyAll(bundle).create({
            sourceLanguage: 'en'
        }))
        .then(x => Promise.resolve(params));
})

.then(() => Promise.resolve({ size: BUNDLE_SMALL, count: COUNT_SHORT }))
.then(doTestRunStats(nullTest))
.then(writeResults)



.then(() => Promise.resolve({ size: BUNDLE_SMALL, count: COUNT_SHORT }))
.then(doTestRunStats(writeData))
.then(writeResults)

// .then(() => Promise.resolve({ size: BUNDLE_SMALL, count: COUNT_SHORT }))
// .then(doTestRunStats(readString))
// .then(writeResults)

.then(() => Promise.resolve({ size: BUNDLE_SMALL, count: COUNT_SHORT }))
.then(doTestRunStats(getStrings))
.then(writeResults)



.then(() => Promise.resolve({ size: BUNDLE_MED, count: COUNT_SHORT }))
.then(doTestRunStats(writeData))
.then(writeResults)

// .then(() => Promise.resolve({ size: BUNDLE_MED, count: COUNT_SHORT }))
// .then(doTestRunStats(readString))
// .then(writeResults)

.then(() => Promise.resolve({ size: BUNDLE_MED, count: COUNT_SHORT }))
.then(doTestRunStats(getStrings))
.then(writeResults)



.then(x => pino.info('Tests Done!'), err => pino.error(err));