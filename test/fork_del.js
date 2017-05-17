var test = require('tape')
var hyperlog = require('hyperlog')
var fdstore = require('fd-chunk-store')
var path = require('path')
var memdb = require('memdb')
var fixtures = require('./fixtures')

var tmpdir = require('os').tmpdir()
var storefile = path.join(tmpdir, 'osm-store-' + Math.random())

var osmdb = require('../')

//       /-- A1 <--\
// A <---           --- (deletion)
//       \-- A2 <--/
test('forked node /w merging delete', function (t) {
  t.plan(13)

  var osm = osmdb({
    log: hyperlog(memdb(), { valueEncoding: 'json' }),
    db: memdb(),
    store: fdstore(4096, storefile)
  })

  var A = fixtures['point']
  var A1 = fixtures['point-xyz']
  var A2 = fixtures['multipoint']
  var delVersion
  var id
  osm.create(A, function (err, newId, node0) {
    t.ifError(err)
    id = newId
    osm.put(id, A1, { links: [node0.key] }, function (err, node1) {
      t.ifError(err)
      t.deepEquals(node1.links, [node0.key], 'node1 links')
      osm.put(id, A2, { links: [node0.key] }, function (err, node2) {
        t.ifError(err)
        t.deepEquals(node2.links, [node0.key], 'node2 links')
        osm.del(id, function (err, delNode) {
          t.ifError(err)
          delVersion = delNode.key
          t.deepEquals(delNode.links, [node1.key, node2.key], 'del node links')
          osm.get(id, function (err, docs) {
            t.ifError(err)
            t.equals(Object.keys(docs).length, 1)
            var doc = docs[delNode.key]
            t.equals(doc.deleted, true)
            t.equals(doc.id, id)
            query()
          })
        })
      })
    })
  })

  function query () {
    var q0 = [[-1.0, 2.0], [99.0, 102.0]]
    var expected = [{
      id: id,
      version: delVersion,
      deleted: true
    }]
    osm.query(q0, function (err, actual) {
      t.ifError(err)
      t.deepEqual(actual, expected, 'full coverage query')
    })
  }
})
