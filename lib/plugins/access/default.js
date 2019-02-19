const stream = require('stream'),
  express = require('express'),
  auth = require('../../auth'),
  app = require('../../../app'),
	router = express.Router();

/*
  Testing, schema proposal

  "meta_access": {
    users: {
      "mike": {
        "r": true,
        "w": true
      }
    },
    channels: {
      test1: {
        "r": true,
        "w": true
      },
      test2: {
        "r": true,
        "w": true
      }
    }
  }

*/

const canReadById = async (id, user) =>{
  try {
    const prev = await app.changesdb.loadDocRevisions({_id: id, limit:1});

    if(prev.ok){
      const prevdoc = prev.res[0]
      //if its null, this means this is a new doc,
      //new docs, then we just pass it through
      if(!prevdoc){
        return true;
      }
      if(readAccess(prevdoc, user)){
        return true;
      }
    }
    return false;
  }
  catch(err){
    console.log(err);
    return false;
  }
}

const canRead = (doc, user) =>{
  return readAccess(doc, user);
}

const canWriteById = async (id, user) =>{
  const res = await canWrite({_id: id}, user);
  return res;
}

const canWrite = async (doc, user) => {
  try{
    //load prev rev doc
    const prev = await app.changesdb.loadDocRevisions({_id: doc._id, limit:1});
    //see if user can write
    if(prev.ok){
      const prevdoc = prev.res[0]
      //if its null, this means this is a new doc,
      //new docs, then we just pass it through
      //if(!prevdoc){
      //  return true;
      //}
      const testdoc = prevdoc || doc;//if its new, then prevdoc will be null, so just see if user add right meta accesss
      if(writeAccess(testdoc, user)){
        // TODO:  here can can also check if user has 
        // permission to actually modify access
        // meta, need to figure out a good process
        // for this
        return true;
      }
    }
    return false;
  }
  catch(err){
    console.log('CanWrite ERROR: ', err);
    return false;
  }
}

const readAccess = (doc, user) => {
  //check user access
  const users = extractUsers(doc);
  if(users.includes(user.name)){
    if(doc[app.opts.accessMetaKey].users[user.name]['r']){
      return true;
    }
  }
  //no user access, check channel access
  const docChannels = extractChannels(doc);
  const userChannels = extractUserChannels(user);
  for (let i = 0; i < docChannels.length;i ++) {
    for(let x =0; x < userChannels.length; x++){
      if(docChannels[i] === userChannels[x]){
        if(doc[app.opts.accessMetaKey].channels[userChannels[x]]['r']){
          if(user.channels[userChannels[x]]['r']){
            return true;
          }
        }
      }
    }
  }
  return false;
}

const writeAccess = (doc, user) => {
  //check user access
  const users = extractUsers(doc);
  if(users.includes(user.name)){
    if(doc[app.opts.accessMetaKey].users[user.name]['w']){
      return true;
    }
  }
  //no user access, check channel access
  const docChannels = extractChannels(doc);
  const userChannels = extractUserChannels(user);
  for (let i = 0; i < docChannels.length;i ++) {
    for(let x =0; x < userChannels.length; x++){
      if(docChannels[i] === userChannels[x]){
        if(doc[app.opts.accessMetaKey].channels[userChannels[x]]['w']){
          if(user.channels[userChannels[x]]['w']){
            return true;
          }
        }
      }
    }
  }
  return false;
}

const accessByUser = (doc, user) => {
  const users = extractUsers(doc);
  if(users.includes(user.name)){
    return doc[app.opts.accessMetaKey].users[user.name]['r']
  }
  return false;
}



const accessByChannel = (doc, user) => {
  const docChannels = extractChannels(doc);
  const userChannels = extractUserChannels(user);
  for (let i = 0; i < docChannels.length;i ++) {
    for(let x =0; x < userChannels.length; x++){
      if(docChannels[i] === userChannels[x]) return true;
    }
  }
  return false;
}


const extractUsers = (doc) => {
  if(!doc[app.opts.accessMetaKey] || !doc[app.opts.accessMetaKey].users) return [];
  return Object.keys(doc[app.opts.accessMetaKey].users);
}

const extractChannels = (doc) => {
  if(!doc[app.opts.accessMetaKey] || !doc[app.opts.accessMetaKey].channels) return [];
  return Object.keys(doc[app.opts.accessMetaKey].channels);
}

const extractUserChannels = (user) => {
  if(!user.channels) return [];
  return Object.keys(user.channels);
}

const extractAccess = (doc) => {
  return {
    users: extractUsers(doc),
    channels: extractChannels(doc)
  };
}



// stream transformer that removes auth details from documents
const authCheckStream = function(user, removeDoc) {
  let firstRecord = true;
  
  let addComma = false;
  const stripAuth =  (obj, user, removeDoc) => {
    
    let chunk = obj;

    // If the line ends with a comma, 
    // this would break JSON parsing.
    if (obj.endsWith(',')) {
      chunk = obj.slice(0, -1);
      addComma = true;
    }
    else {
      addComma = false;
    }

    let row;
    try { 
      row = JSON.parse(chunk); 
    } catch (e) {
      return obj+'\n'; // An incomplete fragment: pass along as is.
    }

    

    // Successfully parsed a doc line. Remove auth field.
    if (row.doc) {      
      if(canRead(row.doc, user)){
        strip(row.doc);
      }
      else {
        return '';
      }
    } 
  
    // if we need to remove the doc object
    if (removeDoc) {
      delete row.doc;
    }
  
    // cloudant query doesn't return a .doc
    delete row[app.opts.accessMetaKey];

    // Repack, and add the trailling comma if required
    var retval = JSON.stringify(row);
    let ending = (addComma)?',':'';
    if (firstRecord) {
      firstRecord = false;
      return retval+ending;
    } else {
      return '\n'+retval+ending;
    }
  };
  
  var tr = new stream.Transform({objectMode: true});
  tr._transform = function (obj, encoding, done) {
    var data = stripAuth(obj, user, removeDoc);
    if (data) {
      this.push(data);
    }
    done();
  };
  return tr;
};


const addAccessMeta = (doc, username) => {
  if(!doc[app.opts.accessMetaKey]) 
    doc[app.opts.accessMetaKey] = { users: { [username]: {r:true, w:true} }, channels: {} };

  return doc;
}


// strips a document of its ownership information

var strip = (doc) => {
  //console.log('Strip: ', doc);
  //delete doc[app.opts.accessMetaKey];
  return doc;
};




// determines whether a doc object is owned by ownerd
// TODO: remove it, no longer used
var isMine = function(doc, ownerid) {
  return (doc && doc[app.opts.accessMetaKey] && doc[app.opts.accessMetaKey].ownerid && 
            doc[app.opts.accessMetaKey].ownerid === accessMetaKey);
};


const calculateOwnerId = (ownerid) => {
  return ownerid
}




module.exports = function() {
  return {
    //new
    canWrite,
    canWriteById,
    canRead,
    canReadById,
    authCheckStream,
    extractUsers,
    extractChannels,
    extractUserChannels,
    extractAccess,
    
    addAccessMeta,
    strip,
    calculateOwnerId,
  };
};
