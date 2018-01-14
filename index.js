var express = require('express');  
var bodyParser = require('body-parser');  
var request = require('request');  
var app = express();
const Wit = require('node-wit').Wit;
const sessions = {};

app.use(bodyParser.urlencoded({extended: false}));  
app.use(bodyParser.json());  
app.listen((process.env.PORT || 3000));

const findOrCreateSession = (fbid) => {
	let sessionId;
	// Let's see if we already have a session for the user fbid
	Object.keys(sessions).forEach(k => {
		if (sessions[k].fbid === fbid) {
			// Yep, got it!
			sessionId = k;
		}
	});
	if (!sessionId) {
		// No session found for user fbid, let's create a new one
		sessionId = new Date().toISOString();
		sessions[sessionId] = 
			{fbid: fbid, 
				qNum: 0,
				inUS: false,
				email: "",
				phone: "",
				skills: [],
				hasResume: false,
				resumeUrl: "",
				hasli: false,
				liurl: "",
				location: ""
			};
	}
	return sessionId;
};

const firstEntityValue = (entities, entity) => {
   const val = entities && entities[entity] &&
   Array.isArray(entities[entity]) &&
   entities[entity].length > 0 &&
   entities[entity][0].value;
   if (!val) {
      return null;
   }
   return typeof val === 'object' ? val.value : val;
};

const actions = {
	say(sessionId, context, message, cb) {
		console.log(message);
		cb();
	},
	merge(sessionId, context, entities, message, cb) {
		// Retrieve the location entity and store it into a context field
		const email = firstEntityValue(entities, 'email');
		if (email) {
			context.email = email;
			cb(context);
		}
		else{
			const phone = firstEntityValue(entities, 'phone_number');
			if(phone){
				context.phone = phone
				cb(context);
			}
			else{
				const url = firstEntityValue(entities, 'url');
				if(url){
					context.url = url
					cb(context);
				}
				else if(sessions[sessionId].qNum == 9){
					const location = firstEntityValue(entities, 'location');
					if(location){
						context.location = location
					}
					cb(context);
				}
			}
			
		}
	},
	error(sessionId, context, error) {
		console.log(error.message);
	},
};

// Server frontpage
app.get('/', function (req, res) {  
	res.send('This is TestBot Server');
});

// Facebook Webhook
app.get('/webhook', function (req, res) {  
	if (req.query['hub.verify_token'] === 'testbot_verify_token') {
		res.send(req.query['hub.challenge']);
	} else {
		res.send('Invalid verify token');
	}
});

