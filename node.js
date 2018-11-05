//framework class
var framework = {
	tmr: null,
	path: null,
	fs: null,
	http: null,
	io: null,
	client: null,
	init: function() {
		framework.path = require( "path" );
		framework.fs = require( 'fs' );
		
		framework.http = httpServer.init();
		framework.io = require( "socket.io" )(http);
		
		var mqtt = require( "mqtt" );
		framework.client = mqtt.connect( "mqtt://192.168.0.110:1883" );
		
		toClient.init();
		fromClient.init();
		

	}, 
	stopTimer: function() {
		console.log( "Timer Stopped" );
		clearInterval( framework.tmr );	
	},
	startTimer: function() {
		console.log( "Timer Started" );
		toClient.startTimer();
	},
	copyFunction: function( topic ) {
	  return function(data) {
		fromClient.call(topic, data);
	  }
	}
	

}

//enable http server
var httpServer = {
	subDir: '/public',
	startFile: 'index.html',
	error404: '404.html',
	portNumber: 8000,
	init: function() {
		http = require( "http" ).createServer( httpServer.handler )
		http.listen( httpServer.portNumber );
		
		console.log( "Server running" );
		
		return http;
	},
	handler: function( request, response ) {
	
		var filePath = '.' + request.url;
		if (filePath == './') {
			filePath = '.' + httpServer.subDir + '/' + httpServer.startFile;	
		} else filePath = '.' + httpServer.subDir + request.url;
	
		var extname = framework.path.extname(filePath);
		var contentType = "text/html";
		switch (extname) {
			case '.js':
				contentType = 'text/javascript';
				break;
			case '.css':
				contentType = 'text/css';
				break;
			case '.json':
				contentType = 'application/json';
				break;
			case '.png':
				contentType = 'image/png';
				break;      
			case '.jpg':
				contentType = 'image/jpg';
				break;
			case '.wav':
				contentType = 'audio/wav';
				break;
		}
	
		framework.fs.readFile(filePath, function(error, content) {
			if(error) {
				if(error.code == 'ENOENT'){
					httpServer.raiseError( response, 404 );

				} else {
					response.writeHead(500);
					response.end( 'Script raised an Error: ' + error.code + '\n');
					response.end(); 
				}
			} else {
				response.writeHead(200, { 'Content-Type': contentType });
				response.end(content, 'utf-8');
			}
		});
		
	},
	raiseError: function( response, err ) {
		framework.fs.readFile('./' + httpServer.subDir + '/' + httpServer.error404, function(error, content) {
			response.writeHead(200, { 'Content-Type': 'text/html' });
			response.end(content, 'utf-8');
		});	
	}
	

}

//mqtt messages the client can subscribe and listen to
var toClient = {
	subs: [
		'CMAXMEDIA/PLAYER/PLAY',
		'CMAXMEDIA/TEMPERATURE/A1',
		'CMAXMEDIA/TEMPERATURE/A2',
		'CMAXMEDIA/YAHOO/WEATHER',
		'CMAXMEDIA/DARKSKY/WEATHER',
		'CMAXMEDIA/MQTTSERVER/STATUS',
		'CMAXMEDIA/PRESENCE',
	],
	subsData: Array(),
	init: function() {
		framework.client.on( 'connect', () => {
			console.log( "mqtt running" );	
			for( var i=0; i<toClient.subs.length; i++ ) {
				console.log( "subscribe to " + toClient.subs[i] );
				
				toClient.subsData[ toClient.subs[i] ] = "";
				framework.client.subscribe( toClient.subs[i], function(err) {});
				
			}
		});
		
		//store data from mqtt
		framework.client.on( 'message', (topic, message) => {
			console.log( "topic " + topic + " (" + message + ")" );
			toClient.subsData[ topic ] = message;
		});
		
		toClient.startTimer();
		
	},
	startTimer: function() {
		framework.tmr = setInterval( function() {
			for( var i=0; i<toClient.subs.length; i++ ) {
				var topic = toClient.subs[i];
				var message = toClient.subsData[ topic ];	
				if( message!="" ) {
					framework.io.sockets.emit( topic, JSON.parse( message ) );
				} else framework.io.sockets.emit( topic, message );
			}	
		}, 1000 );
		console.log( "timer started" );

		
	}

}

//messages come from client
var fromClient = {
	pubs: [
		'CMAXMEDIA/PLAYER/PLAY',
		'CMAXMEDIA/PLAYER/VOLUME',
		'SOCKETUPDATE',
	],
	pubsStruct: null,
	socket: null,
	init: function() {
		
		framework.io.sockets.on( "connection", function( socket ) {
			
			socket.on( "disconnect", function() {
				console.log( "disconnected" );									  
			});
			fromClient.socket = socket;
			
			fromClient.applyPubs();
		});
		

	},
	applyPubs: function() {
		for( var i=0; i<fromClient.pubs.length; i++ ) {
			var topic = fromClient.pubs[i];
			console.log( "subscribe to " + topic );
			
			fromClient.socket.on( topic, framework.copyFunction( topic ) );
			
		}
		

	},
	call: function( topic, data ) {

		console.log( "fromClient: " + topic + "=" + data );	
		if( topic=="SOCKETUPDATE" ) {
			if( data==true ) {
				framework.stopTimer();
				console.log( "stop update" );
			} else {
				framework.startTimer();
				console.log( "start update" );
			}
			
		} else {
			framework.client.publish( topic, data.toString() )
		}	
	}
	
}

framework.init();
