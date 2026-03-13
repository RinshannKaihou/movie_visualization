console.log('App.tsx: File loaded');

import { GraphScene } from './components/GraphScene';

function App() {
  console.log('App: Component rendering');
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <GraphScene />
    </div>
  );
}

export default App;