//handler receiving messages
app.post('/webhook', function (req, res) {  
	var events = req.body.entry[0].messaging;
	for (i = 0; i < events.length; i++) {
		var event = events[i];
		console.log(event.message);
		const sessionId = findOrCreateSession(event.sender.id);
		//attachments
		if(event.message && event.message.attachments){
			console.log(event.message.attachments);
			if(sessions[sessionId].qNum == 6){
				submitResume(event.sender.id, event.message.attachments);
				sessions[sessionId].qNum = 7;
			}
			else if(sessions[sessionId].qNum == 16){
				changeResume(event.sender.id, event.message.attachments);
			}
			else if(sessions[sessionId].qNum == 17){
				changeLinkedIn(event.sender.id, event.message.attachments);
			}
			else if(sessions[sessionId].qNum!=8){
				sendMessage(event.sender.id, {text: "I'm not sure what to do with this."});
			}
		}
		//text
		if (event.message && event.message.text) {
			//if they haven't started the application
			if(sessions[sessionId].qNum==0){
				if(!intro(event.sender.id, event.message.text)){
					sendMessage(event.sender.id, {text: "Message recieved. To start an application, please type \"start application\"."});
				}
			}
			//if they have started the application
			else if(!cancel(event.sender.id, event.message.text)){
				if(sessions[sessionId].qNum==2){
					email(event.sender.id, event.message.text);
				}
				else if(sessions[sessionId].qNum==3){
					phoneNum(event.sender.id, event.message.text);
				}
				else if(sessions[sessionId].qNum==4){
					parseSkills(event.sender.id, event.message.text);
				}
				else if(sessions[sessionId].qNum==5){
					console.log("ERROR: at 5");
				}
				else if(sessions[sessionId].qNum==6){
					console.log("ERROR: at 6");
					//sendMessage(event.sender.id, {text: "Thahnt doesn't look like an attachment."});				
				}
				else if(sessions[sessionId].qNum==7){
					checkLinkedIn(event.sender.id, event.message.text);
				}
				else if(sessions[sessionId].qNum==8){
					submitLinkedIn(event.sender.id, event.message.text);
				}
				else if(sessions[sessionId].qNum==9){
					prefLocation(event.sender.id, event.message.text);
				}
				else if(sessions[sessionId].qNum==13){
					changeEmail(event.sender.id, event.message.text);
				}
				else if(sessions[sessionId].qNum==14){
					changePhone(event.sender.id, event.message.text);
				}
				else if(sessions[sessionId].qNum==15){
					changeSkills(event.sender.id, event.message.text);
				}
				else if(sessions[sessionId].qNum==17){
					changeLinkedIn(event.sender.id, event.message.text);
				}
				else if(sessions[sessionId].qNum==18){
					changeLocation(event.sender.id, event.message.text);
				}
			}
		}
		//postback
		else if (event.postback) {
			const sessionId = findOrCreateSession(event.sender.id);
			console.log("Postback received: " + JSON.stringify(event.postback));
			//certified for us
			if(event.postback.payload==="ct"){
				sessions[sessionId].inUS = true;
				sessions[sessionId].qNum = 2;
				sendMessage(event.sender.id, {text: "Great! And what is your email address?"});
			}
			else if(event.postback.payload==="cf"){
				sessions[sessionId].inUS = false;
				sessions[sessionId].qNum = 0;
				sendMessage(event.sender.id, {text: "Unfortunately, we currently are not accepting applications from candidates that are not authorized to work in the United States. If you would like, you could try applying at another time. Apologies, and hopefully you’ll have a place in our company in the future. Thanks, Appbot."});
			}
			//submiting resume
			else if(event.postback.payload==="rt"){
				sessions[sessionId].hasResume = true;
				sessions[sessionId].qNum = 6;
				sendMessage(event.sender.id, {text: "Okay, attach your resume now."});
			}
			else if(event.postback.payload==="rf"){
				sessions[sessionId].hasResume = false;
				sessions[sessionId].qNum = 7;
				message = {
					"attachment": {
						"type": "template",
						"payload": {
							"template_type": "generic",
							"elements": [{
								"title": 'Would you like to provide a LinkedIn account?', 
								"subtitle": '',
								"buttons": [{
									"type": "postback",
									"title": "Yes",
									"payload": "lt"
								},{
									"type": "postback",
									"title": "No",
									"payload": "lf"
								}]
							}]
						}
					}
				};
				sendMessage(event.sender.id, message);
			}
			//submitting linkedIn
			else if(event.postback.payload==="lt"){
				sessions[sessionId].hasli = true;
				sessions[sessionId].qNum = 8;
				sendMessage(event.sender.id, {text: "Alright, paste your LinkedIn profile url below."});
			}
			else if(event.postback.payload==="lf"){
				sessions[sessionId].hasli = false;
				sessions[sessionId].qNum = 9;
				sendMessage(event.sender.id, {text: "Last question! Is there an area in which you'd like to work?"});
			}
			else if(event.postback.payload==="em"){
				sendMessage(event.sender.id, {text: "Sure thing. What's your email?"});
				sessions[sessionId].qNum = 13;
			}
			else if(event.postback.payload==="ph"){
				sendMessage(event.sender.id, {text: "Sure thing. What's your phone number?"});
				sessions[sessionId].qNum = 14;
			}
			else if(event.postback.payload==="sk"){
				sendMessage(event.sender.id, {text: "Sure thing. What are your skills? (Seperated by commas.)"});
				sessions[sessionId].qNum = 15;
			}
			else if(event.postback.payload==="re"){
				if(sessions[sessionId].hasResume){
					message = {
						"attachment": {
							"type": "template",
							"payload": {
								"template_type": "generic",
								"elements": [{
									"title": 'What would you like to do with your resume?', 
									"subtitle": '',
									"buttons": [{
										"type": "postback",
										"title": "Change",
										"payload": "modres"
									},{
										"type": "postback",
										"title": "Remove",
										"payload": "remres"
									}]
								}]
							}
						}
					};
					sendMessage(event.sender.id, message);
				}
				else{
					sendMessage(event.sender.id, {text: "Attach your resume below."});
				}
				sessions[sessionId].qNum = 16;
			}
			else if(event.postback.payload==="li"){
				if(sessions[sessionId].hasli){
					message = {
						"attachment": {
							"type": "template",
							"payload": {
								"template_type": "generic",
								"elements": [{
									"title": 'What would you like to do with your LinkedIn url?', 
									"subtitle": '',
									"buttons": [{
										"type": "postback",
										"title": "Change",
										"payload": "modli"
									},{
										"type": "postback",
										"title": "Remove",
										"payload": "remli"
									}]
								}]
							}
						}
					};
					sendMessage(event.sender.id, message);
				}
				else{
					sendMessage(event.sender.id, {text: "Paste your LinkedIn profile url below."});
				}
				sessions[sessionId].qNum = 17;
			}
			else if(event.postback.payload==="lo"){
				sendMessage(event.sender.id, {text: "Sure thing. Where'd you like to work?"});
				sessions[sessionId].qNum = 18;
			}
			else if(event.postback.payload==="modres"){
				sendMessage(event.sender.id, {text: "Sure thing. What is your new resume?"});
			}
			else if(event.postback.payload==="remres"){
				sessions[sessionId].hasResume = false;
				sessions[sessionId].resumeUrl = "";
				printSum(event.sender.id);
			}
			else if(event.postback.payload==="modli"){
				sendMessage(event.sender.id, {text: "Sure thing. What's your LinkedIn?"});
			}
			else if(event.postback.payload==="remli"){
				sessions[sessionId].hasli = false;
				sessions[sessionId].liurl = "";
				printSum(event.sender.id);
			}
			else if(event.postback.payload==="su"){
				sendMessage(event.sender.id, {text: "Your application has been submitted successfully."});
				sessions[sessionId].qNum = 0;
			}
		}
	}
	res.sendStatus(200);
});

