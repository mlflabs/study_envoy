// const Nano = require('nano')
const access = require('../../access');
const app = require('../../../app.js')
// const nano = Nano(app.opts.couchHost)
const result = (ok=true, res=null, error = null, opts=null) => {
  return { ok, res, error, opts };
};

let db;
const LAST_SEQ = 'last_seq';
const DIV = '||';

// create the database tables and indicies
const setup = (dbName)=> {
  return new Promise((resolve, reject) => {
    app.cloudant.db.create(app.dbName+'_changes', (err, body, header) => {
      // 201 response == created
      // 412 response == already exists
      if (err || (header.statusCode !== 201 && header.statusCode !== 412)) {
        if(err.statusCode !== 201 && err.statusCode != 412)
          console.log(err || body)      
      }
      else {
        console.log( '[OK]  Created changes couch database: ' + dbName);
      }
      db = app.cloudant.db.use(app.dbName+'_changes');
      return resolve(true);
    });
  });
}

const processBatch = async (changes) => {
  try {
    await insertBulk(changes);
    return true;
  }
  catch(err){
    console.log(err);
    return false;
  }
}

const insertBulk = async (changes) => {
  try {

    const docs = [];

    changes.forEach(change => {
      const users = access.extractUsers(change.doc);
      const channels = access.extractChannels(change.doc);

      const deleted = (change.deleted)? 1: 0;
      const seq_num = parseInt(change.seq.split('-')[0]);

      const docids = [];
      users.forEach(user => {
        //changes docs, make one for each user
        const id = 'change'+DIV+'user'+DIV+user+DIV+seq_num
        docids.push(id);
        docs.push({
              _id: id,
              seq: change.seq,
              id: change.id, // store the original document id,
              changes: change.changes,
              deleted: deleted
        });

        //TODO: here we could have another process to go over these docs and remove 
        // duplicates
        docs.push({
          _id:'user'+DIV+user+DIV+change.id+DIV+change.doc._rev
        })
      });

      channels.forEach(channel => {
        //changes docs, make one for each user
        const id = 'change'+DIV+'channel'+DIV+channel+DIV+seq_num;
        docids.push(id);
        docs.push({
              _id: id,
              seq: change.seq,
              id: change.id, // store the original document id,
              changes: change.changes,
              deleted: deleted
        });

        //TODO: here we could have another process to go over these docs and remove 
        // duplicates
        docs.push({
          _id:'channel'+DIV+channel+DIV+change.id+DIV+change.doc._rev
        })
      })

      //need 
      docs.push({
        _id: 'doc'+DIV+change.doc._id+DIV+change.doc._rev, 
        [app.opts.accessMetaKey]: change.doc[app.opts.accessMetaKey],
      }); 

      // TODO: cache docs, less stress on couchdb
      //docs.push({_id: 'doc'+DIV+change.doc._id, doc: change.doc});
    });

    docs.push({_id: LAST_SEQ, seq: changes[changes.length-1].seq})
    
    const res = await db.bulk({docs: docs});

    return true;
  }
  catch(err) {
    // if (!db.inTransaction) throw err; 
    console.log('Insert Bulk Error: ', err);
    return false;
  }
}

/*
Required:
  opts._id
*/
const loadDocRevisions = async (opts) => {
  try {
    const q = {
      selector: {
        '_id': {
          '$gte': 'doc'+DIV+opts._id+DIV,
          '$lte': 'doc'+DIV+opts._id+DIV+'z', //TODO: find the last char code should be more encopasing
          },
        },
      sort: [{ _id: 'desc' }],
       'limit': Number(opts.limit || 1000)
    };
    const res = await db.find(q);
    return result(true, res.docs);
  }
  catch(err){
    console.log(err);
    return false;
  }
}

//how many revisions back to keep
const cleanChangesDatabase = async (history_size=10) =>{
  //TODO:
}



const loadChangesFromCouch = async (opts) => {
  try {
    const q = {
      selector: {
        '_id': {
          '$gte': 'change'+DIV+'user'+DIV+opts.user+DIV+opts.since,
          '$lte': 'change'+DIV+'user'+DIV+opts.user+DIV+'z', //TODO: find the last char code should be more encopasing
          },
        },
       'limit': Number(opts.limit)
    };
    const res = await db.find(q);
    return res.docs;
  }
  catch(err){
    console.log(err);
    return false;
  }
}

