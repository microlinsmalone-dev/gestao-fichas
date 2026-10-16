const fs = require('fs');

// The EISDIR bug in libuv only affects Windows NTFS on Node 24+
// On Linux/macOS (e.g. GitHub Actions ubuntu-latest), this patch is not needed and must not run.
if (process.platform !== 'win32') {
  return;
}

// Ensure all child processes, workers, and subprocesses on Windows inherit this patch:
if (!process.env.NODE_OPTIONS || !process.env.NODE_OPTIONS.includes('patch-readlink.js')) {
  const normalizedPath = __filename.replace(/\\/g, '/');
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} -r ${normalizedPath}`.trim();
}

// Node 24 Windows libuv compatibility fix:
// On Windows NTFS, uv_fs_readlink in Node 24 returns EISDIR instead of EINVAL on regular non-symlink files.
// Webpack expects EINVAL to recognize standard files during snapshotting.
if (fs.readlinkSync) {
  const origReadlinkSync = fs.readlinkSync;
  fs.readlinkSync = function (path, options) {
    try {
      return origReadlinkSync.call(fs, path, options);
    } catch (err) {
      if (err && err.code === 'EISDIR') {
        err.code = 'EINVAL';
      }
      throw err;
    }
  };
}

if (fs.readlink) {
  const origReadlink = fs.readlink;
  fs.readlink = function (path, options, callback) {
    const cb = typeof options === 'function' ? options : callback;
    const opt = typeof options === 'function' ? {} : options;
    return origReadlink.call(fs, path, opt, (err, linkString) => {
      if (err && err.code === 'EISDIR') {
        err.code = 'EINVAL';
      }
      if (cb) cb(err, linkString);
    });
  };
}

if (fs.promises && fs.promises.readlink) {
  const origPromisesReadlink = fs.promises.readlink;
  fs.promises.readlink = async function (path, options) {
    try {
      return await origPromisesReadlink.call(fs.promises, path, options);
    } catch (err) {
      if (err && err.code === 'EISDIR') {
        err.code = 'EINVAL';
      }
      throw err;
    }
  };
}