function intro(recipientId, text) {
	text = text || "";
	if(text.toLowerCase() === 'start application'){
		sendMessage(recipientId, {text: "Awesome! Let's get started. You can stop your application at any time by typing \"cancel\", and you will be given an opportunity to review and change your information at the end."});
		message = {
			"attachment": {
				"type": "template",
				"payload": {
					"template_type": "generic",
					"elements": [{
						"title": 'Are you authorized to work in the United States?', 
						"subtitle": '',
						"buttons": [{
							"type": "postback",
							"title": "Yes",
							"payload": "ct"
						},{
							"type": "postback",
							"title": "No",
							"payload": "cf"
						}]
					}]
				}
			}
		};
		sendMessage(recipientId, message);
		const sessionId = findOrCreateSession(recipientId);
		sessions[sessionId].qNum = 1;
		return true;
	}
	return false;
};

function cancel(recipientId, text) {
	text = text || "";
	if(text.toLowerCase() === 'cancel'){
		sendMessage(recipientId, {text: "Alright, we'll stop your application. You can start another at any time by typing \"start application\" again."});
		const sessionId = findOrCreateSession(recipientId);
		sessions[sessionId].qNum = 0;
		return true;
	}
	return false;
};

function email(recipientId, text) {
	const context = {};
	client.message(text, context, (error, data) => {
		if (error) {
			sendMessage(recipientId, {text: "Sorry, I couldn't tell where your email was. Perhaps try to rephrase your sentence, or include your email if you did not."});
		}
		else {
			console.log("Data: " + JSON.stringify(data));
			if(data.entities.email[0].value){
				const sessionId = findOrCreateSession(recipientId);
				sessions[sessionId].email = data.entities.email[0].value;
				sessions[sessionId].qNum = 3;
				sendMessage(recipientId, {text: "Wonderful, we'll primarily correspond with you using your email, but just in case, what's your phone number?"});
			}
			else{
				sendMessage(recipientId, {text: "Sorry, I couldn't tell where your email was. Perhaps try to rephrase your sentence, or include your email if you did not."});
			}
		}
	});
};

function changeEmail(recipientId, text) {
	const context = {};
	client.message(text, context, (error, data) => {
		if (error) {
			sendMessage(recipientId, {text: "Sorry, I couldn't tell where your email was. Perhaps try to rephrase your sentence, or include your email if you did not. Would you like to change anything else?"});
		}
		else {
			console.log("Data: " + JSON.stringify(data));
			if(data.entities.email[0].value){
				const sessionId = findOrCreateSession(recipientId);
				sessions[sessionId].email = data.entities.email[0].value;
				sessions[sessionId].qNum = 10;
				sendMessage(recipientId, {text: "Wonderful, we'll primarily correspond with you using your email. Would you like to change anything else?"});
				printSum(recipientId);
			}
			else{
				sendMessage(recipientId, {text: "Sorry, I couldn't tell where your email was. Perhaps try to rephrase your sentence, or include your email if you did not."});
			}
		}
	});
};

