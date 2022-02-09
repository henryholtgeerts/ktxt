import logo from './logo.svg';
import './App.css';

import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";

import { useState } from 'react';

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

  onSnapshot(doc(db, "shows", "currentShow"), (doc) => {
    const data = doc.data();
    data && setTopic(data.topic);
    console.log("Current data: ", doc.data());  
  });

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          KTXT Lives!
        </p>
        <p>Topic: {topic}</p>
        <StartShowButton/>
      </header>
    </div>
  );
}

export default App;
