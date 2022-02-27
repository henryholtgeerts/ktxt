import logo from './logo.svg';
import './App.css';
import axios from 'axios';

import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, collection } from "firebase/firestore";

import { useEffect, useState } from 'react';

import StartShowButton from './components/start-show-button'

function App() {

  const firebaseConfig = {
    apiKey: "AIzaSyCpTxioIbWER20vP9lp_ScGwd2WT4S2BDQ",
    authDomain: "ktxt-firebase.firebaseapp.com",
    databaseURL: "https://ktxt-firebase-default-rtdb.firebaseio.com",
    projectId: "ktxt-firebase",
    storageBucket: "ktxt-firebase.appspot.com",
    messagingSenderId: "910282553048",
    appId: "1:910282553048:web:34022bf6a50869f8a1c9ad"
  };
  
  // Initialize Firebase
  initializeApp(firebaseConfig);
  const db = getFirestore();

  const [ topic, setTopic ] = useState(null);
  const [ numberOfCallers, setNumberOfCallers ] = useState(null);
  const [ topicResponses, setTopicResponses ] = useState([]);
  const [ rundown, setRundown ] = useState([]);
  const [ phase, setPhase ] = useState('waiting');

  useEffect(() => {
    console.log('rundown', rundown)
  }, [rundown])

  useEffect(() => {
    onSnapshot(doc(db, "shows", "currentShow"), (doc) => {
      const data = doc.data();
      data && setTopic(data.topic);
    });
  
    onSnapshot(collection(db, "shows/currentShow/topicResponses"), (snapshot) => {
      const newResponses = [];
      snapshot.forEach(doc => {
        newResponses.push({
          message: doc.data().topicResponse,
          caller: doc.data().caller,
        })
      });
      setTopicResponses(newResponses);
    });

    onSnapshot(collection(db, "callers"), (snapshot) => {
      setNumberOfCallers(snapshot.size);
    });

  }, [db])

  useEffect(() => {

    const generateIntro = (caller, topic) => {
      const statements = [
        `This is ${caller}. What do you think about ${topic}?`,
        `Ok, now we're talking with ${caller}. What's going on?`,
        `Next this is ${caller}. What are your thoughts on ${topic}?`,
        `And here's ${caller}.`,
        `Looks like now we've got ${caller}. What do you think about ${topic}?`,
        `Here's ${caller}. I understand you've got some thoughts?`,
      ];
      return statements[Math.floor((Math.random()*statements.length))];
    }

    const generateOutro = (caller, topic) => {
      const statements = [
        `Wow, thanks for sharing that with us.`,
        `Very interesting.`,
        `So cool. Thanks ${caller}`,
        `Fascinating.`,
        `That was captivating. Great insight, ${caller}.`,
        "Wow, wouldn't have even considered that.",
        "Super interesting.",
        `Wild. Thanks ${caller}`,
        `Love all these thoughts tonight.`,
        `What a show it's been.`,
      ];
      return statements[Math.floor((Math.random()*statements.length))];
    }

    if ( numberOfCallers && numberOfCallers === topicResponses.length ) {
      const newRundown = [];
      newRundown.push({
        speaker: 'host',
        message: `Alright, the phones are lighting up, we've got our first text. We're talking about ${topic}.`
      })
      topicResponses.forEach((response, index) => {
        if ( index === 0 ) {
          newRundown.push({
            speaker: 'host',
            message: `To kick us off here's ${response.caller}. ${response.caller}, what do you think about ${topic}?`,
          })
        } else {
          newRundown.push({
            speaker: 'host',
            message: generateIntro(response.caller, topic),
          })
        }
        newRundown.push({
          speaker: 'guest',
          message: response.message,
        })
        newRundown.push({
          speaker: 'host',
          message: generateOutro(response.caller, topic)
        })
      })
      newRundown.push({
        speaker: 'host',
        message: `What a show. Glad you could all make it out for our discussion about ${topic}. Look forward to texting again soon. Until then, xoxo from KTXT.`
      })
      setRundown(newRundown)
    }
  }, [topic, numberOfCallers, topicResponses])

  const [ isStartButtonDisabled, setIsStartButtonDisabled ] = useState(false)

    const handleStartButtonClick = async () => {
        setIsStartButtonDisabled(true)
        const response = await axios.get('https://us-central1-ktxt-firebase.cloudfunctions.net/startShow');
        setPhase('welcome');
        setIsStartButtonDisabled(false);
    }

  const handleTTSPost = () => {
    axios.post('https://us-central1-ktxt-firebase.cloudfunctions.net/startShow', {
      text: 'Hiiii does this work??',
    })
    .then(function (response) {
      console.log(response);
    })
    .catch(function (error) {
      console.log(error);
    });
  }

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          KTXT Lives!
        </p>
        <p>Topic: {topic}</p>
        <div>
          { topicResponses && topicResponses.map((response) => {
            return <p>{response.message} by {response.caller}</p>
          }) }
        </div>
        <button disabled={isStartButtonDisabled} onClick={() => handleStartButtonClick()}>Start Show</button>
        <button onClick={() => handleTTSPost()}>Test TTS Endpoint</button>
      </header>
    </div>
  );
}

export default App;
