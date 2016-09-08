Globalization Pipeline Nodejs Perf Test
===

Perf tests G11n Pipeline. Saves results to Cloudant.

Config
------

* WARNING: this test deletes ALL bundles from the GP instance.

Create `gp-config.json` as such:

```json
{
    "credentials": {
      "//": "(the usual GP creds)",
      "server.env": "path to a WAS 'server.env' file (optional)",
      "src":  "path to the server source code (optional)"
    }
}
```

and `gp-config-cloudant.json`:
```json
{
    "cloudant": {
        "account": "or URL",
        "db": "db-name",
        "key": "(optional)",
        "password": "hunter42"
    }
}
```

you can also set the following to NOT log the results:
and `gp-config-cloudant.json`:
```json
{
    "cloudant": {
        "disabled": true
    }
}
```
Usage
-----

    npm i
    npm run test

Contributing
------------
See [CONTRIBUTING.md](CONTRIBUTING.md).

License
-------
Apache 2.0. See [LICENSE.txt](LICENSE.txt).

> Licensed under the Apache License, Version 2.0 (the "License");
> you may not use this file except in compliance with the License.
> You may obtain a copy of the License at
>
> http://www.apache.org/licenses/LICENSE-2.0
>
> Unless required by applicable law or agreed to in writing, software
> distributed under the License is distributed on an "AS IS" BASIS,
> WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
> See the License for the specific language governing permissions and
> limitations under the License.
