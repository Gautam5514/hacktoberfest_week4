# markdown-tomb-parser (2016)

> Dead code specimen: An abandoned 2016 markdown metadata extractor that fails under modern Node.js 20+ environments.

### Known Autopsy Issues
1. Outdated `engines.node` specification (`>=8 <14`)
2. Deprecated `request` dependency in `package.json`
3. Broken local import: `require('./missing-util')` throws `Cannot find module`
4. Insecure `new Buffer()` constructor call in `index.js`
5. Test failure when executed with modern Node.js runtimes
