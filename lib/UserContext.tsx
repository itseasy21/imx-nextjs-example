import { Router, useRouter } from "next/router";
import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
} from "react";
import { magic } from "./magic";

interface UserContext {
  user: any;
  setUser: (user: any) => void;
}

const UserContext = createContext<UserContext | undefined>(undefined);

const UserProvider = ({ children }) => {
  const [user, setUser] = useState<any>();
  const router = useRouter();

  // If isLoggedIn is true, set the UserContext with user data
  // Otherwise, redirect to /login and set UserContext to { user: null }
  useEffect(() => {
    setUser({ loading: true });
    if (magic) {
      magic.user.isLoggedIn().then((isLoggedIn) => {
        if (isLoggedIn && magic) {
          magic?.user.getMetadata().then((userData) => setUser(userData));
        } else {
          router.push("/login");
          setUser({ user: null });
        }
      });
    }
  }, []);

  return (
    <UserContext.Provider
      value={{
        user,
        setUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};

export { UserProvider, useUser };
