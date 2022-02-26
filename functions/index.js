const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const cors = require("cors");
admin.initializeApp();

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions

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
              .set({suggestedTopic: topic, lastPrompt: null}, {merge: true});
          messageBody = "Got it, thanks!";
          break;
        } case "requestTopicResponse": {
          const topicResponse = await admin.firestore().collection("shows")
              .doc("currentShow")
              .collection("topicResponses")
              .add({
                topicResponse: request.body.Body,
                caller: data.name,
                callerId: request.body.From,
              });
          await admin.firestore().collection("callers")
              .doc(request.body.From)
              .set({
                topicResponse: topicResponse,
                lastPrompt: null,
              }, {merge: true});
          messageBody = "Got it, thanks!";
          break;
        } case "requestHostResponse": {
          await admin.firestore().collection("shows")
              .doc("currentShow")
              .collection("topicResponses")
              .doc(data.respondingTo)
              .set({hostResponse: request.body.Body});
          await admin.firestore().collection("callers")
              .doc(request.body.From)
              .set({
                lastPrompt: null,
              }, {merge: true});
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
    response.status(200).send();
  } catch (error) {
    functions.logger.error(error);
  }
});

exports.onCallerUpdate = functions.firestore
    .document("callers/{docId}")
    .onUpdate(async (change, context) => {
      try {
        const currentShowSnapshot = await admin.firestore().collection("shows")
            .doc("currentShow").get();
        const currentShowData = currentShowSnapshot.data();
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

        if ( !data.suggestedTopic && currentShowData.topic === null ) {
          await admin.firestore().collection("messages").add({
            to: change.after.ref.id,
            body: "Do you have a topic suggestion for today's show?",
          });
          change.after.ref.set({
            lastPrompt: "suggestTopic",
          }, {merge: true});
        }

        if ( !data.topicResponse && currentShowData.topic !== null ) {
          await admin.firestore().collection("messages").add({
            to: change.after.ref.id,
            body: `Respond to this topic: ${currentShowData.topic}`,
          });
          change.after.ref.set({
            lastPrompt: "requestTopicResponse",
          }, {merge: true});
        }
      } catch (error) {
        functions.logger.error(error);
      }
    });

exports.startShow = functions.https.onRequest((request, response) =>
  cors()(request, response, async () => {
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
            runAt: new Date( new Date().getTime() + 1*60000).toISOString(),
            sendCronhookObject: false,
            sendFailureAlert: false,
          },
        });
        response.json({
          status: "showStarted",
          payload: snapshot.data(),
        });
      } else {
        response.json({
          status: "showInProgress",
          payload: snapshot.data(),
        });
      }
    } catch (error) {
      response.json({
        status: "error",
        error: error,
      });
    }
  }),
);

exports.pickTopic = functions.https.onRequest( async (request, response) => {
  const topics = [];
  const snapshot = await admin.firestore().collection("topics").get();
  snapshot.forEach((doc) => {
    topics.push(doc.data().topic);
  });
  const pickedTopic = topics[Math.floor(Math.random()*topics.length)];
  await admin.firestore().collection("shows")
      .doc("currentShow").set({
        topic: pickedTopic,
      }, {merge: true})
      .catch((err) => response.status(400).end(err));
  response.status(200).send();
});

exports.onPickedTopic = functions.firestore
    .document("shows/currentShow")
    .onUpdate(async (change, context) => {
      try {
        const data = change.after.data();

        const callersSnapshot = await admin.firestore()
            .collection("callers").get();
        callersSnapshot.forEach( async (doc) => {
          await admin.firestore()
              .collection("callers")
              .doc(doc.id)
              .set({
                lastPrompt: "requestTopicResponse",
              }, {merge: true});
          await admin.firestore().collection("messages").add({
            to: doc.id,
            body:
              `In 30 words or less, any thoughts on this topic: ${data.topic}`,
          });
        });
      } catch (error) {
        functions.logger.error(error);
      }
    });

exports.onUpdateTopicResponse = functions.firestore
    .document("shows/currentShow/topicResponses/{docId}")
    .onUpdate(async (change, context) => {
      try {
        // Retrieve the current and previous value
        const data = change.after.data();
        const callersSnapshot = await admin.firestore()
            .collection("callers").get();

        callersSnapshot.forEach( async (caller) => {
          if (caller.id !== data.callerId) {
            if (caller.data().topicResponse) {
              if (!caller.data().respondingTo) {
                await admin.firestore().collection("messages").add({
                  to: caller.id,
                  body:
                    `As the show's host: In 10 words or less,
                     reply to this: ${data.topicResponse}`,
                });
                await admin.firestore()
                    .collection("callers")
                    .doc(caller.id)
                    .set({
                      lastPrompt: "requestHostResponse",
                    }, {merge: true});
              }
            }
          }
        });
      } catch (error) {
        functions.logger.error(error);
      }
    });

