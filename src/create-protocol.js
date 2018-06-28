const path = require('path')
const { lookup: mimeTypeFor } = require('mime-types')
const { app, protocol } = require('electron')
const { URL } = require('url')
const { readFile } = require('fs')
const { _resolveFilename: resolve } = require('module');
function createProtocol(scheme, base, normalize = true) {
  // hould only be called after app:ready fires
  if (!app.isReady())
    return app.on('ready', () => createProtocol(...arguments));
  // Normalize standard URLs to match file protocol format
  normalize = !normalize
    ? url => new URL(url).pathname
    : url => new URL(
      url.replace(/^.*?:[/]*/, `file:///`) // `${scheme}://./`
    ).pathname.replace(/[/]$/, '');

  protocol.registerBufferProtocol(
    scheme,
    (request, respond) => {
      let pathname, filename, data, mimeType;
      try {
        // Get normalized pathname from url
        pathname = normalize(request.url);

        // Resolve absolute filepath relative to mainModule
        filename = path.join(base, pathname)

        // Read contents into a buffer
        data = readFile(filename, (error, data) => {
          if (!error) {
            mimeType = mimeTypeFor(filename);
            // Respond with mimeType & data
            respond({ mimeType, data });
          } else {
            throw(error)
          }
        });
        // Resolve mimeType from extension
      } catch (exception) {
        console.error(exception, { request, pathname, filename, data, mimeType });
      }
    },
    (exception) =>
      exception && error(`Failed to register ${scheme} protocol`, exception)
  );

}

module.exports = createProtocol;
