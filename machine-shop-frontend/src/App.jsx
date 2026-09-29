import { AuthProvider } from './context/AuthProvider';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationProvider';
import { Pages } from './components/Pages';
import './assets/Styles.css';

function App() {

   return (
    <AuthProvider>
      <ThemeProvider>
        <NotificationProvider>
          <Pages />
        </NotificationProvider>
      </ThemeProvider>
    </AuthProvider>
   );
}

export default App;