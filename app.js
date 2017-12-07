var Client = require('mongodb').MongoClient;

var fs = require('fs');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var multer = require('multer'); 
var upload = multer({ dest: __dirname+'/uploads/' });
var crypto = require('crypto');
var iconvLite = require('iconv-lite');

app.use(express.static(__dirname + '/public'));

app.use(bodyParser.urlencoded({extended : true}));

app.get('/', function(req,res){
    res.redirect('http://sodeok.xyz');
});

function getUserIP(req){
    var ipAddress;

    if(!!req.hasOwnProperty('sessionID')){
        ipAddress = req.headers['x-forwarded-for'];
    } else{
        if(!ipAddress){
            var forwardedIpsStr = req.header('x-forwarded-for');

            if(forwardedIpsStr){
                var forwardedIps = forwardedIpsStr.split(',');
                ipAddress = forwardedIps[0];
            }
            if(!ipAddress){
                ipAddress = req.connection.remoteAddress;
            }
        }
    }
    return ipAddress;
}
function getDownloadFilename(req, filename) {
    var header = req.headers['user-agent'];
 
    if (header.includes("MSIE") || header.includes("Trident")) { 
        return encodeURIComponent(filename).replace(/\\+/gi, "%20");
    } else if (header.includes("Chrome")) {
        return iconvLite.decode(iconvLite.encode(filename, "UTF-8"), 'ISO-8859-1');
    } else if (header.includes("Opera")) {
        return iconvLite.decode(iconvLite.encode(filename, "UTF-8"), 'ISO-8859-1');
    } else if (header.includes("Firefox")) {
        return iconvLite.decode(iconvLite.encode(filename, "UTF-8"), 'ISO-8859-1');
    }
 
    return filename;
}

app.post('/upload', upload.single('file'), function(req, res){
    var json=JSON.parse(JSON.stringify(req.file));
    json.ip=getUserIP(req);
    json.date=String(Date.now());
    json.share=0;
    json._id=crypto.createHash('md5').update(String(json.date)+String(json.ip)).digest("hex");
    Client.connect('mongodb://localhost:27017/webshare', function(error, db) {
        if(error) console.log(error);
        else {
            db.collection('file').insertOne(json,function(doc, err){
                if(err) console.log(err);
                res.send(String(json._id));
            });
            db.close();
        }
    });
});
  
app.post('/download', function(req, res){
    var key=String(req.body.code);
    Client.connect('mongodb://localhost:27017/webshare', function(error, db) {
        if(error) console.log(error);
        else {
            key=key.trimLeft().trimRight().trim();
            db.collection('file').findOne({_id:key},function(err, obj){
                if(err) console.log(err);
                if(obj){
                    res.setHeader('Content-disposition', 'attachment; filename=\"'+getDownloadFilename(req,obj.originalname).replace(/ /gi,"_")+'\"');
                    res.setHeader('Content-type', obj.mimetype);

                    var filestream = fs.createReadStream(obj.path);
                    filestream.pipe(res);
                }else  res.send("download fail");
            });
            db.close();
        }
    });
});

app.post('/list', function(req, res){
    var key=String(getUserIP(req));
    Client.connect('mongodb://localhost:27017/webshare', function(error, db) {
        if(error) console.log(error);
        else {
            var list = new Array();
            db.collection('file').find({ip:key}).each(function(err, obj){
                if(err) console.log(err);
                if(obj){
                    var data = new Object();
                    data.code=obj._id;
                    data.filename=obj.originalname;
                    data.share=obj.share;
                    list.push(data);
                }else{
                    var jsonData = JSON.stringify(list);
                    res.send(jsonData);
                    db.close();
                }
            });
        }
    });
});

app.post('/share', function(req, res){
    var key=String(getUserIP(req));
    Client.connect('mongodb://localhost:27017/webshare', function(error, db) {
        if(error) console.log(error);
        else {
            var list = new Array();
            db.collection('file').find({share:1}).each(function(err, obj){
                if(err) console.log(err);
                if(obj){
                    var data = new Object();
                    data.code=obj._id;
                    data.filename=obj.originalname;
                    list.push(data);
                }else{
                    var jsonData = JSON.stringify(list);
                    res.send(jsonData);
                    db.close();
                }
            });
        }
    });
});

app.post('/sharecheck', function(req, res){
    var check=Number(req.body.share);
    var code=String(req.body.code);

    Client.connect('mongodb://localhost:27017/webshare', function(error, db) {
        if(error) console.log(error);
        else {
            db.collection('file').updateOne({_id:code},{$set:{share:check}},function(err, doc){
                if(err) console.log(err);
                else res.send("ok");
                db.close();
            });
        }
    });
});

app.use((req, res, next) => {
    res.status(404).redirect('http://sodeok.xyz');
});
app.listen(8001);