//load doc keys by user
const getDocKeysByUsername = async (username, opts={}) => {
  try {
    const keys = {}; 
    const q = {
      selector: {
        '_id': {
          '$gte': 'user'+DIV+username+DIV,
          '$lte': 'user'+DIV+username+DIV+'z', //TODO: find the last char code should be more encopasing
          },
        },
       'limit': Number(opts.limit||1000)
    };
    const res = await db.find(q);
    res.docs.forEach(doc=>{
      //remove duplicate docs with different revs
      keys[doc._id.split('||')[2]] = null;
    })
    return keys;

  }
  catch(err){
    console.log(err);
    return false;
  }
}


//load doc keys by multiple channels
const getDocKeysByChannels = async (channels, opts={}) => {
  try {
    const _channels = Array.isArray(channels)?channels:[channels,];
    const keys = {};
    
    _channels.forEach(async channel => {
      const q = {
        selector: {
          '_id': {
            '$gte': 'channel'+DIV+channel+DIV,
            '$lte': 'channel'+DIV+channel+DIV+'z', //TODO: find the last char code should be more encopasing
            },
          },
         'limit': Number(opts.limit||1000)
      };
      const res = await db.find(q);
      res.docs.forEach(doc=>{
        //remove duplicate docs with different revs
        keys[doc._id.split('||')[2]] = null;
      })
      //remove duplicate docs with different revs
    })
    return keys;
    
  }
  catch(err){
    console.log(err);
    return false;
  }
}

// simulate a changes feed, segmented by user,
// given a 'since' and a 'user' and a 'limit'
const changes = async (opts) => {
  try {
    if (typeof opts.since === 'undefined') { 
      opts.since = 0
    } else {
      const bits = opts.since.split('-')
      if (bits.length > 0) {
        opts.since = parseInt(bits[0])
      } else {
        opts.since = 0
      }
    }

    if (typeof opts.limit === 'undefined') {
      opts.limit = 100
    }
    // TODO:: currently we are nonly loading changes for
    // user owned docs, but not looking at the channels
    // the user belongs to
    // imp: need to make multiple requests for user and
    // each channel user belongs to
    const res = await loadChangesFromCouch(opts);
    //if(res.length > 0)
    //  console.log(res[0].seq)
    const seq = (res.length > 0)? res[res.length-1].seq : 0;
    //we also need to shift first element, since it will be duplicate
    //TODO: tests show that we still need to use this?? not sure why
    if(opts.since != 0)
      res.shift();
    //if(opts.since != 0)
    //  res.shift(); //if its not init, then the first record will be dublicate

    //need to format the data
    res.forEach(r => {
      //delete r._id;
      delete r._rev
    });

    const changeResults = {
      results: res,
      last_seq: seq,
      pending: 0 //TODO: test with over 100 docs, can record tell us how many pending
    }
    return changeResults;
  }
  catch(err){
    console.log(err);
  }
    

}


// get the latest change from the changes feed database
const getSyncUserKey =  async (key) => {
  try{
    const row = await db.get(key);
    return result(true, row)
  }
  catch(err){
    // console.log(err);
    return result(false,null,err);
  }
}

const saveSyncUserKey = async (key, doc) => {
  try{
    const old = await getSyncUserKey(key);
    let newdoc = {_id: key, doc: doc};
    if(old.ok){
      newdoc._rev = old.res._rev;
    }
    const rec = await db.insert(newdoc);
    return result(true,rec);
  }
  catch (err){
    console.log(err);
  }
  
}

// get the latest change from the changes feed database
const getLatestGlobalChangeSeq =  async (opts) => {
  let since = 0;
  try{
    const row = await db.get(LAST_SEQ);
    since = row.seq;
  }
  catch(err){
    if(err.error === 'not_found') {
      
    }
    else 
      console.log('getLatest: ', err);
  }
  return since;
}

module.exports = () => {
  return {
    setup,
    //changs
    changes,
    getLatestGlobalChangeSeq,
    loadDocRevisions,
    getDocKeysByUsername,
    getDocKeysByChannels,

    //settings
    getSyncUserKey,
    saveSyncUserKey,

    //process
    processBatch
  };
}
