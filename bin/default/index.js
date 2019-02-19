require('dotenv').config();
const path = require('path');
const express = require('express');


router = express.Router();

// my custom route
router.get('/ok', async (req, res) => {
  res.send("ok");

  const nano = await require('nano')('http://mike:pass@localhost:5984');
  const couchdbs = await nano.db.list();
  couchdbs.forEach(async db=>{
    if(db.startsWith('envoy1')){
      await nano.db.destroy(db);
    }
  });

  nano.db.destroy('a');
  nano.db.destroy('a_changes');
});

const envoy = require('../../app')();
envoy.events.on('listening', function() {
  console.log('[OK]  Server is up: ', envoy.opts.port);
});