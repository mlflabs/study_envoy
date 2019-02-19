/* eslint-env mocha */
'use strict'
/* globals testUtils */

var PouchDB = require('pouchdb')

var assert = require('assert')

const wait = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
// Generate a bunch of documents, and store those in a local
// PouchDB. Kick off a push replication, and then query remote
// end to ensure that all generated documents made it acrosss.
describe('two way sync', function () {
  var dbs = {}
  beforeEach(function (done) {
    dbs = { local: 'testdb' }
    testUtils.cleanup([dbs.local], done)
  })

  afterEach(function (done) {
    testUtils.cleanup([dbs.local], done)
  })

  it('ensure no conflicts arise for push pull sync', async () => {
    try{
      var local = new PouchDB(dbs.local)
      var docs = testUtils.makeDocs(5)

      let remoteURL = await testUtils.createUser();
      let remote = await new PouchDB(remoteURL);
      let response = await remote.allDocs();

      assert.strictEqual(response.rows.length, 0)
      await local.bulkDocs(docs);
      await remote.replicate.to(local);
      await wait(1000)
      let data = await local.allDocs({ conflicts: true });

      data.rows.forEach(function (row) {
      assert.strictEqual(typeof row._conflicts, 'undefined')
    })
    }catch(err){
      assert(false);
    }

    

    
  })

  it('ensure no conflicts arise for pull push sync', async () => {
    try {
      var local = new PouchDB(dbs.local)
      var docs = testUtils.makeDocs(5)
  
      let remoteURL = await testUtils.createUser();
      let remote = await new PouchDB(remoteURL);
      let response = await remote.allDocs();
      assert.strictEqual(response.rows.length, 0)
      await remote.bulkDocs(docs)
      await wait(1000)
      await remote.replicate.to(local)
      await wait(1000)
      // Verify that all documents reported as pushed are present
      // on the remote side.
      return local.replicate.to(remote)
      await wait(1000)
      remote.allDocs({ conflicts: true });
  
      data.rows.forEach(function (row) {
        assert.strictEqual(typeof row._conflicts, 'undefined')
      })  
    }catch(err){
      assert(false);
    }
  })
})

