import logo from './logo.svg';
import './App.css';

import StartShowButton from './components/start-show-button'

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          KTXT Lives!
        </p>
        <StartShowButton/>
      </header>
    </div>
  );
}

export default App;
