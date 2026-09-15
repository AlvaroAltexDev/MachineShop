import { AuthProvider } from './context/AuthProvider';
import { NotificationProvider } from './context/NotificationProvider';
import { Pages } from './components/Pages';
import './assets/Styles.css';

function App() {

  return (
   <AuthProvider>
      <NotificationProvider>
         <Pages/>
      </NotificationProvider>
   </AuthProvider>
  );
}

export default App;