Globalization Pipeline Nodejs Perf Test
===

Perf tests G11n Pipeline. Saves results to Cloudant.

Config
------

create `gp-config.json` as such:

```json
{
    "credentials": {
      // the usual…
      "server.env": // path to a WAS 'server.env' file (optional)
      "src":  // path to the server source code (optional)
    },
    "cloudant": {
        "account": // (or URL)
        "db": // DB name
        "key": // (if needed)
        "password": "hunter42"
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
