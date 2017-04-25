//sudo npm install google-auth-library --save
//sudo npm install fb

var MongoClient = require('mongodb').MongoClient;
var dburl       = 'mongodb://localhost:27017/point';

var GoogleAuth = require('google-auth-library');
var googleCI   = '219844659207-ct72vss7fte5ct6ka8j0jcuocjcrevpl.apps.googleusercontent.com';
var auth       = new GoogleAuth;
var client     = new auth.OAuth2(googleCI, '', '');

var FB         = require('fb');

var fs         = require('fs');
var https      = require('https');


var serverOptions = {
        key:  fs.readFileSync('/etc/letsencrypt/live/nile16.nu/privkey.pem'),
        cert: fs.readFileSync('/etc/letsencrypt/live/nile16.nu/cert.pem'),
        ca:   fs.readFileSync('/etc/letsencrypt/live/nile16.nu/chain.pem')
    };

https.createServer( serverOptions, (req,res) => {
	
	//Allow CORS for testing
	res.setHeader('Access-Control-Allow-Origin',   '*');
	res.setHeader('Access-Control-Request-Method', '*');
	res.setHeader('Access-Control-Allow-Methods',  'POST, GET');
	res.setHeader('Access-Control-Allow-Headers',  '*');

	res.setHeader('Content-Type', 'application/json');
	
	var body = '';

	var postObj = {};
	
	req.on('data', (data) => {
		body += data;
	});

	req.on('end', () => {

		postObj=JSON.parse(body);
		
		//console.log("postObj",postObj);
		
		if ((postObj.acc=="google")&&postObj.tok)   checkGoogleToken(postObj.tok,tokenChecked);

		else if ((postObj.acc=="facebook")&&postObj.tok) checkFacebookToken(postObj.tok,tokenChecked);
		
		else res.end(JSON.stringify({err:'Invalid account'}));
		
	});
	
	function tokenChecked(userInfo){

		if (!userInfo){
			//console.log("Invalid token");
			res.end(JSON.stringify({err:'Invalid token'}));
		}
		else if (postObj.com=="usr"){
			//console.log("Login User:",userInfo);
			MongoClient.connect(dburl, (err, db) => {
				db.collection('users').find({acc:postObj.acc,uid:userInfo.id}).toArray((err, docs) => {
					if (docs.length==0){
						db.collection('users').insert({acc:postObj.acc,uid:userInfo.id,una:userInfo.name,pic:userInfo.pic,hea:50,lev:0}, (err, r) => { 
							db.close();
							res.end(JSON.stringify({err:false,una:userInfo.name,pic:userInfo.pic,hea:50,lev:0}));
						});
					}
					else {
						var update={};
						update.$set={};
						update.$inc={};
						if (postObj.una) update.$set.una=postObj.una;
						if (postObj.pic) update.$set.pic=postObj.pic;
						if (postObj.hea) update.$inc.hea=postObj.hea;
						if (postObj.lev) update.$inc.lev=postObj.lev;
						MongoClient.connect(dburl, (err, db) => {
							//db.collection('users').update({acc:postObj.acc,uid:userInfo.id},{$set:{una:postObj.una}}, (err, r) => { 
							db.collection('users').update({acc:postObj.acc,uid:userInfo.id}, update, (err, r) => { 
								db.collection('users').find({acc:postObj.acc,uid:userInfo.id}).toArray((err, docs) => {
									db.close();
									res.end(JSON.stringify({err:false,una:docs[0].una,pic:docs[0].pic,hea:docs[0].hea,lev:docs[0].lev}));
								});
							});
						});
					}
				});
			});
		}
		else if (postObj.com=="pos"){
			//console.log("Update User position:",userInfo);
			MongoClient.connect(dburl, (err, db) => {
				db.collection('users').update({acc:postObj.acc,uid:userInfo.id},{$set:{pos:postObj.pos,pti:Math.floor(new Date()/1000)}}, (err, r) => { 
						db.collection('users').find( {"$or":[{acc:{"$ne":postObj.acc}},{uid:{"$ne":userInfo.id}}]} ).toArray( (err, docs) => {
							var users=[];
							for (i=0;i<docs.length;i++){
								if (docs[i].pos&&((docs[i].pti+30)>Math.floor(new Date()/1000))) users.push([docs[i].pos,docs[i].una]);
							}
							res.end(JSON.stringify({err:false,ous:users}));
							//console.log(users);
							db.close();
						});
				});
			});
		}
		else {
			console.log("Unknow Command");
			res.end(JSON.stringify({err:'Invalid command'}));
		}
	}
	
}).listen(1208);

	
	
function checkGoogleToken(token,cb){
	client.verifyIdToken(token,googleCI,function(e, login) {
		if (e){
			console.log(e);
			cb(false);
			return;
		}
		else{
			var payload = login.getPayload();
			//Check that the token is issued by Google
			if ((payload['iss']!='accounts.google.com')&&(payload['iss']!='https://accounts.google.com')){
				cb(false);
				return;
			}
			//Check that the token is issued to PointFighter
			if (payload['aud']!=googleCI){
				cb(false);
				return;
			}
			//Check that the token is not expaired
			if (payload['exp']<Math.floor(new Date()/1000)){
				cb(false);
				return;
			}
			cb({id:payload.sub,name:payload.name,pic:payload.picture});
		}
    });
}

function checkFacebookToken(token,cb){
	FB.api('me', { fields: ['id', 'name', 'picture'], access_token: token }, function (res) {
		var data={};
		data.id=res.id;
		data.name=res.name;
		if (res.picture) data.pic=res.picture.data.url; else data.pic=false;
		if (res) cb(data);
		else cb(false);
	});
}


//checkGoogleToken(token,console.log);

//checkFacebookToken('EAAFIFUayZAoQBABx2Glx959I4tbVmnWuqpTy79rtdZAODPLhi4YQck9H0ExCDQcESSaNBaWOwtfF7QYolAHf4ZAyXgqyZCjZCY00eHYztR9Pgb4PJ67D0jWZCPGXAoDZCndKGN39ZBFr5oVfZC2vYZAO06aefEhZCV3vHk9jE4Cnh4eIkL9JchMIb6G88VrctqIUIYZD',console.log);