function phoneNum(recipientId, text) {
	const context = {};
	client.message(text, context, (error, data) => {
		if (error) {
			sendMessage(recipientId, {text: "Sorry, I couldn't tell where your phone number was. Perhaps try to rephrase your sentence, or include your phone number if you did not."});
		}
		else {
			console.log("Data: " + JSON.stringify(data));
			if(data.entities.phone_number[0].value){
				const sessionId = findOrCreateSession(recipientId);
				sessions[sessionId].phone = data.entities.phone_number[0].value;
				sessions[sessionId].qNum = 4;
				sendMessage(recipientId, {text: "Alright, let's get into your qualifications. What skills do you have? (Seperate your skills with commas.)"});
			}
			else{
				sendMessage(recipientId, {text: "Sorry, I couldn't tell where your phone number was. Perhaps try to rephrase your sentence, or include your phone number if you did not."});
			}
		}
	});
};

function changePhone(recipientId, text) {
	const context = {};
	client.message(text, context, (error, data) => {
		if (error) {
			sendMessage(recipientId, {text: "Sorry, I couldn't tell where your phone number was. Perhaps try to rephrase your sentence, or include your phone number if you did not."});
		}
		else {
			console.log("Data: " + JSON.stringify(data));
			if(data.entities.phone_number[0].value){
				const sessionId = findOrCreateSession(recipientId);
				sessions[sessionId].phone = data.entities.phone_number[0].value;
				sessions[sessionId].qNum = 10;
				sendMessage(recipientId, {text: "Would you like to change anything else?"});
				printSum(recipientId);
			}
			else{
				sendMessage(recipientId, {text: "Sorry, I couldn't tell where your phone number was. Perhaps try to rephrase your sentence, or include your phone number if you did not."});
			}
		}
	});
};

function parseSkills(recipientId, text) {
	text = text || "";
	skills = text.split(',');
	for(i = 0; i < skills.length; i++){
		skills[i] = skills[i].trim();
	}
	console.log(skills);
	const sessionId = findOrCreateSession(recipientId);
	sessions[sessionId].qNum = 5;
	sessions[sessionId].skills = skills;
	message = {
		"attachment": {
			"type": "template",
			"payload": {
				"template_type": "generic",
				"elements": [{
					"title": 'Would you like to attach a resume?', 
					"subtitle": '',
					"buttons": [{
						"type": "postback",
						"title": "Yes",
						"payload": "rt"
					},{
						"type": "postback",
						"title": "No",
						"payload": "rf"
					}]
				}]
			}
		}
	};
	sendMessage(recipientId, message);
};

function changeSkills(recipientId, text) {
	text = text || "";
	skills = text.split(',');
	for(i = 0; i < skills.length; i++){
		skills[i] = skills[i].trim();
	}
	const sessionId = findOrCreateSession(recipientId);
	sessions[sessionId].qNum = 10;
	sessions[sessionId].skills = skills;
	printSum(recipientId);
};

function submitResume(recipientId, attachments) {
	const sessionId = findOrCreateSession(recipientId);
	sessions[sessionId].resumeUrl = attachments[0].payload.url;
	sessions[sessionId].qNum++;
	message = {
		"attachment": {
			"type": "template",
			"payload": {
				"template_type": "generic",
				"elements": [{
					"title": 'Would you like to provide a LinkedIn account?', 
					"subtitle": '',
					"buttons": [{
						"type": "postback",
						"title": "Yes",
						"payload": "lt"
					},{
						"type": "postback",
						"title": "No",
						"payload": "lf"
					}]
				}]
			}
		}
	};
	sendMessage(recipientId, message);
};

function submitLinkedIn(recipientId, text) {
	const context = {};
	client.message(text, context, (error, data) => {
		if (error) {
			sendMessage(recipientId, {text: "Sorry, I couldn't find the url. Perhaps try to rephrase your sentence, or include a url if you did not."});
		}
		else {
			console.log("Data: " + JSON.stringify(data));
			console.log(data.entities.url);
			if(data.entities.url[0].value){
				const sessionId = findOrCreateSession(recipientId);
				sessions[sessionId].liurl = data.entities.url[0].value;
				sessions[sessionId].qNum = 9;
				sendMessage(recipientId, {text: "Last question! Is there an area in which you'd like to work?"});
			}
			else{
				sendMessage(recipientId, {text: "Sorry, I couldn't find the url. Perhaps try to rephrase your sentence, or include a url if you did not."});
			}
		}
	});
};

function changeResume(recipientId, attachments) {
	const sessionId = findOrCreateSession(recipientId);
	sessions[sessionId].hasResume = true;
	sessions[sessionId].resumeUrl = attachments[0].payload.url;
	sessions[sessionId].qNum = 10;
	printSum(recipientId);
};

