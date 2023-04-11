import { useState } from 'react';
import './App.css';
import Parent from './Parent';
import { Child } from './Child';

function App() {
  const [sessionId, setSessionId] = useState(1);

  return (
    <div className="App">
      <Parent sessionId={sessionId}>
        <Child>Child 1</Child>
        <Child>Child 2</Child>
        <Child>Child 3</Child>
      </Parent>

      <button onClick={() => setSessionId(value => value + 1)}>Update Session</button>
    </div>
  );
}

export default App;
