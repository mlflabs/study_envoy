const express = require('express')
const router = express.Router()
const app = require('../../app')
const access = require('../access')
const auth = require('../auth')

router.get('/' + app.dbName + '/:id/*', auth.isAuthenticated, async (req, res) => {
  try {
    // 1. Get the document from the db
    // 2. Validate that the user has access
    // 3. return the document with the auth information stripped out
    const id = req.params.id;
    if(!id){
      throw new Error({status:404, message:'Not Found' ,reason: 'Id not specified'});
    }
    const allow = await access.canReadById(id, req.session.user);
    if(allow){
      app.db.attachment.getAsStream(id, req.params['0']).pipe(res)
    }
    else{
      throw new Error({status:401, message:'Not Found' ,reason: 'Insufficient permissions'});
    }
  }
  catch(err){
    return utils.sendError(err, res)
  }
});

module.exports = router
