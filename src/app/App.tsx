import { RouterProvider } from 'react-router';
import { router } from './routes';
import { DataProvider } from './context/DataContext';
import { GridProvider } from './context/GridContext';
import { AuthProvider } from './context/AuthContext';
import { ProfileProvider } from './context/ProfileContext';
import { Toaster } from 'sonner';

export default function App() {
  return (
    <DataProvider>
      <AuthProvider>
        <ProfileProvider>
          <GridProvider>
            <RouterProvider router={router} />
            <Toaster position="top-center" offset="80px" />
          </GridProvider>
        </ProfileProvider>
      </AuthProvider>
    </DataProvider>
  );
}
