var type = require('type');
var keys = require('./keys');

/**
 * Expose `Indexed`.
 */

module.exports = Indexed;

/**
 * Construtor to wrap IndexedDB API with nice async methods.
 * `name` contains db-name and store-name splited with colon.
 *
 * Example:
 *
 *   // connect to db `notepad`, and use store `notes`.
 *   var notes = indexed('notepad:notes');
 *
 * @param {String} name
 * @param {Object} options
 * @api public
 */

function Indexed(name, options) {
  if (!(this instanceof Indexed)) return new Indexed(name, options);
  if (typeof name != 'string') throw new TypeError('`name` required');
  if (!options) options = {};
  name = name.split(':');

  this.backend = new Indexed.Backend(name[0], name[1]);
  this.options = options;
}

/**
 * Use the given plugin `fn(Indexed)`.
 *
 * @param {Function} fn
 * @return {Indexed}
 * @api public
 */

Indexed.use = function(fn) {
  fn(Indexed);
  return Indexed;
};

/**
 * Drop DB by `name`.
 *
 * @param {String} `name`
 * @param {function} cb
 * @api public
 */

Indexed.dropDb = function(name, cb) {
  if (typeof name != 'string') throw new TypeError('db `name` required');
  Indexed.Backend.dropDb(name, function(err) { cb(err) });
};

/**
 * Get value by `key`.
 *
 * @param {Mixin} key
 * @param {Function} cb
 * @api public
 */

Indexed.prototype.get = function(key, cb) {
  this.backend.get(keys.stringify(key), function(err, val) { cb(err, val) });
};

/**
 * Delete value by `key`.
 *
 * @param {Mixin} key
 * @param {Function} cb
 * @api public
 */

Indexed.prototype.del = function(key, cb) {
  this.backend.del(keys.stringify(key), function(err) { cb(err) });
};

/**
 * Put - replace or create `val` by `key`.
 *
 * @param {Mixin} key
 * @param {Mixin} val
 * @param {Function} cb
 * @api public
 */

Indexed.prototype.put = function(key, val, cb) {
  this.backend.put(keys.stringify(key), val, function(err) { cb(err) });
};

/**
 * Clear objects store.
 *
 * @param {Function} cb
 * @api public
 */

Indexed.prototype.clear = function(cb) {
  this.backend.clear(function(err) { cb(err) });
};

/**
 * Batch put/del operations in one transaction.
 * `ops` has levelup semantic https://github.com/rvagg/node-levelup#batch.
 *
 * @param {Array} ops
 * @param {Function} cb
 * @api public
 */

Indexed.prototype.batch = function(ops, cb) {
  if (!Array.isArray(ops))
    throw new TypeError('`operations` must be an array');

  ops.forEach(function(op) {
    if (op.type != 'put' && op.type != 'del')
      throw new TypeError('not valid operation `type`: ' + op.type);
    if (op.type == 'put' && op.value === undefined)
      throw new TypeError('`value` is required for key ' + op.key);
    op.key = keys.stringify(op.key);
  });

  this.backend.batch(ops, function(err) { cb(err) });
};

/**
 * Iterate each values in selected key range.
 *
 * Available options:
 *   - start: the key to start the read at
 *   - end: the end key
 *
 * Example:
 *   // filter values by key
 *   notes.createReadStream({ start: '1', end: '3' })
 *     .pipe(process.stdout);
 *
 * @param {Object} options
 * @return {ReadStream}
 * @api public
 */

Indexed.prototype.createReadStream = function(options) {
  if (!options) options = {};
  if (type(options) != 'object')
    throw new TypeError('`options` must be an object');

  if (options.start) options.start = keys.stringify(options.start);
  if (options.end) options.end = keys.stringify(options.end);

  return this.backend.createReadStream(options, function(key, val) {
    return { key: keys.parse(key), value: val };
  });
};

/**
 * Returns all values.
 * It buffers results from `createReadStream` and returns in `cb`.
 *
 * @param {Function} cb
 * @api public
 */

Indexed.prototype.all = function(cb) {
  var stream = this.createReadStream();
  var result = [];

  stream.on('error', cb);
  stream.on('data', function(data) { result.push(data) });
  stream.on('end', function() { cb(null, result) });
};

/**
 * Check `key` exists.
 *
 * @param {Mixin} key
 * @param {Function} cb
 * @api public
 */

Indexed.prototype.has = function(key, cb) {
  this.get(key, function(err, val) { cb(err, !!val) });
};

/**
 * Returns size of the store.
 *
 * @param {Function} cb
 * @api public
 */

Indexed.prototype.count = function(cb) {
  this.all(function(err, values) {
    err ? cb(err) : cb(null, values.length);
  });
};

/**
 * Classic way to iterate, on top of `createReadStream`.
 *
 * @param {Function} fn
 * @param {Function} cb
 * @api public
 */

Indexed.prototype.forEach = function(fn, cb) {
  if (typeof fn != 'function')
    throw new TypeError('iterator function required');

  var stream = this.createReadStream();
  stream.on('error', cb);
  stream.on('end', cb);
  stream.on('data', fn);
};