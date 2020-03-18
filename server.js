'use strict';

var express = require('express');
var mongo = require('mongodb');
var mongoose = require('mongoose');
var dotenv = require('dotenv');
var cors = require('cors');
var bodyparser = require('body-parser');
var dns = require('dns');

dotenv.config();

var app = express();

// Basic Configuration 
var port = process.env.PORT || 3000;
var db_uri = process.env.DB_URI || 'mongodb://localhost';
mongoose.connect(db_uri, { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false });

//Creating db schemas
var CounterSchema = mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

//Initializing db counter
var Counter = mongoose.model('counter', CounterSchema);
Counter.findById('url_counter', function (err, data) {
  if (err) console.log(err);
  else if (data == null) {
    new Counter({ _id: 'url_counter' }).save(function (err) {
      if (err) console.log(err);
    })
  }
});

var UrlSchema = mongoose.Schema({
  original_url: { type: String },
  short_url: { type: String }
});

UrlSchema.pre('save', function (next) {
  var doc = this;
  Counter.findOneAndUpdate({ _id: 'url_counter' }, { $inc: { seq: 1 } }, function (error, Counter) {
    if (error)
      return next(error);
    doc.short_url = Counter.seq;
    next();
  });
});
var Url = mongoose.model('url', UrlSchema);

/* Database methods*/
function createShortUrl(original_url, done) {
  var url = new Url({ original_url: original_url });
  url.save(function (err, data) {
    if (err) done(err);
    else done(null, data);
  });
}

function findShortUrl(short_url, done) {
  Url.findOne({ short_url: short_url }, 'original_url', { lean: true }, function (err, data) {
    if(err) done(err);
    else done(null, data);
  });
}

// API Definition
app.use(cors());

app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', function (req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// your first API endpoint... 
app.get("/api/hello", function (req, res) {
  res.json({ greeting: 'hello API' });
});

app.post("/api/shorturl/new", bodyparser.json(), function (req, res) {
  console.log(req.body.url_input);
  var urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/
  if(urlRegex.exec(req.body.url_input)) {
    createShortUrl(req.body.url_input, function(err, data) {
      if(err) {
        console.log(err);
        res.json({error :  'Internal server error'});
      } else {
        res.json({original_url: data.original_url, short_url: data.short_url});
      }
    });
  } else {
    res.json({error :  'invalid URL'});
  }
});

app.get("/api/shorturl/:short_url", function (req, res) {
  findShortUrl(req.params.short_url, function (err, data) {
    if (err) {
      console.log(err);
      res.json({error : 'Internal server error'});
    } else {
      console.log(data);
      if (data != null && data.original_url != null) {
        res.redirect(data.original_url);
      } else {
        res.status(404).send('Not found');
      }
    }
  });
});

app.listen(port, function () {
  console.log('Node.js listening on port ' + port);
});