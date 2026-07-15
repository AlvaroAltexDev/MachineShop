import { AuthProvider } from './context/AuthProvider';
import { Pages } from './components/Pages';
import './assets/Styles.css';

function App() {

  return (
   <AuthProvider>
      <Pages/>
   </AuthProvider>
  );
}

export default App;
