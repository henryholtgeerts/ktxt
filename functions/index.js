const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
admin.initializeApp();

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
exports.helloWorld = functions.https.onRequest(async (request, response) => {
  try {
    const snapshot = await admin.firestore().collection("callers")
        .doc(request.body.From).get();
    let messageBody = "";
    if (!snapshot.exists) {
      // No caller doc exists, create one
      await admin.firestore().collection("callers")
          .doc(request.body.From)
          .set({lastPrompt: "name"});
      messageBody = "Welcome to KTXT! What's your name?";
    } else {
      const data = snapshot.data();
      switch ( data.lastPrompt ) {
        case "name": {
          await admin.firestore().collection("callers")
              .doc(request.body.From)
              .set({name: request.body.Body, lastPrompt: null});
          messageBody = `Hi ${request.body.Body}!`;
          break;
        } case "suggestTopic": {
          const topic = await admin.firestore().collection("topics")
              .add({topic: request.body.Body});
          await admin.firestore().collection("callers")
              .doc(request.body.From)
              .set({suggestedTopic: topic, lastPrompt: null});
          messageBody = "Got it, thanks!";
          break;
        } default: {
          messageBody = `Hello again, ${data.name}!`;
          break;
        }
      }
    }
    await admin.firestore().collection("messages").add({
      to: request.body.From,
      body: messageBody,
    });
  } catch (error) {
    functions.logger.error(error);
  }
});

// Listen for updates to any `user` document.
exports.onCallerUpdate = functions.firestore
    .document("callers/{docId}")
    .onUpdate(async (change, context) => {
      try {
        // Retrieve the current and previous value
        const data = change.after.data();
        const previousData = change.before.data();

        // We'll only update if the name has changed.
        // This is crucial to prevent infinite loops.
        if ( data.lastPrompt === previousData.lastPrompt ) {
          return null;
        }

        if ( data.lastPrompt !== null ) {
          return null;
        }

        if ( !data.suggestedTopic ) {
          await admin.firestore().collection("messages").add({
            to: change.after.ref.id,
            body: "Do you have a topic suggestion for today's show?",
          });
          return change.after.ref.set({
            lastPrompt: "suggestTopic",
          }, {merge: true});
        }
      } catch (error) {
        functions.logger.error(error);
      }
    });

exports.startShow = functions.https.onRequest(async (request, response) => {
  try {
    const snapshot = await admin.firestore().collection("shows")
        .doc("currentShow").get();
    if (!snapshot.exists) {
      // No caller doc exists, create one
      await admin.firestore().collection("shows")
          .doc("currentShow")
          .set({topic: null});
      await axios({
        method: "post",
        url: "https://api.cronhooks.io/schedules",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${functions.config().cronhooks.key}`,
        },
        data: {
          title: "Pick a topic for the show",
          url: "https://us-central1-ktxt-firebase.cloudfunctions.net/pickTopic",
          timezone: "africa/abidjan",
          method: "GET",
          contentType: "application/json; charset=utf-8",
          isRecurring: false,
          runAt: new Date( new Date().getTime() + 2*60000).toISOString(),
          sendCronhookObject: false,
          sendFailureAlert: false,
        },
      });
      return response.json({
        status: "showStarted",
        payload: snapshot.data(),
      });
    } else {
      return response.json({
        status: "showInProgress",
        payload: snapshot.data(),
      });
    }
  } catch (error) {
    return response.json({
      status: "error",
      error: error,
    });
  }
});

exports.pickTopic = functions.https.onRequest(async (request, response) => {
  try {
    await admin.firestore().collection("shows")
        .doc("currentShow").set({
          topic: "picked a topic!",
        }, {merge: true});
  } catch (error) {
    functions.logger.error(error);
  }
});