function changeLinkedIn(recipientId, text){
	const sessionId = findOrCreateSession(recipientId);
	sessions[sessionId].hasli = true;
	const context = {};
	client.message(text, context, (error, data) => {
		if (error) {
			sendMessage(recipientId, {text: "Sorry, I couldn't find the url. Perhaps try to rephrase your sentence, or include a url if you did not."});
		}
		else {
			console.log("Data: " + JSON.stringify(data));
			console.log(data.entities.url);
			if(data.entities.url[0].value){
				const sessionId = findOrCreateSession(recipientId);
				sessions[sessionId].liurl = data.entities.url[0].value;
				sessions[sessionId].qNum = 10;
				printSum(recipientId);
			}
			else{
				sendMessage(recipientId, {text: "Sorry, I couldn't find the url. Perhaps try to rephrase your sentence, or include a url if you did not."});
			}
		}
	});
}

function prefLocation(recipientId, text) {
	const context = {};
	client.message(text, context, (error, data) => {
		if (error) {
			sendMessage(recipientId, {text: "Sorry, I couldn't find a location in your message. Perhaps try to rephrase your sentence, or include a location if you did not."});
		}
		else {
			console.log("Data: " + JSON.stringify(data));
			if(data.entities.location[0].value){
				const sessionId = findOrCreateSession(recipientId);
				sessions[sessionId].location = data.entities.location[0].value;
				sessions[sessionId].qNum = 10;
				console.log(sessions[sessionId]);
				sendMessage(recipientId, {text: "Congratulations, your application is complete! Here is the information you provided. Would you like to make any changes?"});
				printSum(recipientId);
			}
			else{
				sendMessage(recipientId, {text: "Sorry, I couldn't find a location in your message. Perhaps try to rephrase your sentence, or include a location if you did not."});
			}
		}
	});
};

function changeLocation(recipientId, text){
	const context = {};
	client.message(text, context, (error, data) => {
		if (error) {
			sendMessage(recipientId, {text: "Sorry, I couldn't find a location in your message. Perhaps try to rephrase your sentence, or include a location if you did not."});
		}
		else {
			console.log("Data: " + JSON.stringify(data));
			if(data.entities.location[0].value){
				const sessionId = findOrCreateSession(recipientId);
				sessions[sessionId].location = data.entities.location[0].value;
				sessions[sessionId].qNum = 10;
				console.log(sessions[sessionId]);
				printSum(recipientId);
			}
			else{
				sendMessage(recipientId, {text: "Sorry, I couldn't find a location in your message. Perhaps try to rephrase your sentence, or include a location if you did not."});
			}
		}
	});
}

function printSum(recipientId){
	const sessionId = findOrCreateSession(recipientId);
	summary = "Email: " + sessions[sessionId].email + "\nPhone Number: " + sessions[sessionId].phone + "\nSkills: " + sessions[sessionId].skills;
	if(sessions[sessionId].hasResume){
		summary = summary + "\nResume: " + sessions[sessionId].resumeUrl;
	}
	if(sessions[sessionId].hasli){
		summary = summary + "\nLinkedIn: " + sessions[sessionId].liurl;
	}
	summary = summary + "\nPreferred Location: " + sessions[sessionId].location;
	sendMessage(recipientId, {text: summary});
	message = {
		"attachment": {
			"type": "template",
			"payload": {
				"template_type": "generic",
				"elements": [{
					"title": 'Contanct Information', 
					"subtitle": '',
					"buttons": [{
						"type": "postback",
						"title": "Email",
						"payload": "em"
					},{
						"type": "postback",
						"title": "Phone Number",
						"payload": "ph"
					}]
				},
				{
					"title": "Experience", 
					"subtitle": '',
					"buttons": [{
						"type": "postback",
						"title": "Skills",
						"payload": "sk"
					},{
						"type": "postback",
						"title": "Resume",
						"payload": "re"
					},{
						"type": "postback",
						"title": "LinkedIn",
						"payload": "li"
					}]
				},
				{
					"title": 'Finalization', 
					"subtitle": '',
					"buttons": [{
						"type": "postback",
						"title": "Location",
						"payload": "lo"
					},{
						"type": "postback",
						"title": "Submit",
						"payload": "su"
					}]
				}]
			}
		}
	};
	sendMessage(recipientId, message);
};

// generic function sending messages
function sendMessage(recipientId, message) {  
	request({
		url: 'https://graph.facebook.com/v2.6/me/messages',
		qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
		method: 'POST',
		json: {
			recipient: {id: recipientId},
			message: message,
		}
	}, function(error, response, body) {
		if (error) {
			console.log('Error sending message: ', error);
		} else if (response.body.error) {
			console.log('Error: ', response.body.error);
		}
	});
};

const client = new Wit('3SJUMYXD2BWAODMUFB5Y4J2BG6J2VCGN', actions);