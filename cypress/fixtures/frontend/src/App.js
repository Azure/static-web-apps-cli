import logo from './logo.svg';
import './App.css';

function callFunction(e) {
  e.preventDefault();
  return fetch("/api/headers");
}

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload!
        </p>
        <a className="App-link" href="https://reactjs.org" rel="noopener noreferrer" onClick={callFunction}>
          Click me
        </a>
      </header>
    </div>
  );
}

export default App;
